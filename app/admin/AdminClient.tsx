'use client'

// Panel del super-admin (dueño de Ventory): todos los negocios registrados,
// su plan (prueba/activo/suspendido) y acciones de activación.

import { useCallback, useEffect, useMemo, useState } from 'react'
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

interface RegistroInfo {
  ip: string | null
  repetidos: number
}

interface BizRow {
  id: string
  name: string
  createdAt: string
  activatedAt: string | null
  adminNotes: string | null
  plan: PlanInfo
  pagos: PagosInfo
  registro: RegistroInfo
  owner: { name: string | null; email: string } | null
  userCount: number
  productCount: number
  customerCount: number
  salesCount: number
  lastSaleAt: string | null
}

interface ActivityEntry {
  id: string
  action: string
  businessId: string
  payload: { days?: number; notes?: string | null; name?: string } | null
  at: string
  by: string
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

const fdatetime = (d: string) =>
  new Date(d).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })

function actividadTexto(e: ActivityEntry, nombreNegocio: string) {
  switch (e.action) {
    case 'PLAN_ACTIVATE':
      return `activó el plan de ${nombreNegocio}`
    case 'PLAN_SUSPEND':
      return `suspendió ${nombreNegocio}`
    case 'PLAN_EXTEND':
      return `extendió la prueba de ${nombreNegocio} ${e.payload?.days ?? ''} días`
    case 'PLATFORM_NOTES':
      return `guardó una nota en ${nombreNegocio}`
    case 'PLATFORM_DELETE_BUSINESS':
      return `eliminó definitivamente ${nombreNegocio}`
    default:
      return `${e.action} en ${nombreNegocio}`
  }
}

type Filtro = 'todos' | 'activos' | 'prueba' | 'vencidos'

