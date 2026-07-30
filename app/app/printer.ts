'use client'

// Impresión térmica directa (ESC/POS) por WebUSB o Web Bluetooth.
// Cada equipo guarda su preferencia; si no hay impresora conectada se usa
// el diálogo de impresión del navegador como respaldo (window.print).
//
// Soporta impresoras de tickets 58/80 mm estándar: USB (clase impresora)
// y Bluetooth LE (servicio 18f0 / característica 2af1, el estándar de las
// térmicas económicas).

export type PrinterKind = 'usb' | 'bt'

export interface TicketLine {
  type: 'center' | 'row' | 'divider' | 'big' | 'feed'
  left?: string
  right?: string
  bold?: boolean
}

interface UsbEndpointRef {
  device: {
    open: () => Promise<void>
    close: () => Promise<void>
    selectConfiguration: (n: number) => Promise<void>
    claimInterface: (n: number) => Promise<void>
    transferOut: (ep: number, data: BufferSource) => Promise<unknown>
    configuration: { interfaces: Array<{ interfaceNumber: number; alternate: { interfaceClass: number; endpoints: Array<{ direction: string; endpointNumber: number }> } }> } | null
    opened: boolean
  }
  endpoint: number
}

let usbRef: UsbEndpointRef | null = null
let btChar: { writeValueWithoutResponse?: (d: BufferSource) => Promise<void>; writeValue: (d: BufferSource) => Promise<void> } | null = null

const PREF_KEY = 'ventory-printer'

export function printerPref(): PrinterKind | null {
  if (typeof window === 'undefined') return null
  const v = window.localStorage.getItem(PREF_KEY)
  return v === 'usb' || v === 'bt' ? v : null
}

export function printerReady(): boolean {
  return (printerPref() === 'usb' && !!usbRef) || (printerPref() === 'bt' && !!btChar)
}

export function forgetPrinter(): void {
  window.localStorage.removeItem(PREF_KEY)
  try {
    usbRef?.device.close()
  } catch {
    // ya cerrada
  }
  usbRef = null
  btChar = null
}

// ─── Conexión USB ────────────────────────────────────────────────────────────

export async function connectUsb(): Promise<void> {
  const usb = (navigator as unknown as { usb?: { requestDevice: (o: unknown) => Promise<UsbEndpointRef['device']> } }).usb
  if (!usb) throw new Error('Este navegador no soporta WebUSB. Usa Chrome o Edge en computador o Android.')
  const device = await usb.requestDevice({ filters: [{ classCode: 7 }] })
  await attachUsb(device)
  window.localStorage.setItem(PREF_KEY, 'usb')
}

async function attachUsb(device: UsbEndpointRef['device']): Promise<void> {
  if (!device.opened) await device.open()
  await device.selectConfiguration(1)
  const iface = device.configuration?.interfaces.find((i) => i.alternate.interfaceClass === 7) ??
    device.configuration?.interfaces[0]
  if (!iface) throw new Error('La impresora no expone una interfaz compatible')
  await device.claimInterface(iface.interfaceNumber)
  const out = iface.alternate.endpoints.find((e) => e.direction === 'out')
  if (!out) throw new Error('La impresora no tiene canal de salida')
  usbRef = { device, endpoint: out.endpointNumber }
}

/** Reconecta en silencio una impresora USB ya autorizada (al recargar la página) */
export async function reattachUsb(): Promise<boolean> {
  const usb = (navigator as unknown as { usb?: { getDevices: () => Promise<Array<UsbEndpointRef['device']>> } }).usb
  if (!usb || printerPref() !== 'usb') return false
  try {
    const devices = await usb.getDevices()
    if (!devices.length) return false
    await attachUsb(devices[0])
    return true
  } catch {
    return false
  }
}

// ─── Conexión Bluetooth ──────────────────────────────────────────────────────

const BT_SERVICE = '000018f0-0000-1000-8000-00805f9b34fb'
const BT_CHAR = '00002af1-0000-1000-8000-00805f9b34fb'

export async function connectBt(): Promise<void> {
  const bt = (navigator as unknown as {
    bluetooth?: { requestDevice: (o: unknown) => Promise<{ gatt?: { connect: () => Promise<{ getPrimaryService: (s: string) => Promise<{ getCharacteristic: (c: string) => Promise<NonNullable<typeof btChar>> }> }> } }> }
  }).bluetooth
  if (!bt) throw new Error('Este navegador no soporta Bluetooth. Usa Chrome o Edge (Android o computador).')
  const device = await bt.requestDevice({ filters: [{ services: [BT_SERVICE] }], optionalServices: [BT_SERVICE] })
  const server = await device.gatt?.connect()
  if (!server) throw new Error('No se pudo conectar a la impresora')
  const service = await server.getPrimaryService(BT_SERVICE)
  btChar = await service.getCharacteristic(BT_CHAR)
  window.localStorage.setItem(PREF_KEY, 'bt')
}

