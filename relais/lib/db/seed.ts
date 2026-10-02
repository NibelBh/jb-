/*
 * Données de démonstration, calées sur la date du jour pour que les alertes,
 * échéances et remplacements soient toujours visibles. Les identités, plaques
 * et numéros sont fictifs. Le planning passé est « réalisé » de la même façon
 * que dans l'application : prise du véhicule, état de fin de journée, créneau réalisé.
 */
import { addDays, addYears, parisDate, parisLocalToIso } from '../domain/dates';
import { CHECKLIST } from '../domain/inspection';
import { hashPassword } from '../domain/password';
import { type Db, get, run, transaction } from './core';

export const DEMO_PASSWORD = 'demo1234';
export const DEMO_DRIVER_CODE = '123456';

type SeedEmployee = {
  first: string;
  last: string;
  position: string;
  licenceInDays: number | null;
  categories: string;
  login?: string;
};

const EMPLOYEES: SeedEmployee[] = [
  { first: 'Samir', last: 'Benali', position: 'chauffeur', licenceInDays: 2100, categories: 'B', login: 'samir' },
  { first: 'Karim', last: 'Lahlou', position: 'chauffeur', licenceInDays: 1500, categories: 'B', login: 'karim' },
  { first: 'Julie', last: 'Martin', position: 'chauffeur', licenceInDays: 3000, categories: 'B,C1', login: 'julie' },
  { first: 'Thomas', last: 'Petit', position: 'chauffeur', licenceInDays: 21, categories: 'B', login: 'thomas' },
  { first: 'Inès', last: 'Moreau', position: 'chauffeur', licenceInDays: 2600, categories: 'B', login: 'ines' },
  { first: 'Yanis', last: 'Robert', position: 'chef_equipe', licenceInDays: 1800, categories: 'B,C', login: 'yanis' },
  { first: 'Léa', last: 'Garnier', position: 'chauffeur', licenceInDays: 2200, categories: 'B', login: 'lea' },
  { first: 'Mehdi', last: 'Haddad', position: 'chauffeur', licenceInDays: -4, categories: 'B', login: 'mehdi' },
  { first: 'Lucas', last: 'Faure', position: 'chauffeur', licenceInDays: 2900, categories: 'B', login: 'lucas' },
  { first: 'Sofia', last: 'Da Silva', position: 'chauffeur', licenceInDays: 1200, categories: 'B', login: 'sofia' },
  { first: 'Nadia', last: 'Roux', position: 'dispatcher', licenceInDays: 2000, categories: 'B' },
];

const CITIES = [
  { city: 'Saint-Denis', cp: '93200' },
  { city: 'Bobigny', cp: '93000' },
  { city: 'Paris', cp: '75019' },
  { city: 'Montreuil', cp: '93100' },
  { city: 'Aubervilliers', cp: '93300' },
];

const VEHICLES = [
  { plate: 'FG-481-KL', brand: 'Renault', model: 'Master', energy: 'diesel', firstReg: -1420, km: 118_400, insuranceIn: 200 },
  { plate: 'GH-205-PT', brand: 'Peugeot', model: 'Boxer', energy: 'diesel', firstReg: -900, km: 84_150, insuranceIn: 12 },
  { plate: 'GK-733-RA', brand: 'Mercedes-Benz', model: 'eSprinter', energy: 'electrique', firstReg: -600, km: 41_020, insuranceIn: 240 },
  { plate: 'FR-118-ZE', brand: 'Ford', model: 'Transit', energy: 'diesel', firstReg: -1700, km: 152_300, insuranceIn: 160 },
  { plate: 'GD-962-LM', brand: 'Citroën', model: 'Jumper', energy: 'diesel', firstReg: -1100, km: 97_640, insuranceIn: -3 },
  { plate: 'GL-044-BC', brand: 'Renault', model: 'Master E-Tech', energy: 'electrique', firstReg: -420, km: 28_900, insuranceIn: 300 },
  { plate: 'FZ-597-HN', brand: 'Peugeot', model: 'Boxer', energy: 'diesel', firstReg: -1250, km: 109_870, insuranceIn: 90 },
  { plate: 'GF-310-SV', brand: 'Fiat', model: 'Ducato', energy: 'diesel', firstReg: -980, km: 76_310, insuranceIn: 120 },
  { plate: 'GJ-871-DW', brand: 'Mercedes-Benz', model: 'Sprinter', energy: 'diesel', firstReg: -700, km: 55_480, insuranceIn: 45 },
];

