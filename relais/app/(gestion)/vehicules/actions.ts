'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAction } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { recordPastAssignment, reviewInspection, setVehicleStatus } from '@/lib/data/operations';
import { type VehicleInput, correctOdometer, createVehicle, updateVehicle } from '@/lib/data/records';
import { parisLocalToIso } from '@/lib/domain/dates';
import { ENERGIES, VEHICLE_TYPES } from '@/lib/domain/labels';
import { FieldError, type FormState, date, id, int, oneOf, optDate, optInt, optText, text, time, toFormState } from '@/lib/forms';

function vehicleInput(formData: FormData): VehicleInput {
  const year = optInt(formData, 'year', 'Année');
  if (year !== null && (year < 1990 || year > 2100)) throw new FieldError('Année invalide.');
  return {
    plate: text(formData, 'plate', 'Immatriculation', 20),
    vin: optText(formData, 'vin', 17)?.toUpperCase() ?? null,
    brand: optText(formData, 'brand', 60),
    model: optText(formData, 'model', 60),
    year,
    type: oneOf(formData, 'type', VEHICLE_TYPES, 'Type'),
    energy: oneOf(formData, 'energy', ENERGIES, 'Énergie'),
    first_registration_on: optDate(formData, 'first_registration_on', 'Première immatriculation'),
    initial_km: optInt(formData, 'initial_km', 'Kilométrage initial') ?? 0,
    owner: optText(formData, 'owner', 120),
    notes: optText(formData, 'notes', 2000),
    insurer: optText(formData, 'insurer', 120),
    insurance_policy: optText(formData, 'insurance_policy', 60),
    insurance_start_on: optDate(formData, 'insurance_start_on', 'Début d’assurance'),
    insurance_end_on: optDate(formData, 'insurance_end_on', 'Échéance d’assurance'),
    ct_last_on: optDate(formData, 'ct_last_on', 'Dernier contrôle technique'),
    ct_expires_on: optDate(formData, 'ct_expires_on', 'Échéance du contrôle technique'),
  };
}

export async function createVehicleAction(_: FormState, formData: FormData): Promise<FormState> {
  let newId: number | undefined;
  try {
    const ctx = await requireAction('vehicule.modifier');
    const result = createVehicle(getDb(), ctx, vehicleInput(formData));
    if (result.error) return { error: result.error };
    newId = result.id;
  } catch (error) {
    return toFormState(error);
  }
  revalidatePath('/vehicules');
  redirect(`/vehicules/${newId}`);
}

export async function updateVehicleAction(_: FormState, formData: FormData): Promise<FormState> {
  const vehicleId = Number(formData.get('vehicleId'));
  try {
    const ctx = await requireAction('vehicule.modifier');
    const error = updateVehicle(getDb(), ctx, vehicleId, vehicleInput(formData));
    if (error) return { error };
  } catch (error) {
    return toFormState(error);
  }
  revalidatePath('/vehicules');
  redirect(`/vehicules/${vehicleId}`);
}

export async function setVehicleStatusAction(_: FormState, formData: FormData): Promise<FormState> {
  try {
    const ctx = await requireAction('vehicule.debloquer');
    const status = oneOf(formData, 'status', [{ value: 'disponible' }, { value: 'immobilise' }, { value: 'sorti' }] as const, 'Statut');
    if (status === 'sorti') await requireAction('vehicule.modifier');
    const error = setVehicleStatus(getDb(), ctx, id(formData, 'vehicleId'), status, optText(formData, 'reason', 300) ?? '');
    if (error) return { error };
    revalidatePath('/vehicules', 'layout');
    revalidatePath('/aujourdhui');
    return { ok: 'Statut mis à jour.' };
  } catch (error) {
    return toFormState(error);
  }
}

export async function reviewInspectionAction(_: FormState, formData: FormData): Promise<FormState> {
  try {
    const ctx = await requireAction('vehicule.debloquer');
    const decision = oneOf(formData, 'decision', [{ value: 'autoriser' }, { value: 'refuser' }] as const, 'Décision');
    const error = reviewInspection(getDb(), ctx, id(formData, 'inspectionId'), decision, optText(formData, 'note', 500) ?? '');
    if (error) return { error };
    revalidatePath('/vehicules', 'layout');
    revalidatePath('/aujourdhui');
    return { ok: decision === 'autoriser' ? 'Départ autorisé.' : 'Départ refusé. Le véhicule reste bloqué.' };
  } catch (error) {
    return toFormState(error);
  }
}

export async function correctOdometerAction(_: FormState, formData: FormData): Promise<FormState> {
  try {
    const ctx = await requireAction('vehicule.modifier');
    const error = correctOdometer(getDb(), ctx, id(formData, 'vehicleId'), int(formData, 'km', 'Kilométrage'), optText(formData, 'reason', 300) ?? '');
    if (error) return { error };
    revalidatePath('/vehicules', 'layout');
    return { ok: 'Kilométrage corrigé.' };
  } catch (error) {
    return toFormState(error);
  }
}

export async function recordPastAssignmentAction(_: FormState, formData: FormData): Promise<FormState> {
  try {
    const ctx = await requireAction('vehicule.debloquer');
    const day = date(formData, 'day', 'Date');
    const endDay = optDate(formData, 'endDay', 'Date de fin') ?? day;
    const error = recordPastAssignment(getDb(), ctx, {
      vehicleId: id(formData, 'vehicleId'),
      employeeId: id(formData, 'employeeId'),
      startedAt: parisLocalToIso(day, time(formData, 'start', 'Heure de début')),
      endedAt: parisLocalToIso(endDay, time(formData, 'end', 'Heure de fin')),
    });
    if (error) return { error };
    revalidatePath('/vehicules', 'layout');
    revalidatePath('/amendes', 'layout');
    return { ok: 'Affectation enregistrée.' };
  } catch (error) {
    return toFormState(error);
  }
}
