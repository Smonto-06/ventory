import { horaColombiaAUtc, ventanaHorario } from '@/lib/schedules'

describe('horaColombiaAUtc — hora de Colombia (UTC-5) a instante UTC', () => {
  it('mediodía en Colombia es 17:00 UTC', () => {
    const d = horaColombiaAUtc('2026-03-10', '12:00')
    expect(d.toISOString()).toBe('2026-03-10T17:00:00.000Z')
  })
  it('medianoche en Colombia es 05:00 UTC del mismo día', () => {
    const d = horaColombiaAUtc('2026-03-10', '00:00')
    expect(d.toISOString()).toBe('2026-03-10T05:00:00.000Z')
  })
})

describe('ventanaHorario — ventana de un horario de trabajo', () => {
  it('turno normal (entrada antes que salida, mismo día)', () => {
    const { startsAt, endsAt } = ventanaHorario('2026-03-10', '08:00', '17:00')
    expect(startsAt.toISOString()).toBe('2026-03-10T13:00:00.000Z')
    expect(endsAt.toISOString()).toBe('2026-03-10T22:00:00.000Z')
  })
  it('turno nocturno (salida antes o igual que la entrada) termina al día siguiente', () => {
    const { startsAt, endsAt } = ventanaHorario('2026-03-10', '22:00', '06:00')
    expect(startsAt.toISOString()).toBe('2026-03-11T03:00:00.000Z')
    expect(endsAt.toISOString()).toBe('2026-03-11T11:00:00.000Z')
  })
  it('entrada y salida iguales también se toman como 24h (nocturno completo)', () => {
    const { startsAt, endsAt } = ventanaHorario('2026-03-10', '09:00', '09:00')
    expect(endsAt.getTime() - startsAt.getTime()).toBe(24 * 60 * 60 * 1000)
  })
})
