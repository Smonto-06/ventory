'use client'

// Horarios de trabajo de un empleado (Ajustes → Usuarios → Horarios): el
// administrador asigna ventanas de fecha + hora de entrada/salida. Si el
// interruptor de Ajustes está prendido, el empleado (no ADMIN) solo puede
// iniciar sesión dentro de una de estas ventanas — ver lib/schedules.ts.
// Una sesión ya abierta sigue funcionando aunque la ventana termine; el
// horario solo se revisa al momento de entrar.

import { useEffect, useState } from 'react'
import { useApp } from '../store'
import { api, ApiError, type Schedule } from '../api'
import { Modal, ModalTitle, labelStyle, inputStyle, saveBtnStyle } from '../ui'

const fmtFecha = (iso: string) =>
  new Date(iso).toLocaleString('es-CO', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

const fmtHora = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true })

export default function HorariosModal() {
  const s = useApp()
  const empleado = s.users.find((u) => u.id === s.editUserId)

  const [schedules, setSchedules] = useState<Schedule[] | null>(null)
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [enviando, setEnviando] = useState(false)

  const cargar = () => {
    if (!empleado) return
    api
      .schedules(empleado.id)
      .then((r) => setSchedules(r.schedules))
      .catch(() => setSchedules([]))
  }

  useEffect(cargar, [empleado?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!empleado) return null

  const ok = !!date && !!startTime && !!endTime && !enviando

  const agregar = async () => {
    if (!ok) return
    setEnviando(true)
    try {
      await api.createSchedule({ userId: empleado.id, date, startTime, endTime })
      setDate('')
      setStartTime('')
      setEndTime('')
      cargar()
    } catch (e) {
      s.toast(e instanceof ApiError ? e.message : 'No se pudo agregar el horario')
    } finally {
      setEnviando(false)
    }
  }

  const eliminar = (id: string) => {
    s.askConfirm({
      title: '¿Eliminar este horario?',
      label: 'El empleado ya no podrá iniciar sesión en esta ventana (si el interruptor de horarios está prendido).',
      btnLabel: 'Eliminar',
      onConfirm: async () => {
        try {
          await api.deleteSchedule(id)
          setSchedules((prev) => prev?.filter((h) => h.id !== id) ?? null)
        } catch (e) {
          s.toast(e instanceof ApiError ? e.message : 'No se pudo eliminar')
        }
      },
    })
  }

  return (
    <Modal onClose={s.closeModal} maxWidth={460}>
      <ModalTitle onClose={s.closeModal}>Horarios de {empleado.name || empleado.email}</ModalTitle>

      {!s.settings?.scheduleLoginEnforced && (
        <div style={{ fontSize: 12.5, color: 'var(--muted)', background: 'var(--bg)', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
          El interruptor &ldquo;Restringir inicio de sesión por horario&rdquo; está apagado en Ajustes: por ahora estos horarios son solo informativos y no bloquean el ingreso.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <div>
          <label style={labelStyle}>Fecha</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Entrada</label>
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Salida</label>
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} style={inputStyle} />
        </div>
      </div>
      {!!startTime && !!endTime && endTime <= startTime && (
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
          La salida es antes (o igual) que la entrada: se toma como turno nocturno, hasta esa hora del día siguiente.
        </div>
      )}
      <button onClick={agregar} disabled={!ok} style={{ ...saveBtnStyle(ok), width: '100%', height: 42, marginTop: 10 }}>
        Agregar horario
      </button>

      <div style={{ marginTop: 16, fontSize: 12.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.4px' }}>
        Horarios asignados
      </div>
      <div style={{ marginTop: 8, maxHeight: 280, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 12 }}>
        {schedules === null && <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13.5 }}>Cargando…</div>}
        {schedules?.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13.5 }}>Sin horarios asignados todavía.</div>
        )}
        {schedules?.map((h) => (
          <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid #EEF2F7' }}>
            <div style={{ flex: 1, fontSize: 13.5 }}>
              <div style={{ fontWeight: 700 }}>{fmtFecha(h.startsAt)}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>hasta {fmtHora(h.endsAt)}</div>
            </div>
            <button
              onClick={() => eliminar(h.id)}
              title="Eliminar"
              style={{ height: 34, padding: '0 12px', borderRadius: 9, background: '#FDECEC', color: '#C9433B', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}
            >
              Eliminar
            </button>
          </div>
        ))}
      </div>
    </Modal>
  )
}
