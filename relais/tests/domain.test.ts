import { describe, expect, it } from 'vitest';
import { parseCsv, toCsv } from '@/lib/domain/csv';
import { addDays, addYears, daysBetween, formatDateTime, parisDate, parisLocalToIso, startOfWeek } from '@/lib/domain/dates';
import { expiryStatus, technicalInspectionDue } from '@/lib/domain/documents';
import { designationDeadline, findDriverAt, fineUrgency } from '@/lib/domain/fines';
import { checkOdometer, worstResult } from '@/lib/domain/inspection';
import { hashPassword, passwordProblem, verifyPassword } from '@/lib/domain/password';
import { type Candidate, rankReplacements } from '@/lib/domain/replacement';
import { can, canAccess, parseRoles } from '@/lib/domain/roles';

describe('dates', () => {
  it('ajoute des jours et des années, y compris le 29 février', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addYears('2024-02-29', 1)).toBe('2025-02-28');
    expect(addYears('2022-06-15', 4)).toBe('2026-06-15');
    expect(daysBetween('2026-09-29', '2026-10-29')).toBe(30);
  });

  it('convertit l’heure de Paris en UTC selon la saison', () => {
    expect(parisLocalToIso('2026-07-01', '07:30')).toBe('2026-07-01T05:30:00.000Z');
    expect(parisLocalToIso('2026-01-15', '07:30')).toBe('2026-01-15T06:30:00.000Z');
    expect(parisDate(new Date('2026-09-28T23:30:00Z'))).toBe('2026-09-29');
  });

  it('formate en français', () => {
    expect(formatDateTime('2026-09-12T05:32:00Z')).toBe('12/09/2026 à 07 h 32');
    expect(startOfWeek('2026-10-04')).toBe('2026-09-28');
  });
});

describe('échéances', () => {
  it('classe les documents par palier d’alerte', () => {
    const today = '2026-09-29';
    expect(expiryStatus('2026-09-20', today).level).toBe('expire');
    expect(expiryStatus('2026-10-03', today).level).toBe('j7');
    expect(expiryStatus('2026-10-10', today).level).toBe('j15');
    expect(expiryStatus('2026-10-25', today).level).toBe('j30');
    expect(expiryStatus('2026-12-01', today).level).toBe('j90');
    expect(expiryStatus('2027-06-01', today).level).toBe('ok');
    expect(expiryStatus(null, today).level).toBe('sans_date');
  });

  it('calcule le contrôle technique d’un VUL : 4 ans puis tous les 2 ans', () => {
    expect(technicalInspectionDue('2022-10-12', null)).toBe('2026-10-12');
    expect(technicalInspectionDue('2020-03-01', '2024-02-10')).toBe('2026-02-10');
    expect(technicalInspectionDue(null, null)).toBeNull();
  });
});

describe('amendes', () => {
  it('fixe la date limite à 45 jours après l’envoi de l’avis', () => {
    expect(designationDeadline('2026-09-01')).toBe('2026-10-16');
    expect(fineUrgency('2026-09-01', '2026-10-12')).toEqual({ urgency: 'critique', daysLeft: 4 });
    expect(fineUrgency('2026-09-01', '2026-10-17').urgency).toBe('depasse');
    expect(fineUrgency('2026-09-20', '2026-09-29').urgency).toBe('normal');
  });

  it('retrouve le conducteur à partir des affectations', () => {
    const intervals = [
      { id: 1, employeeId: 10, vehicleId: 5, startedAt: '2026-09-10T05:00:00Z', endedAt: '2026-09-10T15:00:00Z' },
      { id: 2, employeeId: 11, vehicleId: 5, startedAt: '2026-09-11T05:00:00Z', endedAt: null },
      { id: 3, employeeId: 12, vehicleId: 6, startedAt: '2026-09-10T05:00:00Z', endedAt: '2026-09-10T15:00:00Z' },
    ];
    const hit = findDriverAt(intervals, 5, '2026-09-10T09:12:00Z');
    expect(hit.kind === 'unique' && hit.assignment.employeeId).toBe(10);
    expect(findDriverAt(intervals, 5, '2026-09-10T20:00:00Z').kind).toBe('aucun');
    const open = findDriverAt(intervals, 5, '2026-09-12T08:00:00Z', '2026-09-12T10:00:00Z');
    expect(open.kind === 'unique' && open.assignment.employeeId).toBe(11);
    const overlap = [...intervals, { id: 4, employeeId: 13, vehicleId: 5, startedAt: '2026-09-10T08:00:00Z', endedAt: '2026-09-10T10:00:00Z' }];
    expect(findDriverAt(overlap, 5, '2026-09-10T09:00:00Z').kind).toBe('ambigu');
  });
});

