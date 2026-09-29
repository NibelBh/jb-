/*
 * Aide au remplacement d'un chauffeur absent.
 * Le système propose une liste classée, le responsable choisit : aucune affectation automatique.
 */

export type Candidate = {
  employeeId: number;
  name: string;
  isDriver: boolean;
  active: boolean;
  absentThatDay: boolean;
  licenceValidThatDay: boolean;
  licenceCategories: string[];
  plannedRoutesThatDay: number;
  knowsRoute: boolean;
  daysPlannedThisWeek: number;
  /** Raison qui empêche de prendre ce créneau (déjà planifié sur les mêmes heures, par exemple). */
  conflict?: string | null;
};

export type RankedCandidate = Candidate & { score: number; reasons: string[] };

export type Exclusion = { employeeId: number; name: string; reason: string };

export function rankReplacements(
  candidates: Candidate[],
  requiredCategory = 'B',
): { ranked: RankedCandidate[]; excluded: Exclusion[] } {
  const ranked: RankedCandidate[] = [];
  const excluded: Exclusion[] = [];

  for (const c of candidates) {
    if (!c.active || !c.isDriver) continue;
    if (c.absentThatDay) {
      excluded.push({ employeeId: c.employeeId, name: c.name, reason: 'Absent ce jour' });
      continue;
    }
    if (!c.licenceValidThatDay) {
      excluded.push({ employeeId: c.employeeId, name: c.name, reason: 'Permis expiré ou non renseigné' });
      continue;
    }
    if (!c.licenceCategories.includes(requiredCategory)) {
      excluded.push({ employeeId: c.employeeId, name: c.name, reason: `Pas de permis ${requiredCategory}` });
      continue;
    }
    if (c.conflict) {
      excluded.push({ employeeId: c.employeeId, name: c.name, reason: c.conflict });
      continue;
    }

    const reasons: string[] = [];
    let score = 0;
    if (c.plannedRoutesThatDay === 0) {
      score += 100;
      reasons.push('Libre ce jour');
    } else {
      reasons.push('Autre créneau ce jour, sans chevauchement');
    }
    if (c.knowsRoute) {
      score += 20;
      reasons.push('Connaît la tournée');
    }
    // Équité et respect des durées de travail : on privilégie ceux qui ont le moins travaillé.
    score -= c.daysPlannedThisWeek * 5;
    reasons.push(`${c.daysPlannedThisWeek} jour${c.daysPlannedThisWeek > 1 ? 's' : ''} planifié${c.daysPlannedThisWeek > 1 ? 's' : ''} cette semaine`);

    ranked.push({ ...c, score, reasons });
  }

  ranked.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'fr'));
  return { ranked, excluded };
}
