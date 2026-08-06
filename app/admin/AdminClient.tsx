'use client'

// Panel del super-admin (dueño de Ventory): todos los negocios registrados,
// su plan (prueba/activo/suspendido) y acciones de activación.

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'

interface PlanInfo {
  status: 'TRIAL' | 'ACTIVE' | 'SUSPENDED'
  trialEndsAt: string | null
  /** Vigencia pagada por Wompi; null en ACTIVE = activación manual sin vencer */
  paidUntil: string | null
  daysLeft: number | null
  blocked: boolean
}

interface PagosInfo {
  cantidad: number
  total: number
  ultimo: { fecha: string | null; metodo: string | null; valor: number } | null
}

interface BizRow {
  id: string
  name: string
  createdAt: string
  activatedAt: string | null
  adminNotes: string | null
  plan: PlanInfo
  pagos: PagosInfo
  owner: { name: string | null; email: string } | null
  userCount: number
  productCount: number
  customerCount: number
  salesCount: number
  lastSaleAt: string | null
}

const chip = (bg: string, fg: string): React.CSSProperties => ({
  display: 'inline-block',
  padding: '4px 10px',
  borderRadius: 8,
  fontSize: 12.5,
  fontWeight: 700,
  background: bg,
  color: fg,
  whiteSpace: 'nowrap',
})

function planChip(plan: PlanInfo) {
  if (plan.status === 'ACTIVE') {
    if (!plan.paidUntil) return <span style={chip('#D1FAE5', '#0B6E63')}>Activo</span>
    if (plan.blocked) return <span style={chip('#FDECEC', '#C9433B')}>Mensualidad vencida</span>
    return <span style={chip('#D1FAE5', '#0B6E63')}>Pagado · {plan.daysLeft} {plan.daysLeft === 1 ? 'día' : 'días'}</span>
  }
  if (plan.status === 'SUSPENDED') return <span style={chip('#FDECEC', '#C9433B')}>Suspendido</span>
  if (plan.blocked) return <span style={chip('#FDECEC', '#C9433B')}>Prueba vencida</span>
  return <span style={chip('#FDF4E5', '#B4740A')}>Prueba · {plan.daysLeft} {plan.daysLeft === 1 ? 'día' : 'días'}</span>
}

const fdate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

