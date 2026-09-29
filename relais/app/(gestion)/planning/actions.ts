'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAction } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { addAbsence, confirmPresence, createShifts, deleteAbsence, deleteShift, markAbsent, reassignShift, updateShift } from '@/lib/data/planning';
import { addDays, parisDate } from '@/lib/domain/dates';
import { ABSENCE_TYPES } from '@/lib/domain/labels';
import { normalizeTime } from '@/lib/domain/shifts';
import { FieldError, type FormState, date, id, oneOf, optDate, optId, optText, toFormState } from '@/lib/forms';

function done(message?: string, details?: string[]): FormState {
  revalidatePath('/planning');
  revalidatePath('/aujourdhui');
  revalidatePath('/paie');
  revalidatePath('/personnel');
  return message ? { ok: message, details } : undefined;
}

function hour(formData: FormData, name: string, label: string): string {
  const value = normalizeTime(String(formData.get(name) ?? ''));
  if (!value) throw new FieldError(`Le champ « ${label} » doit être une heure valide (ex. 08:00).`);
  return value;
}

function shiftFields(formData: FormData) {
  return {
    employeeId: optId(formData, 'employeeId'),
    startTime: hour(formData, 'startTime', 'Début'),
    endTime: hour(formData, 'endTime', 'Fin'),
    routeName: optText(formData, 'routeName', 40)?.toUpperCase() ?? null,
    vehicleId: optId(formData, 'vehicleId'),
    notes: optText(formData, 'notes', 300),
  };
}

/** Jours concernés : le jour choisi, ou chaque jour coché de la semaine jusqu'à la date de fin. */
function daysOf(formData: FormData): string[] {
  const first = date(formData, 'day', 'Jour');
  const until = optDate(formData, 'repeatUntil', 'Répéter jusqu’au');
  if (!until || until === first) return [first];
  if (until < first) throw new FieldError('La date de fin de répétition doit être après le jour choisi.');
  const weekdays = new Set(formData.getAll('weekdays').map(String));
  const days: string[] = [];
  for (let d = first; d <= until && days.length < 62; d = addDays(d, 1)) {
    const weekday = String(new Date(`${d}T12:00:00Z`).getUTCDay());
    if (weekdays.size === 0 || weekdays.has(weekday)) days.push(d);
  }
  return days;
}

export async function createShiftAction(_: FormState, formData: FormData): Promise<FormState> {
  try {
    const ctx = await requireAction('planning.modifier');
    const result = createShifts(getDb(), ctx, shiftFields(formData), daysOf(formData));
    if (result.error) return { error: result.error, details: result.skipped };
    return done(
      result.created > 1 ? `${result.created} planifications créées.` : 'Planification créée.',
      result.skipped.length ? [`Jours non planifiés :`, ...result.skipped] : undefined,
    );
  } catch (error) {
    return toFormState(error);
  }
}

export async function updateShiftAction(_: FormState, formData: FormData): Promise<FormState> {
  let day: string;
  try {
    const ctx = await requireAction('planning.modifier');
    day = date(formData, 'day', 'Jour');
    const error = updateShift(getDb(), ctx, id(formData, 'shiftId'), { ...shiftFields(formData), day });
    if (error) return { error };
    done();
  } catch (error) {
    return toFormState(error);
  }
  redirect(`/planning?jour=${day}`);
}

export async function deleteShiftAction(_: FormState, formData: FormData): Promise<FormState> {
  try {
    const ctx = await requireAction('planning.modifier');
    const error = deleteShift(getDb(), ctx, id(formData, 'shiftId'));
    return error ? { error } : done('Planification supprimée.');
  } catch (error) {
    return toFormState(error);
  }
}

export async function reassignShiftAction(_: FormState, formData: FormData): Promise<FormState> {
  let day: string;
  try {
    const ctx = await requireAction('planning.modifier');
    day = date(formData, 'day', 'Jour');
    const error = reassignShift(getDb(), ctx, id(formData, 'shiftId'), id(formData, 'employeeId'));
    if (error) return { error };
    done();
  } catch (error) {
    return toFormState(error);
  }
  redirect(`/planning?jour=${day}`);
}

export async function confirmPresenceAction(_: FormState, formData: FormData): Promise<FormState> {
  try {
    const ctx = await requireAction('presence.confirmer');
    const error = confirmPresence(getDb(), ctx, id(formData, 'shiftId'), {
      start: hour(formData, 'start', 'Arrivée'),
      end: hour(formData, 'end', 'Départ'),
    });
    return error ? { error } : done('Présence confirmée.');
  } catch (error) {
    return toFormState(error);
  }
}

export async function markAbsentAction(_: FormState, formData: FormData): Promise<FormState> {
  try {
    const ctx = await requireAction('absence.modifier');
    const error = markAbsent(getDb(), ctx, id(formData, 'shiftId'), oneOf(formData, 'type', ABSENCE_TYPES, 'Motif'), optText(formData, 'note', 300));
    return error ? { error } : done('Absence enregistrée : le créneau est à couvrir.');
  } catch (error) {
    return toFormState(error);
  }
}

export async function addAbsenceAction(_: FormState, formData: FormData): Promise<FormState> {
  try {
    const ctx = await requireAction('absence.modifier');
    const startOn = date(formData, 'startOn', 'Début');
    const endOn = String(formData.get('endOn') ?? '') ? date(formData, 'endOn', 'Fin') : startOn;
    const result = addAbsence(
      getDb(),
      ctx,
      {
        employeeId: id(formData, 'employeeId'),
        type: oneOf(formData, 'type', ABSENCE_TYPES, 'Type'),
        startOn,
        endOn,
        note: optText(formData, 'note', 500),
      },
      parisDate(),
    );
    if (result.error) return { error: result.error };
    return done(result.freed ? `Absence enregistrée. ${result.freed} créneau(x) libéré(s), à couvrir dans le planning.` : 'Absence enregistrée.');
  } catch (error) {
    return toFormState(error);
  }
}

export async function deleteAbsenceAction(_: FormState, formData: FormData): Promise<FormState> {
  try {
    const ctx = await requireAction('absence.modifier');
    deleteAbsence(getDb(), ctx, id(formData, 'absenceId'));
    return done();
  } catch (error) {
    return toFormState(error);
  }
}