/** Tournées du dépôt avec leurs horaires habituels (le samedi : matinée seulement). */
const ROUTES = [
  { code: 'A01', start: '06:45', end: '15:15' },
  { code: 'A02', start: '07:00', end: '15:30' },
  { code: 'A03', start: '07:15', end: '16:00' },
  { code: 'A04', start: '07:30', end: '16:15' },
  { code: 'A05', start: '08:00', end: '17:00' },
  { code: 'A06', start: '08:30', end: '17:30' },
  { code: 'A07', start: '09:00', end: '18:00' },
];
const SATURDAY = { start: '07:00', end: '13:00' };

type Planned = { day: string; employee: number | null; start: string; end: string; route: string | null; vehicle: number | null };

const weekday = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay();

export function seedDemo(db: Db, today = parisDate()): void {
  transaction(db, () => {
    const org = run(db, `INSERT INTO organizations (name, siren) VALUES (?, ?)`, 'Transports Démo', '000000000').id;

    // ---------- Personnel ----------
    const employeeIds: number[] = [];
    for (const e of EMPLOYEES) {
      const n = employeeIds.length;
      const place = CITIES[n % CITIES.length];
      const id = run(
        db,
        `INSERT INTO employees (org_id, payroll_id, first_name, last_name, email, phone, position, contract_type, status, hired_on,
           licence_number, licence_categories, licence_expires_on, licence_checked_on,
           birth_date, birth_place, nationality, address, postal_code, city, emergency_name, emergency_phone, licence_issued_on)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'cdi', 'actif', ?, ?, ?, ?, ?, ?, ?, 'Française', ?, ?, ?, ?, ?, ?)`,
        org,
        `M${String(n + 1).padStart(3, '0')}`,
        e.first,
        e.last,
        `${e.first.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}@exemple.fr`,
        `06 00 00 00 ${String(n + 10).padStart(2, '0')}`,
        e.position,
        addDays(today, -200 - n * 37),
        `DEMO${String(100000 + n * 7919).slice(0, 6)}`,
        e.categories,
        e.licenceInDays === null ? null : addDays(today, e.licenceInDays),
        addDays(today, -60),
        addDays(today, -365 * (24 + (n % 15)) - n * 41),
        place.city,
        `${3 + n * 4} rue de la Gare`,
        place.cp,
        place.city,
        `Contact de ${e.first}`,
        `06 11 00 00 ${String(n + 10).padStart(2, '0')}`,
        addDays(today, -365 * (5 + (n % 8))),
      ).id;
      employeeIds.push(id);
      if (e.login) {
        run(
          db,
          `INSERT INTO users (org_id, employee_id, name, login, password_hash, roles) VALUES (?, ?, ?, ?, ?, 'chauffeur')`,
          org,
          id,
          `${e.first} ${e.last}`,
          e.login,
          hashPassword(DEMO_DRIVER_CODE),
        );
      }
    }
    const [samir, karim, julie, thomas, , yanis, lea, mehdi, , sofia, nadia] = employeeIds;
    const drivers = employeeIds.slice(0, 10);

    const adminPassword = hashPassword(DEMO_PASSWORD);
    run(db, `INSERT INTO users (org_id, name, login, password_hash, roles) VALUES (?, 'Claire Dirigeante', 'admin@demo.fr', ?, 'admin')`, org, adminPassword);
    run(db, `INSERT INTO users (org_id, employee_id, name, login, password_hash, roles) VALUES (?, ?, 'Nadia Roux', 'exploitation@demo.fr', ?, 'manager')`, org, nadia, adminPassword);
    run(db, `INSERT INTO users (org_id, name, login, password_hash, roles) VALUES (?, 'Marc Flotte', 'flotte@demo.fr', ?, 'flotte,compta')`, org, adminPassword);

    // ---------- Véhicules, assurance et contrôle technique ----------
    const vehicleIds: number[] = [];
    for (const v of VEHICLES) {
      const firstReg = addDays(today, v.firstReg);
      const id = run(
        db,
        `INSERT INTO vehicles (org_id, plate, vin, brand, model, year, type, energy, status, first_registration_on, initial_km, current_km, owner,
           insurer, insurance_policy, insurance_start_on, insurance_end_on)
         VALUES (?, ?, ?, ?, ?, ?, 'fourgon', ?, 'disponible', ?, ?, ?, 'Loueur longue durée', 'Assurance Flotte Démo', ?, ?, ?)`,
        org,
        v.plate,
        `VF1DEMO${String(vehicleIds.length).padStart(10, '0')}`,
        v.brand,
        v.model,
        Number(firstReg.slice(0, 4)),
        v.energy,
        firstReg,
        12,
        v.km,
        `POL-${v.plate}`,
        addDays(today, v.insuranceIn - 365),
        addDays(today, v.insuranceIn),
      ).id;
      vehicleIds.push(id);
      run(db, `INSERT INTO documents (org_id, entity_type, entity_id, type, reference, issued_on, expires_on) VALUES (?, 'vehicle', ?, 'assurance', ?, ?, ?)`,
        org, id, `POL-${v.plate}`, addDays(today, v.insuranceIn - 365), addDays(today, v.insuranceIn));
      run(db, `INSERT INTO documents (org_id, entity_type, entity_id, type, reference, issued_on) VALUES (?, 'vehicle', ?, 'carte_grise', ?, ?)`,
        org, id, v.plate, firstReg);
      // Un contrôle technique enregistré pour les véhicules de plus de 4 ans.
      if (v.firstReg < -1460) {
        const lastCt = addDays(addYears(firstReg, 4), -20);
        run(db, `INSERT INTO documents (org_id, entity_type, entity_id, type, reference, issued_on, expires_on) VALUES (?, 'vehicle', ?, 'controle_technique', ?, ?, ?)`,
          org, id, `CT-${v.plate}`, lastCt, addYears(lastCt, 2));
        run(db, `UPDATE vehicles SET ct_last_on = ?, ct_expires_on = ? WHERE id = ?`, lastCt, addYears(lastCt, 2), id);
      }
    }

    for (let i = 0; i < employeeIds.length; i++) {
      const e = EMPLOYEES[i];
      if (e.licenceInDays !== null) {
        run(db, `INSERT INTO documents (org_id, entity_type, entity_id, type, reference, expires_on) VALUES (?, 'employee', ?, 'permis', ?, ?)`,
          org, employeeIds[i], `Catégories ${e.categories}`, addDays(today, e.licenceInDays));
      }
    }
    // Titre de séjour qui expire bientôt : typique des relances RH.
    run(db, `INSERT INTO documents (org_id, entity_type, entity_id, type, reference, expires_on) VALUES (?, 'employee', ?, 'titre_sejour', 'Titre pluriannuel', ?)`,
      org, sofia, addDays(today, 26));
    run(db, `INSERT INTO documents (org_id, entity_type, entity_id, type, reference, expires_on) VALUES (?, 'organization', ?, 'attestation_urssaf', 'Attestation de vigilance', ?)`,
      org, org, addDays(today, 38));
    run(db, `INSERT INTO documents (org_id, entity_type, entity_id, type, reference, expires_on) VALUES (?, 'organization', ?, 'licence_transport', 'Licence transport intérieur', ?)`,
      org, org, addDays(today, 900));

    // ---------- Absences et situations ----------
    const absences = [
      { employee: lea, type: 'formation', from: addDays(today, -8), to: addDays(today, -8), note: 'Formation sécurité' },
      { employee: karim, type: 'maladie', from: today, to: addDays(today, 2), note: 'Prévenu par SMS à 6 h 10' },
      { employee: julie, type: 'conge', from: addDays(today, 9), to: addDays(today, 16), note: null },
    ];
    for (const a of absences) {
      run(db, `INSERT INTO absences (org_id, employee_id, type, start_on, end_on, note) VALUES (?, ?, ?, ?, ?, ?)`, org, a.employee, a.type, a.from, a.to, a.note);
    }
    const absent = (employee: number, day: string) => absences.some((a) => a.employee === employee && a.from <= day && a.to >= day);

    // ---------- Planning et présence réelle ----------
    // Véhicules en règle : GD-962-LM a son assurance expirée, GF-310-SV part en réparation.
    const fleet = [0, 1, 2, 3, 5, 6, 8].map((i) => vehicleIds[i]);

    const insertShift = (p: Planned, status: 'prevu' | 'en_cours' | 'realise', actualStart: string | null, actualEnd: string | null, closedBy: string | null, notes: string | null = null) =>
      run(
        db,
        `INSERT INTO shifts (org_id, day, employee_id, start_time, end_time, route_name, vehicle_id, status, actual_start, actual_end, closed_by, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        org, p.day, p.employee, p.start, p.end, p.route, p.vehicle, status, actualStart, actualEnd, closedBy, notes,
      ).id;

    /** Planning type d'un jour : chauffeurs en rotation, absents et permis expiré écartés. */
    const planDay = (day: string, offset: number): Planned[] => {
      const saturday = weekday(day) === 6;
      const pool = drivers.filter((d) => d !== mehdi && !absent(d, day));
      const shift = offset % pool.length;
      const rotated = [...pool.slice(shift), ...pool.slice(0, shift)];
      return ROUTES.slice(0, saturday ? 4 : ROUTES.length).map((r, i) => ({
        day,
        employee: rotated[i] ?? null,
        start: saturday ? SATURDAY.start : r.start,
        end: saturday ? SATURDAY.end : r.end,
        route: r.code,
        vehicle: fleet[i],
      }));
    };

    const history: { vehicle: number; employee: number; start: string; end: string }[] = [];
    const km = new Map<number, number>(vehicleIds.map((id, i) => [id, VEHICLES[i].km - 21 * 110]));
    const drive = (vehicle: number) => {
      const start = km.get(vehicle) ?? 0;
      const end = start + 95 + ((vehicle * 13 + start) % 40);
      km.set(vehicle, end);
      return { start, end };
    };
    /** Journée réalisée avec l'application : prise du véhicule puis état de fin de journée. */
    const realise = (p: Planned, lateMin: number, extraMin: number) => {
      const actualStart = new Date(Date.parse(parisLocalToIso(p.day, p.start)) + lateMin * 60_000).toISOString();
      const actualEnd = new Date(Date.parse(parisLocalToIso(p.day, p.end)) + extraMin * 60_000).toISOString();
      const shiftId = insertShift(p, 'realise', actualStart, actualEnd, 'État de fin de journée');
      if (p.vehicle && p.employee) {
        const odo = drive(p.vehicle);
        run(db, `INSERT INTO assignments (org_id, vehicle_id, employee_id, started_at, ended_at, start_km, end_km, source, shift_id) VALUES (?, ?, ?, ?, ?, ?, ?, 'application', ?)`,
          org, p.vehicle, p.employee, actualStart, actualEnd, odo.start, odo.end, shiftId);
        history.push({ vehicle: p.vehicle, employee: p.employee, start: actualStart, end: actualEnd });
      }
    };

    // Trois semaines passées (dimanches non travaillés).
    const lastWorked = weekday(addDays(today, -1)) === 0 ? 2 : 1;
    for (let back = 21; back >= 1; back--) {
      const day = addDays(today, -back);
      if (weekday(day) === 0) continue;
      const plan = planDay(day, back);
      plan.forEach((p, i) => {
        // Au dernier jour travaillé, le dernier chauffeur a oublié l'application : sa journée reste à confirmer.
        if (back === lastWorked && i === plan.length - 1) return void insertShift(p, 'prevu', null, null, null);
        realise(p, (i * 7 + back) % 12, ((i + back) % 3) * 10);
      });
      // Le samedi, Yanis enchaîne deux tournées (matin et après-midi) : 1 journée, 2 tournées.
      if (weekday(day) === 6 && !absent(yanis, day) && !plan.some((p) => p.employee === yanis)) {
        realise({ day, employee: yanis, start: '07:30', end: '11:30', route: 'S01', vehicle: fleet[5] }, 0, 0);
        realise({ day, employee: yanis, start: '13:00', end: '17:30', route: 'S02', vehicle: fleet[6] }, 5, 0);
      }
      // Il y a cinq jours, Mehdi (permis expiré) a travaillé au dépôt sans tournée : présence confirmée par Nadia.
      if (back === 5) {
        insertShift({ day, employee: mehdi, start: '09:00', end: '16:00', route: null, vehicle: null }, 'realise',
          parisLocalToIso(day, '09:00'), parisLocalToIso(day, '16:00'), 'Nadia Roux', 'Préparation des colis au dépôt');
      }
    }
    for (const [id, value] of km) run(db, `UPDATE vehicles SET current_km = ? WHERE id = ?`, value, id);

    // Aujourd'hui : Karim en arrêt (A02 libérée, à pourvoir), Mehdi planifié avec un permis expiré (à remplacer),
    // Inès et Lucas libres, candidats naturels au remplacement.
    const todayPlan: Planned[] = [samir, null, julie, thomas, yanis, lea, mehdi].map((employee, i) => ({
      day: today,
      employee,
      start: ROUTES[i].start,
      end: ROUTES[i].end,
      route: ROUTES[i].code,
      vehicle: fleet[i],
    }));
    const todayIds = todayPlan.map((p) => insertShift(p, 'prevu', null, null, null, p.route === 'A02' ? 'Libéré : Karim Lahlou (arrêt maladie).' : null));

    // Ce matin : Samir est déjà parti avec FG-481-KL (créneau en cours).
    const answers = Object.fromEntries(CHECKLIST.map((c) => [c.key, { result: 'ok', note: '' }]));
    const vSamir = fleet[0];
    const kmSamir = km.get(vSamir) ?? 0;
    const departAt = parisLocalToIso(today, '06:52');
    const insp = run(db, `INSERT INTO inspections (org_id, vehicle_id, employee_id, kind, odometer, answers, worst, photos, status, created_at, shift_id)
      VALUES (?, ?, ?, 'depart', ?, ?, 'ok', '{}', 'validee', ?, ?)`,
      org, vSamir, samir, kmSamir, JSON.stringify(answers), departAt, todayIds[0]).id;
    run(db, `INSERT INTO assignments (org_id, vehicle_id, employee_id, started_at, start_inspection_id, start_km, source, shift_id) VALUES (?, ?, ?, ?, ?, ?, 'application', ?)`,
      org, vSamir, samir, departAt, insp, kmSamir, todayIds[0]);
    run(db, `UPDATE shifts SET status = 'en_cours', actual_start = ? WHERE id = ?`, departAt, todayIds[0]);
    run(db, `UPDATE vehicles SET status = 'en_tournee' WHERE id = ?`, vSamir);

    // Six jours à venir, dont un créneau au dépôt pour Mehdi demain (sans véhicule).
    for (let ahead = 1; ahead <= 6; ahead++) {
      const day = addDays(today, ahead);
      if (weekday(day) === 0) continue;
      for (const p of planDay(day, ahead + 3)) insertShift(p, 'prevu', null, null, null);
      if (ahead === 1) {
        insertShift({ day, employee: mehdi, start: '09:00', end: '12:00', route: null, vehicle: null }, 'prevu', null, null, null, 'Dépôt, puis rendez-vous en préfecture pour le permis');
      }
    }

    // ---------- Dommages ----------
    // Un choc en réparation (véhicule immobilisé), une rayure déclarée hier, un ancien impact réparé.
    const vChoc = vehicleIds[7];
    const choc = run(db, `INSERT INTO damages (org_id, vehicle_id, employee_id, type, severity, status, description, occurred_at, location_text, estimated_cost_cents, created_at, zones)
      VALUES (?, ?, ?, 'choc', 'grave', 'reparation_planifiee', 'Choc arrière droit en manœuvre sur le parking du dépôt. Feu arrière cassé.', ?, 'Parking Agence Nord', 145000, ?, 'arriere,roue_ar_d')`,
      org, vChoc, lea, parisLocalToIso(addDays(today, -3), '16:40'), parisLocalToIso(addDays(today, -3), '16:52')).id;
    for (const [from, to, text, dayBack] of [
      [null, 'nouveau', 'Déclaration depuis l’application chauffeur.', 3],
      ['nouveau', 'en_cours', 'Photos vérifiées, feu arrière à remplacer.', 3],
      ['en_cours', 'reparateur_contacte', 'Devis demandé au garage partenaire.', 2],
      ['reparateur_contacte', 'reparation_planifiee', 'Réparation prévue en fin de semaine.', 1],
    ] as const) {
      run(db, `INSERT INTO damage_events (org_id, damage_id, author, kind, from_status, to_status, text, created_at) VALUES (?, ?, 'Marc Flotte', 'statut', ?, ?, ?, ?)`,
        org, choc, from, to, text, parisLocalToIso(addDays(today, -dayBack), '17:30'));
    }
    run(db, `UPDATE vehicles SET status = 'immobilise' WHERE id = ?`, vChoc);
    run(db, `INSERT INTO immobilizations (org_id, vehicle_id, started_on, reason, damage_id) VALUES (?, ?, ?, 'Attente réparation carrosserie', ?)`,
      org, vChoc, addDays(today, -3), choc);

    const rayure = run(db, `INSERT INTO damages (org_id, vehicle_id, employee_id, type, severity, status, description, occurred_at, created_at, zones)
      VALUES (?, ?, ?, 'rayure', 'mineur', 'nouveau', 'Rayure sur la porte latérale, constatée à l’état de fin de journée.', ?, ?, 'cote_droit')`,
      org, vehicleIds[3], thomas, parisLocalToIso(addDays(today, -1), '17:25'), parisLocalToIso(addDays(today, -1), '17:31')).id;
    run(db, `INSERT INTO damage_events (org_id, damage_id, author, kind, to_status, text, created_at) VALUES (?, ?, 'Thomas Petit', 'statut', 'nouveau', 'Déclaration depuis l’application chauffeur.', ?)`,
      org, rayure, parisLocalToIso(addDays(today, -1), '17:31'));
    const ancien = run(db, `INSERT INTO damages (org_id, vehicle_id, employee_id, type, severity, status, description, occurred_at, created_at, closed_at, zones, final_cost_cents)
      VALUES (?, ?, ?, 'pare_brise', 'moyen', 'cloture', 'Impact de gravillon sur le pare-brise, réparé.', ?, ?, ?, 'pare_brise', 9000)`,
      org, vehicleIds[3], samir, parisLocalToIso(addDays(today, -16), '11:10'), parisLocalToIso(addDays(today, -16), '11:20'), parisLocalToIso(addDays(today, -12), '10:00')).id;
    run(db, `INSERT INTO damage_events (org_id, damage_id, author, kind, to_status, text, created_at) VALUES (?, ?, 'Marc Flotte', 'statut', 'cloture', 'Réparé par le vitrier partenaire.', ?)`,
      org, ancien, parisLocalToIso(addDays(today, -12), '10:00'));

    // ---------- Amendes : une à désigner, une presque hors délai, une déjà désignée ----------
    const fineOn = (back: number) => history.filter((h) => h.start.slice(0, 10) <= addDays(today, -back)).at(-1) ?? history[0];
    const f1 = fineOn(12);
    run(db, `INSERT INTO fines (org_id, vehicle_id, notice_number, offense_at, notice_sent_on, location, amount_cents, description, status)
      VALUES (?, ?, 'AVIS-0001', ?, ?, 'Boulevard périphérique, Paris', 13500, 'Excès de vitesse inférieur à 20 km/h', 'a_designer')`,
      org, f1.vehicle, new Date(Date.parse(f1.start) + 3 * 3600_000).toISOString(), addDays(today, -8));
    // Avis presque hors délai : infraction commise il y a 48 jours, avec une affectation saisie après coup.
    const f2Start = parisLocalToIso(addDays(today, -48), '07:10');
    run(db, `INSERT INTO assignments (org_id, vehicle_id, employee_id, started_at, ended_at, source) VALUES (?, ?, ?, ?, ?, 'saisie manuelle')`,
      org, fleet[2], julie, f2Start, parisLocalToIso(addDays(today, -48), '16:05'));
    run(db, `INSERT INTO fines (org_id, vehicle_id, notice_number, offense_at, notice_sent_on, location, amount_cents, description, status)
      VALUES (?, ?, 'AVIS-0002', ?, ?, 'Rue de la République, Saint-Denis', 3500, 'Stationnement gênant', 'a_designer')`,
      org, fleet[2], new Date(Date.parse(f2Start) + 5 * 3600_000).toISOString(), addDays(today, -41));
    const f3 = fineOn(15);
    run(db, `INSERT INTO fines (org_id, vehicle_id, notice_number, offense_at, notice_sent_on, location, amount_cents, description, status, employee_id, designated_on)
      VALUES (?, ?, 'AVIS-0003', ?, ?, 'Avenue Jean Jaurès, Aubervilliers', 13500, 'Feu rouge', 'designe', ?, ?)`,
      org, f3.vehicle, new Date(Date.parse(f3.start) + 2 * 3600_000).toISOString(), addDays(today, -13), f3.employee, addDays(today, -2));

    const admin = get<{ id: number }>(db, `SELECT id FROM users WHERE login = 'admin@demo.fr'`);
    run(db, `INSERT INTO notifications (org_id, target_roles, kind, title, body, link) VALUES (?, 'admin,manager,exploitation', 'absence', 'Karim Lahlou : arrêt maladie', 'Tournée A02 à couvrir aujourd’hui.', '/aujourdhui')`, org);
    run(db, `INSERT INTO notifications (org_id, target_roles, kind, title, body, link) VALUES (?, 'admin,manager,flotte', 'dommage', 'Thomas Petit a déclaré un dommage sur FR-118-ZE', 'Rayure, côté droit.', ?)`, org, `/dommages/${rayure}`);
    run(db, `INSERT INTO audit_log (org_id, user_id, actor, action, entity_type, entity_id, summary, origin) VALUES (?, ?, 'Système', 'creation', 'organization', ?, 'Données de démonstration créées.', 'systeme')`,
      org, admin?.id ?? null, org);
  });
}
