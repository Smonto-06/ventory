'use client'

// Cotizaciones: la lista de precios prometidos que todavía no son ventas.
//
// El estado "Vencida" no se guarda en la base: se deduce de la fecha, así no
// hace falta una tarea que ande marcando cotizaciones cada noche.

import { CSSProperties, useEffect, useState } from 'react'
import { useApp } from '../store'
import { Icono } from '@/components/Icono'

const thStyle: CSSProperties = {
  padding: '12px 10px',
  fontSize: 12,
  fontWeight: 700,
  color: 'var(--muted)',
  textTransform: 'uppercase',
  letterSpacing: '.4px',
}

const gridCols = 'minmax(110px,.8fr) minmax(150px,1.4fr) 110px minmax(120px,1fr) 120px minmax(170px,auto)'

const CHIPS: Record<string, { texto: string; bg: string; fg: string }> = {
  OPEN: { texto: 'Abierta', bg: '#E7F6EF', fg: '#0F8A5F' },
  EXPIRED: { texto: 'Vencida', bg: '#FDF4E5', fg: '#B4740A' },
  CONVERTED: { texto: 'Convertida', bg: '#EEF0FE', fg: '#4338CA' },
  CANCELLED: { texto: 'Anulada', bg: '#FDECEC', fg: '#C9433B' },
}

const FILTROS: Array<{ id: string; label: string }> = [
  { id: 'todas', label: 'Todas' },
  { id: 'OPEN', label: 'Abiertas' },
  { id: 'EXPIRED', label: 'Vencidas' },
  { id: 'CONVERTED', label: 'Convertidas' },
  { id: 'CANCELLED', label: 'Anuladas' },
]

