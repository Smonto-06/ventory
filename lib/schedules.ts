import { db } from '@/lib/db'

// Colombia es UTC-5 todo el año (sin horario de verano) — mismo supuesto que
// diaColombiano/diaColombianoDeFecha en lib/pos.ts.
const OFFSET_MIN = 5 * 60

/** Convierte una fecha ("YYYY-MM-DD") + hora ("HH:mm") en horario de Colombia a su instante UTC real. */
export function horaColombiaAUtc(fechaISO: string, horaHHmm: string): Date {
  const [y, m, d] = fechaISO.split('-').map(Number)
  const [hh, mm] = horaHHmm.split(':').map(Number)
  return new Date(Date.UTC(y, m - 1, d, hh, mm) + OFFSET_MIN * 60_000)
}

/**
 * Ventana de un horario de trabajo a partir de fecha + hora de entrada/salida
 * en horario de Colombia. Si la salida cae en o antes de la entrada (turno
 * nocturno, p. ej. 22:00 a 06:00), se asume que termina al día SIGUIENTE.
 */
export function ventanaHorario(
  fechaISO: string,
  entrada: string,
  salida: string,
): { startsAt: Date; endsAt: Date } {
  const startsAt = horaColombiaAUtc(fechaISO, entrada)
  let endsAt = horaColombiaAUtc(fechaISO, salida)
  if (endsAt.getTime() <= startsAt.getTime()) {
    endsAt = new Date(endsAt.getTime() + 24 * 60 * 60_000)
  }
  return { startsAt, endsAt }
}

/**
 * ¿Hay un EmployeeSchedule de este usuario que cubra AHORA? Usado por login
 * normal (lib/auth.ts) y por PIN (app/api/auth/pin-login/route.ts) — la
 * decisión de si hace falta revisar esto (ADMIN nunca se restringe,
 * Business.scheduleLoginEnforced debe estar prendido) la toma cada caller,
 * porque cada uno tiene el usuario/negocio ya cargado de forma distinta.
 */
export async function tieneHorarioAhora(userId: string, now: Date = new Date()): Promise<boolean> {
  const match = await db.employeeSchedule.findFirst({
    where: { userId, startsAt: { lte: now }, endsAt: { gte: now } },
    select: { id: true },
  })
  return !!match
}