describe('inspection', () => {
  it('retient le problème le plus grave', () => {
    expect(worstResult({ pneus: { result: 'ok', note: '' } })).toBe('ok');
    expect(worstResult({ pneus: { result: 'mineur', note: '' }, freins: { result: 'ok', note: '' } })).toBe('mineur');
    expect(worstResult({ pneus: { result: 'mineur', note: '' }, freins: { result: 'bloquant', note: '' } })).toBe('bloquant');
  });

  it('contrôle la cohérence du kilométrage', () => {
    expect(checkOdometer(120_000, 119_800).ok).toBe(true);
    expect(checkOdometer(119_000, 119_800)).toMatchObject({ ok: false, reason: 'inferieur' });
    expect(checkOdometer(125_000, 119_800)).toMatchObject({ ok: false, reason: 'saut' });
    expect(checkOdometer(12.5, null)).toMatchObject({ ok: false, reason: 'invalide' });
  });
});

describe('remplacement', () => {
  const base: Candidate = {
    employeeId: 0,
    name: '',
    isDriver: true,
    active: true,
    absentThatDay: false,
    licenceValidThatDay: true,
    licenceCategories: ['B'],
    plannedRoutesThatDay: 0,
    knowsRoute: false,
    daysPlannedThisWeek: 3,
  };

  it('écarte les absents et les permis invalides, puis classe les libres en premier', () => {
    const { ranked, excluded } = rankReplacements([
      { ...base, employeeId: 1, name: 'Absent', absentThatDay: true },
      { ...base, employeeId: 2, name: 'Sans permis', licenceValidThatDay: false },
      { ...base, employeeId: 3, name: 'Occupé', plannedRoutesThatDay: 1, knowsRoute: true },
      { ...base, employeeId: 4, name: 'Libre', daysPlannedThisWeek: 4 },
      { ...base, employeeId: 5, name: 'Libre connaît', knowsRoute: true, daysPlannedThisWeek: 4 },
      { ...base, employeeId: 6, name: 'Dispatcher', isDriver: false },
    ]);
    expect(ranked.map((c) => c.employeeId)).toEqual([5, 4, 3]);
    expect(excluded.map((e) => e.employeeId).sort()).toEqual([1, 2]);
  });
});

describe('CSV', () => {
  it('lit un export Excel français avec guillemets', () => {
    const rows = parseCsv('﻿tournee;chauffeur;note\r\nA01;"Da Silva; Sofia";"dit ""ok"""\r\n\r\nA02;Karim;\r\n');
    expect(rows).toEqual([
      ['tournee', 'chauffeur', 'note'],
      ['A01', 'Da Silva; Sofia', 'dit "ok"'],
      ['A02', 'Karim', ''],
    ]);
    expect(parseCsv('code,heure\nB1,07:00')).toEqual([
      ['code', 'heure'],
      ['B1', '07:00'],
    ]);
  });

  it('neutralise les formules à l’export', () => {
    const csv = toCsv(['a', 'b'], [['=SUM(A1)', 'x;y']]);
    expect(csv).toContain("'=SUM(A1)");
    expect(csv).toContain('"x;y"');
  });
});

describe('droits', () => {
  it('limite les modules et actions selon les rôles', () => {
    expect(canAccess(['exploitation'], 'planning')).toBe(true);
    expect(canAccess(['exploitation'], 'amendes')).toBe(false);
    expect(canAccess(['chauffeur'], 'vehicules')).toBe(false);
    expect(can(['compta'], 'dommage.modifier')).toBe(false);
    expect(can(['flotte', 'compta'], 'dommage.modifier')).toBe(true);
    expect(parseRoles('admin, inconnu ,rh')).toEqual(['admin', 'rh']);
  });

  it('hache les mots de passe et valide les codes chauffeur', () => {
    const hash = hashPassword('demo1234');
    expect(verifyPassword('demo1234', hash)).toBe(true);
    expect(verifyPassword('demo12345', hash)).toBe(false);
    expect(passwordProblem('12345', true)).not.toBeNull();
    expect(passwordProblem('123456', true)).toBeNull();
    expect(passwordProblem('court', false)).not.toBeNull();
  });
});