export default function CotizacionesScreen() {
  const s = useApp()
  const [filtro, setFiltro] = useState('todas')
  const [query, setQuery] = useState('')

  useEffect(() => {
    s.cargarCotizaciones()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const q = query.trim().toLowerCase()
  const filas = s.quotes
    .filter((c) => filtro === 'todas' || c.status === filtro)
    .filter(
      (c) =>
        !q ||
        c.folio.toLowerCase().includes(q) ||
        (c.customer?.name ?? c.customerName ?? '').toLowerCase().includes(q),
    )

  const abiertas = s.quotes.filter((c) => c.status === 'OPEN')
  const valorAbierto = abiertas.reduce((a, c) => a + c.total, 0)

  const fecha = (iso: string) =>
    new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })

  return (
    <div style={{ padding: 'clamp(16px,3vw,28px)', display: 'flex', flexDirection: 'column', gap: 16, animation: 'vfade .3s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-.4px' }}>Cotizaciones</h1>
          <div style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>
            Precios prometidos que todavía no son ventas. No afectan el inventario.
          </div>
        </div>
        <button
          onClick={() => s.go('pos')}
          style={{ height: 44, padding: '0 18px', borderRadius: 11, background: '#6366F1', color: '#fff', fontWeight: 700, fontSize: 14.5, cursor: 'pointer', boxShadow: '0 8px 18px -8px #6366F1cc', display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          <Icono n="carrito" tam={16} />
          Nueva cotización
        </button>
      </div>

      {abiertas.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 13, padding: '14px 18px' }}>
          <span style={{ color: '#6366F1', display: 'flex' }}>
            <Icono n="documento" tam={20} />
          </span>
          <span style={{ fontSize: 14, color: 'var(--text)' }}>
            <b>{abiertas.length}</b> cotización{abiertas.length === 1 ? '' : 'es'} abierta
            {abiertas.length === 1 ? '' : 's'} por{' '}
            <b style={{ fontVariantNumeric: 'tabular-nums' }}>{s.fmt(valorAbierto)}</b>
          </span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por número o cliente…"
          style={{ flex: 1, minWidth: 'min(100%,220px)', height: 44, padding: '0 16px', border: '1.5px solid var(--border)', borderRadius: 12, background: 'var(--surface)', fontSize: 14.5 }}
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTROS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFiltro(f.id)}
              style={{
                height: 44,
                padding: '0 14px',
                borderRadius: 11,
                fontWeight: 700,
                fontSize: 13.5,
                cursor: 'pointer',
                border: filtro === f.id ? '1.5px solid #6366F1' : '1.5px solid var(--border)',
                background: filtro === f.id ? '#6366F1' : 'var(--surface)',
                color: filtro === f.id ? '#fff' : 'var(--text)',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: '0 1px 2px rgba(15,23,42,.04),0 8px 24px -18px rgba(15,23,42,.16)', overflowX: 'auto' }}>
        <div style={{ minWidth: 860 }}>
          <div style={{ display: 'grid', gridTemplateColumns: gridCols, alignItems: 'center', background: 'var(--surface2)', borderBottom: '1px solid #EEF2F7', padding: '0 10px' }}>
            <div style={thStyle}>Número</div>
            <div style={thStyle}>Cliente</div>
            <div style={thStyle}>Estado</div>
            <div style={{ ...thStyle, textAlign: 'right' }}>Total</div>
            <div style={thStyle}>Vence</div>
            <div />
          </div>

          {filas.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: 14.5 }}>
              {s.quotes.length === 0
                ? 'Todavía no hay cotizaciones. Arma un carrito en el Punto de Venta y pulsa "Cotizar".'
                : 'Ninguna cotización coincide con la búsqueda.'}
            </div>
          ) : (
            filas.map((c) => {
              const chip = CHIPS[c.status] ?? CHIPS.OPEN
              const convertible = c.status === 'OPEN' || c.status === 'EXPIRED'
              // Solo informativo: cotizar lo que no se tiene es legítimo, pero
              // conviene verlo antes de llamar al cliente a recogerlo.
              const faltan = convertible ? s.faltantesDe(c) : []
              return (
                <div key={c.id} style={{ display: 'grid', gridTemplateColumns: gridCols, alignItems: 'center', borderBottom: '1px solid #EEF2F7', padding: '0 10px' }}>
                  <div style={{ padding: '13px 10px' }}>
                    <div style={{ fontWeight: 700, fontSize: 13.5, color: '#6366F1' }}>{c.folio}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{fecha(c.createdAt)}</div>
                  </div>
                  <div style={{ padding: '13px 10px', minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.customer?.name ?? c.customerName ?? 'Sin cliente'}
                    </div>
                    <div style={{ fontSize: 12, color: faltan.length ? '#C9433B' : 'var(--muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                      {faltan.length > 0 && <Icono n="alerta" tam={12} />}
                      {faltan.length
                        ? `Falta inventario para ${faltan.length} producto${faltan.length === 1 ? '' : 's'}`
                        : `${c.items.length} ${c.items.length === 1 ? 'producto' : 'productos'}`}
                    </div>
                  </div>
                  <div style={{ padding: '13px 10px' }}>
                    <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 8, background: chip.bg, color: chip.fg, fontWeight: 700, fontSize: 12 }}>
                      {chip.texto}
                    </span>
                  </div>
                  <div style={{ padding: '13px 10px', textAlign: 'right', fontWeight: 700, fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
                    {s.fmt(c.total)}
                  </div>
                  <div style={{ padding: '13px 10px', fontSize: 13, color: c.status === 'EXPIRED' ? '#B4740A' : 'var(--muted)' }}>
                    {c.status === 'CONVERTED' ? c.sale?.folio ?? '—' : fecha(c.validUntil)}
                  </div>
                  <div style={{ padding: '13px 10px', display: 'flex', gap: 13, justifyContent: 'flex-end', whiteSpace: 'nowrap' }}>
                    <button
                      className="v-hover-underline"
                      onClick={() => {
                        s.setQuoteDet(c)
                        s.go('cotizacionRecibo')
                      }}
                      style={{ color: 'var(--muted)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer' }}
                    >
                      Ver
                    </button>
                    {convertible && (
                      <>
                        <button
                          className="v-hover-underline"
                          onClick={() => s.convertirCotizacion(c.id)}
                          style={{ color: '#6366F1', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}
                        >
                          Convertir en venta
                        </button>
                        <button
                          className="v-hover-danger"
                          onClick={() =>
                            s.askConfirm({
                              title: `¿Anular ${c.folio}?`,
                              label:
                                'La cotización queda registrada como anulada. No afecta inventario ni caja.',
                              btnLabel: 'Anular',
                              onConfirm: () => s.anularCotizacion(c.id),
                            })
                          }
                          style={{ color: 'var(--muted)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer' }}
                        >
                          Anular
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