// ─── Codificación ESC/POS (CP858: tildes y ñ) ───────────────────────────────

const CP858: Record<string, number> = {
  á: 0xa0, é: 0x82, í: 0xa1, ó: 0xa2, ú: 0xa3, ñ: 0xa4, Ñ: 0xa5,
  Á: 0xb5, É: 0x90, Í: 0xd6, Ó: 0xe0, Ú: 0xe9, ü: 0x81, Ü: 0x9a,
  '¡': 0xad, '¿': 0xa8, '°': 0xf8, '·': 0xfa, '─': 0xc4, '×': 0x78,
}

function encode(text: string): number[] {
  const out: number[] = []
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 63
    if (code < 128) out.push(code)
    else if (CP858[ch] !== undefined) out.push(CP858[ch])
    else out.push(63) // '?'
  }
  return out
}

const WIDTH = 32 // caracteres por línea en 58mm (fuente A); en 80mm sobra margen

function rowText(left: string, right: string): string {
  const max = WIDTH - right.length - 1
  const l = left.length > max ? left.slice(0, Math.max(0, max - 1)) + '…' : left
  return l + ' '.repeat(Math.max(1, WIDTH - l.length - right.length)) + right
}

export function buildEscpos(lines: TicketLine[]): Uint8Array {
  const b: number[] = []
  b.push(0x1b, 0x40) // init
  b.push(0x1b, 0x74, 19) // codepage CP858
  for (const l of lines) {
    if (l.type === 'feed') {
      b.push(0x0a)
      continue
    }
    if (l.type === 'divider') {
      b.push(...encode('-'.repeat(WIDTH)), 0x0a)
      continue
    }
    if (l.bold || l.type === 'big') b.push(0x1b, 0x45, 1)
    if (l.type === 'center' || l.type === 'big') b.push(0x1b, 0x61, 1)
    if (l.type === 'big') b.push(0x1d, 0x21, 0x11) // doble alto/ancho
    const text = l.type === 'row' ? rowText(l.left ?? '', l.right ?? '') : (l.left ?? '')
    b.push(...encode(text), 0x0a)
    if (l.type === 'big') b.push(0x1d, 0x21, 0x00)
    if (l.type === 'center' || l.type === 'big') b.push(0x1b, 0x61, 0)
    if (l.bold || l.type === 'big') b.push(0x1b, 0x45, 0)
  }
  b.push(0x0a, 0x0a, 0x0a)
  b.push(0x1d, 0x56, 0x42, 0x00) // corte parcial
  return new Uint8Array(b)
}

// ─── Envío ───────────────────────────────────────────────────────────────────

async function send(data: Uint8Array): Promise<void> {
  if (printerPref() === 'usb') {
    if (!usbRef) {
      const ok = await reattachUsb()
      if (!ok) throw new Error('Impresora USB no conectada. Ve a Ajustes → Impresora.')
    }
    await usbRef!.device.transferOut(usbRef!.endpoint, data.buffer as ArrayBuffer)
    return
  }
  if (printerPref() === 'bt') {
    if (!btChar) throw new Error('Impresora Bluetooth no conectada. Ve a Ajustes → Impresora.')
    // BLE: escribir en trozos de 100 bytes para no exceder el MTU
    for (let i = 0; i < data.length; i += 100) {
      const chunk = new Uint8Array(data.slice(i, i + 100)).buffer as ArrayBuffer
      if (btChar.writeValueWithoutResponse) await btChar.writeValueWithoutResponse(chunk)
      else await btChar.writeValue(chunk)
    }
    return
  }
  throw new Error('No hay impresora configurada')
}

/**
 * Imprime el ticket en la térmica configurada; si no hay ninguna (o falla),
 * cae al diálogo de impresión del navegador. Devuelve 'directa' | 'dialogo'.
 */
export async function smartPrint(lines: TicketLine[]): Promise<'directa' | 'dialogo'> {
  if (printerPref()) {
    try {
      await send(buildEscpos(lines))
      return 'directa'
    } catch {
      // impresora configurada pero inaccesible → respaldo con el diálogo
    }
  }
  window.print()
  return 'dialogo'
}

export async function testPrint(businessName: string): Promise<void> {
  await send(
    buildEscpos([
      { type: 'center', left: businessName || 'Ventory', bold: true },
      { type: 'center', left: 'Prueba de impresión' },
      { type: 'divider' },
      { type: 'row', left: 'Impresora', right: 'OK' },
      { type: 'row', left: 'Tildes áéíóúñ', right: '✓'.replace('✓', 'si') },
      { type: 'divider' },
      { type: 'center', left: 'Sistema Ventory POS' },
    ]),
  )
}