export default function AdminClient() {
  const [rows, setRows] = useState<BizRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  // Eliminación definitiva: negocio seleccionado + nombre digitado como confirmación
  const [del, setDel] = useState<BizRow | null>(null)
  const [delName, setDelName] = useState('')

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/businesses')
    if (res.ok) {
      const body = await res.json()
      setRows(body.businesses)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2600)
  }

  const act = async (id: string, action: 'activate' | 'suspend' | 'extend', days = 15) => {
    setBusy(id)
    try {
      const res = await fetch(`/api/admin/businesses/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, days }),
      })
      if (res.ok) {
        await load()
        showToast(
          action === 'activate' ? 'Plan activado ✓' : action === 'suspend' ? 'Negocio suspendido' : `Prueba extendida ${days} días`,
        )
      } else {
        const body = await res.json().catch(() => null)
        showToast(body?.error ?? 'No se pudo aplicar la acción')
      }
    } finally {
      setBusy(null)
    }
  }

  const doDelete = async () => {
    if (!del || delName.trim() !== del.name.trim()) return
    setBusy(del.id)
    try {
      const res = await fetch(`/api/admin/businesses/${del.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: delName.trim() }),
      })
      const body = await res.json().catch(() => null)
      if (res.ok) {
        setDel(null)
        setDelName('')
        await load()
        showToast(`Cuenta "${body?.name ?? ''}" eliminada definitivamente`)
      } else {
        showToast(body?.error ?? 'No se pudo eliminar la cuenta')
      }
    } finally {
      setBusy(null)
    }
  }

  const btn = (bg: string, fg: string): React.CSSProperties => ({
    height: 34,
    padding: '0 12px',
    borderRadius: 9,
    background: bg,
    color: fg,
    fontWeight: 700,
    fontSize: 12.5,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  })

  const actives = rows.filter((r) => r.plan.status === 'ACTIVE').length
  const trials = rows.filter((r) => r.plan.status === 'TRIAL' && !r.plan.blocked).length
  const expired = rows.filter((r) => r.plan.blocked).length

  return (
    <div className="vapp" data-theme="light" style={{ minHeight: '100vh' }}>
      {toast && (
        <div style={{ position: 'fixed', bottom: 18, left: '50%', transform: 'translateX(-50%)', zIndex: 200, background: '#0F172A', color: '#fff', fontWeight: 700, fontSize: 13.5, padding: '11px 18px', borderRadius: 12, boxShadow: '0 14px 34px -10px rgba(15,29,27,.6)', animation: 'vfade .25s ease' }}>
          {toast}
        </div>
      )}

      <header style={{ height: 60, background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, padding: '0 clamp(14px,3vw,26px)', position: 'sticky', top: 0, zIndex: 20 }}>
        <Image src="/brand/ventory-icon.png" alt="Ventory" width={30} height={30} />
        <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-.3px' }}>
          Ventory <span style={{ color: '#6366F1' }}>· Panel de plataforma</span>
        </div>
        <div style={{ flex: 1 }} />
        <Link href="/app" style={{ color: 'var(--muted)', fontWeight: 600, fontSize: 14 }}>
          Ir a mi POS →
        </Link>
      </header>

      <div style={{ padding: 'clamp(16px,3vw,28px)', display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-.4px' }}>Negocios registrados</h1>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={chip('#D1FAE5', '#0B6E63')}>{actives} activos</span>
            <span style={chip('#FDF4E5', '#B4740A')}>{trials} en prueba</span>
            <span style={chip('#FDECEC', '#C9433B')}>{expired} vencidos/suspendidos</span>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>Cargando…</div>
        ) : (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflowX: 'auto' }}>
            <div style={{ minWidth: 920 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px,1.6fr) 150px 110px 90px 110px 260px', alignItems: 'center', background: 'var(--surface2)', borderBottom: '1px solid #EEF2F7', padding: '0 10px' }}>
                {['Negocio', 'Plan', 'Registrado', 'Ventas', 'Última venta', ''].map((h) => (
                  <div key={h} style={{ padding: '12px 10px', fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.4px' }}>
                    {h}
                  </div>
                ))}
              </div>
              {rows.map((r) => (
                <div key={r.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(200px,1.6fr) 150px 110px 90px 110px 260px', alignItems: 'center', borderBottom: '1px solid #EEF2F7', padding: '0 10px' }}>
                  <div style={{ padding: '13px 10px', minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{r.name}</div>
                    <div style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.owner ? `${r.owner.name ?? ''} · ${r.owner.email}` : 'Sin dueño'} · {r.userCount} usuario{r.userCount === 1 ? '' : 's'} · {r.productCount} prods
                    </div>
                    {r.pagos.cantidad > 0 && (
                      <div style={{ color: '#0B6E63', fontSize: 12.5, marginTop: 2, fontWeight: 600 }}>
                        {r.pagos.cantidad} pago{r.pagos.cantidad === 1 ? '' : 's'} Wompi · ${r.pagos.total.toLocaleString('es-CO')} · último {fdate(r.pagos.ultimo?.fecha ?? null)}
                        {r.pagos.ultimo?.metodo ? ` (${r.pagos.ultimo.metodo})` : ''}
                      </div>
                    )}
                  </div>
                  <div style={{ padding: '13px 10px' }}>{planChip(r.plan)}</div>
                  <div style={{ padding: '13px 10px', fontSize: 13, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{fdate(r.createdAt)}</div>
                  <div style={{ padding: '13px 10px', fontSize: 13.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{r.salesCount}</div>
                  <div style={{ padding: '13px 10px', fontSize: 13, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{fdate(r.lastSaleAt)}</div>
                  <div style={{ padding: '13px 10px', display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    {(r.plan.status !== 'ACTIVE' || r.plan.blocked) && (
                      <button disabled={busy === r.id} onClick={() => act(r.id, 'activate')} style={btn('#6366F1', '#fff')} className="v-hover-primary">
                        Activar plan
                      </button>
                    )}
                    {r.plan.status !== 'ACTIVE' && (
                      <button disabled={busy === r.id} onClick={() => act(r.id, 'extend', 15)} style={btn('#FDF4E5', '#B4740A')}>
                        +15 días
                      </button>
                    )}
                    {r.plan.status !== 'SUSPENDED' && (
                      <button disabled={busy === r.id} onClick={() => act(r.id, 'suspend')} style={btn('#FDECEC', '#C9433B')}>
                        Suspender
                      </button>
                    )}
                    <button
                      disabled={busy === r.id}
                      onClick={() => {
                        setDel(r)
                        setDelName('')
                      }}
                      title="Eliminar la cuenta y todos sus datos"
                      style={{ ...btn('transparent', '#C9433B'), border: '1.5px solid #F3C6C2' }}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
              {!rows.length && <div style={{ padding: 50, textAlign: 'center', color: 'var(--muted)' }}>Aún no hay negocios registrados.</div>}
            </div>
          </div>
        )}

        <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
          <b style={{ color: 'var(--text)' }}>Cómo funciona:</b> los negocios nuevos entran con 15 días de prueba. Cuando un
          cliente te pague, pulsa <b>Activar plan</b>. <b>+15 días</b> extiende la prueba (útil para negociar).{' '}
          <b>Suspender</b> bloquea las ventas de un negocio que dejó de pagar (sus datos se conservan y puedes reactivarlo).{' '}
          <b>Eliminar</b> borra la cuenta y todos sus datos de forma definitiva — úsalo solo cuando estés seguro.
        </div>
      </div>

      {del && (
        <div
          onClick={() => setDel(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,25,23,.5)', zIndex: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 460, background: 'var(--surface)', borderRadius: 18, padding: 24, boxShadow: '0 30px 60px -30px rgba(15,25,23,.6)', animation: 'vpop .25s ease' }}
          >
            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, letterSpacing: '-.3px', color: '#C9433B' }}>
              Eliminar cuenta definitivamente
            </h2>
            <div style={{ marginTop: 12, fontSize: 14, lineHeight: 1.65 }}>
              Vas a eliminar <b>{del.name}</b> ({del.owner?.email ?? 'sin dueño'}). Se borrarán para siempre:
            </div>
            <ul style={{ margin: '10px 0 0', paddingLeft: 20, fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.7 }}>
              <li>{del.userCount} usuario{del.userCount === 1 ? '' : 's'} (ya no podrán iniciar sesión)</li>
              <li>{del.salesCount} venta{del.salesCount === 1 ? '' : 's'} y todo su historial de caja</li>
              <li>{del.productCount} producto{del.productCount === 1 ? '' : 's'} e inventario</li>
              <li>{del.customerCount} cliente{del.customerCount === 1 ? '' : 's'}, proveedores y compras</li>
            </ul>
            <div style={{ marginTop: 14, background: '#FDECEC', borderRadius: 11, padding: '10px 14px', fontSize: 13, color: '#C9433B', fontWeight: 700 }}>
              Esta acción no se puede deshacer. Si solo quieres bloquear el acceso, usa Suspender.
            </div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, margin: '16px 0 6px' }}>
              Escribe el nombre exacto del negocio para confirmar:
            </label>
            <input
              value={delName}
              onChange={(e) => setDelName(e.target.value)}
              placeholder={del.name}
              style={{ width: '100%', height: 46, padding: '0 14px', border: '1.5px solid var(--border)', borderRadius: 11, background: 'var(--input)', fontSize: 14.5, fontWeight: 600 }}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button
                onClick={() => setDel(null)}
                style={{ flex: 1, height: 48, borderRadius: 12, background: 'var(--bg)', color: 'var(--text)', fontWeight: 700, fontSize: 14.5, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={doDelete}
                disabled={delName.trim() !== del.name.trim() || busy === del.id}
                style={{
                  flex: 1.4,
                  height: 48,
                  borderRadius: 12,
                  fontWeight: 800,
                  fontSize: 14.5,
                  color: '#fff',
                  background: delName.trim() === del.name.trim() ? '#C9433B' : '#E5A9A4',
                  cursor: delName.trim() === del.name.trim() ? 'pointer' : 'not-allowed',
                  boxShadow: delName.trim() === del.name.trim() ? '0 8px 18px -8px #C9433Bcc' : undefined,
                }}
              >
                {busy === del.id ? 'Eliminando…' : 'Eliminar para siempre'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
