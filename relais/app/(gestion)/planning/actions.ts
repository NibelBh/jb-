'use server';

import { revalidatePath } from 'next/cache';
import { requireAction } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { addAbsence, addRoute, assignRoute, deleteAbsence, deleteRoute, importRoutes, setDayStatus } from '@/lib/data/planning';
import { parisDate } from '@/lib/domain/dates';
import { ABSENCE_TYPES, DAY_STATUSES } from '@/lib/domain/labels';
import { type FormState, csvInput, date, id, oneOf, optId, optText, text, toFormState } from '@/lib/forms';

function done(message?: string): FormState {
  revalidatePath('/planning');
  revalidatePath('/aujourdhui');
  return message ? { ok: message } : undefined;
}

export async function assignRouteAction(_: FormState, formData: FormData): Promise<FormState> {
  try {
    const ctx = await requireAction('planning.modifier');
    const error = assignRoute(getDb(), ctx, {
      routeId: id(formData, 'routeId'),
      employeeId: optId(formData, 'employeeId'),
      vehicleId: optId(formData, 'vehicleId'),
    });
    return error ? { error } : done('Affectation enregistrée.');
  } catch (error) {
    return toFormState(error);
  }
}

export async function addRouteAction(_: FormState, formData: FormData): Promise<FormState> {
  try {
    const ctx = await requireAction('planning.modifier');
    const startTime = optText(formData, 'startTime', 5);
    const error = addRoute(getDb(), ctx, {
      day: date(formData, 'day', 'Jour'),
      code: text(formData, 'code', 'Code de tournée', 40),
      client: optText(formData, 'client', 80),
      depot: optText(formData, 'depot', 80),
      startTime: startTime && /^\d{2}:\d{2}$/.test(startTime) ? startTime : null,
    });
    return error ? { error } : done('Tournée ajoutée.');
  } catch (error) {
    return toFormState(error);
  }
}

export async function deleteRouteAction(_: FormState, formData: FormData): Promise<FormState> {
  try {
    const ctx = await requireAction('planning.modifier');
    deleteRoute(getDb(), ctx, id(formData, 'routeId'));
    return done();
  } catch (error) {
    return toFormState(error);
  }
}

export async function importRoutesAction(_: FormState, formData: FormData): Promise<FormState> {
  try {
    const ctx = await requireAction('planning.modifier');
    const day = date(formData, 'day', 'Jour');
    const content = await csvInput(formData);
    const report = importRoutes(getDb(), ctx, day, content);
    if (report.created + report.updated === 0 && report.errors.length > 0) return { error: 'Aucune tournée importée.', details: report.errors };
    done();
    return {
      ok: `${report.created} tournée(s) créée(s), ${report.updated} mise(s) à jour, ${report.assigned} affectation(s).`,
      details: report.errors,
    };
  } catch (error) {
    return toFormState(error);
  }
}

export async function setDayStatusAction(_: FormState, formData: FormData): Promise<FormState> {
  try {
    const ctx = await requireAction('planning.modifier');
    const error = setDayStatus(getDb(), ctx, date(formData, 'day', 'Jour'), id(formData, 'employeeId'), oneOf(formData, 'status', DAY_STATUSES, 'Statut'));
    return error ? { error } : done();
  } catch (error) {
    return toFormState(error);
  }
}

export async function addAbsenceAction(_: FormState, formData: FormData): Promise<FormState> {
  try {
    const ctx = await requireAction('absence.modifier');
    const startOn = date(formData, 'startOn', 'Début');
    const endOn = String(formData.get('endOn') ?? '') ? date(formData, 'endOn', 'Fin') : startOn;
    const error = addAbsence(
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
    if (error) return { error };
    revalidatePath('/personnel');
    return done('Absence enregistrée.');
  } catch (error) {
    return toFormState(error);
  }
}

export async function deleteAbsenceAction(_: FormState, formData: FormData): Promise<FormState> {
  try {
    const ctx = await requireAction('absence.modifier');
    deleteAbsence(getDb(), ctx, id(formData, 'absenceId'));
    revalidatePath('/personnel');
    return done();
  } catch (error) {
    return toFormState(error);
  }
}