export default function AdminClient() {
  const [rows, setRows] = useState<BizRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [search, setSearch] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  // Notas privadas: negocio con el cuadro de notas abierto + su borrador
  const [notesOpenId, setNotesOpenId] = useState<string | null>(null)
  const [notesDraft, setNotesDraft] = useState('')
  const [activity, setActivity] = useState<ActivityEntry[]>([])

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/businesses')
    if (res.ok) {
      const body = await res.json()
      setRows(body.businesses)
    }
    setLoading(false)
  }, [])

  const loadActivity = useCallback(async () => {
    const res = await fetch('/api/admin/activity')
    if (res.ok) {
      const body = await res.json()
      setActivity(body.entries)
    }
  }, [])

  useEffect(() => {
    load()
    loadActivity()
  }, [load, loadActivity])

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
        await Promise.all([load(), loadActivity()])
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

  const saveNotes = async (id: string) => {
    setBusy(id)
    try {
      const res = await fetch(`/api/admin/businesses/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notesDraft }),
      })
      if (res.ok) {
        setNotesOpenId(null)
        await Promise.all([load(), loadActivity()])
        showToast('Nota guardada')
      } else {
        const body = await res.json().catch(() => null)
        showToast(body?.error ?? 'No se pudo guardar la nota')
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

  const actives = rows.filter((r) => r.plan.status === 'ACTIVE' && !r.plan.blocked).length
  const trials = rows.filter((r) => r.plan.status === 'TRIAL' && !r.plan.blocked).length
  const expired = rows.filter((r) => r.plan.blocked || r.plan.status === 'SUSPENDED').length

  const filterBtn = (f: Filtro, bg: string, fg: string): React.CSSProperties => ({
    ...chip(filtro === f ? bg : 'var(--bg)', filtro === f ? fg : 'var(--muted)'),
    cursor: 'pointer',
    border: filtro === f ? '1.5px solid transparent' : '1.5px solid var(--border)',
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (q) {
        const matches =
          r.name.toLowerCase().includes(q) ||
          r.owner?.name?.toLowerCase().includes(q) ||
          r.owner?.email?.toLowerCase().includes(q)
        if (!matches) return false
      }
      if (filtro === 'activos') return r.plan.status === 'ACTIVE' && !r.plan.blocked
      if (filtro === 'prueba') return r.plan.status === 'TRIAL' && !r.plan.blocked
      if (filtro === 'vencidos') return r.plan.blocked || r.plan.status === 'SUSPENDED'
      return true
    })
  }, [rows, search, filtro])

  const nombrePorId = useMemo(() => new Map(rows.map((r) => [r.id, r.name])), [rows])

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
            <button onClick={() => setFiltro('todos')} style={filterBtn('todos', '#EEF0FE', '#4338CA')}>
              Todos · {rows.length}
            </button>
            <button onClick={() => setFiltro('activos')} style={filterBtn('activos', '#D1FAE5', '#0B6E63')}>
              {actives} activos
            </button>
            <button onClick={() => setFiltro('prueba')} style={filterBtn('prueba', '#FDF4E5', '#B4740A')}>
              {trials} en prueba
            </button>
            <button onClick={() => setFiltro('vencidos')} style={filterBtn('vencidos', '#FDECEC', '#C9433B')}>
              {expired} vencidos/suspendidos
            </button>
          </div>
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre del negocio o correo del dueño…"
          style={{ height: 42, padding: '0 14px', border: '1.5px solid var(--border)', borderRadius: 11, background: 'var(--surface)', fontSize: 14, fontWeight: 500, maxWidth: 420 }}
        />

        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>Cargando…</div>
        ) : (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflowX: 'auto' }}>
            <div style={{ minWidth: 920 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px,1.6fr) 150px 110px 90px 110px 220px', alignItems: 'center', background: 'var(--surface2)', borderBottom: '1px solid #EEF2F7', padding: '0 10px' }}>
                {['Negocio', 'Plan', 'Registrado', 'Ventas', 'Última venta', ''].map((h) => (
                  <div key={h} style={{ padding: '12px 10px', fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.4px' }}>
                    {h}
                  </div>
                ))}
              </div>
              {filtered.map((r) => (
                <div key={r.id} style={{ borderBottom: '1px solid #EEF2F7' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px,1.6fr) 150px 110px 90px 110px 220px', alignItems: 'center', padding: '0 10px' }}>
                    <div style={{ padding: '13px 10px', minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{r.name}</div>
                      <div style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.owner ? `${r.owner.name ?? ''} · ${r.owner.email}` : 'Sin dueño'} · {r.userCount} usuario{r.userCount === 1 ? '' : 's'} · {r.productCount} prods
                      </div>
                      {r.pagos.cantidad > 0 && (
                        <div style={{ color: '#0B6E63', fontSize: 12.5, marginTop: 2, fontWeight: 600 }}>
                          {r.pagos.cantidad} pago{r.pagos.cantidad === 1 ? '' : 's'} en línea · ${r.pagos.total.toLocaleString('es-CO')} · último {fdate(r.pagos.ultimo?.fecha ?? null)}
                          {r.pagos.ultimo?.metodo ? ` (${r.pagos.ultimo.metodo})` : ''}
                        </div>
                      )}
                      {r.registro?.repetidos > 0 && r.plan.status === 'TRIAL' && (
                        <div style={{ color: '#C9433B', fontSize: 12.5, marginTop: 2, fontWeight: 700 }}>
                          Misma conexión que {r.registro.repetidos === 1 ? 'otro negocio' : `otros ${r.registro.repetidos} negocios`} — ¿prueba gratis repetida?
                        </div>
                      )}
                      {r.adminNotes && notesOpenId !== r.id && (
                        <div style={{ color: '#8A6B2E', fontSize: 12.5, marginTop: 2, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          📝 {r.adminNotes}
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
                          if (notesOpenId === r.id) {
                            setNotesOpenId(null)
                          } else {
                            setNotesOpenId(r.id)
                            setNotesDraft(r.adminNotes ?? '')
                          }
                        }}
                        style={{ ...btn('var(--bg)', 'var(--text)'), border: '1.5px solid var(--border)' }}
                      >
                        Notas
                      </button>
                    </div>
                  </div>
                  {notesOpenId === r.id && (
                    <div style={{ padding: '0 10px 14px', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <textarea
                        value={notesDraft}
                        onChange={(e) => setNotesDraft(e.target.value)}
                        placeholder="Nota privada — solo la ves tú (por ejemplo, seguimiento de un pago o una conversación)"
                        maxLength={500}
                        rows={2}
                        style={{ flex: 1, padding: '10px 12px', border: '1.5px solid var(--border)', borderRadius: 10, background: 'var(--bg)', fontSize: 13.5, fontFamily: 'inherit', resize: 'vertical' }}
                      />
                      <button disabled={busy === r.id} onClick={() => saveNotes(r.id)} style={{ ...btn('#6366F1', '#fff'), height: 40 }} className="v-hover-primary">
                        Guardar
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {!filtered.length && (
                <div style={{ padding: 50, textAlign: 'center', color: 'var(--muted)' }}>
                  {rows.length ? 'Ningún negocio coincide con la búsqueda o el filtro.' : 'Aún no hay negocios registrados.'}
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
          <b style={{ color: 'var(--text)' }}>Cómo funciona:</b> los negocios nuevos entran con 15 días de prueba. Cuando un
          cliente te pague, pulsa <b>Activar plan</b>. <b>+15 días</b> extiende la prueba (útil para negociar).{' '}
          <b>Suspender</b> bloquea las ventas de un negocio que dejó de pagar (sus datos se conservan y puedes reactivarlo).{' '}
          El aviso rojo <b>&quot;misma conexión&quot;</b> marca negocios en prueba registrados desde la misma IP que otros:
          posible prueba gratis repetida — revísalo y decide (varios negocios legítimos pueden compartir internet).
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px' }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Actividad reciente</div>
          {activity.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {activity.map((e) => (
                <div key={e.id} style={{ display: 'flex', gap: 10, fontSize: 13, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', minWidth: 118 }}>{fdatetime(e.at)}</span>
                  <span>
                    <b>{e.by}</b> {actividadTexto(e, nombrePorId.get(e.businessId) ?? e.payload?.name ?? 'un negocio')}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: 'var(--muted)', fontSize: 13.5 }}>Todavía no hay acciones registradas.</div>
          )}
        </div>
      </div>
    </div>
  )
}
