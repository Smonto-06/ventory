// Qué pasarela de pagos está activa para cobrar la mensualidad.
//
// Wompi tiene prioridad (es la elección definitiva de Samuel, con botón Nequi
// directo); Mercado Pago es la interina mientras se completa el registro de
// Wompi. Sin llaves de ninguna, no hay pago en línea y la activación sigue
// siendo manual desde el super admin.

import { wompiConfigurado } from '@/lib/wompi'
import { mpConfigurado } from '@/lib/mercadopago'

export type Pasarela = 'wompi' | 'mercadopago'

export function pasarelaActiva(): Pasarela | null {
  if (wompiConfigurado()) return 'wompi'
  if (mpConfigurado()) return 'mercadopago'
  return null
}
