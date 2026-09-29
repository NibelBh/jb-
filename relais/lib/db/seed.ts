/*
 * Données de démonstration, calées sur la date du jour pour que les alertes,
 * échéances et remplacements soient toujours visibles. Les identités, plaques
 * et numéros sont fictifs.
 */
import { addDays, addYears, parisDate, parisLocalToIso, startOfWeek } from '../domain/dates';
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

export function seedDemo(db: Db, today = parisDate()): void {
  transaction(db, () => {
    const org = run(db, `INSERT INTO organizations (name, siren) VALUES (?, ?)`, 'Transports Démo', '000000000').id;

    const employeeIds: number[] = [];
    for (const e of EMPLOYEES) {
      const id = run(
        db,
        `INSERT INTO employees (org_id, payroll_id, first_name, last_name, email, phone, position, contract_type, status, hired_on,
           licence_number, licence_categories, licence_expires_on, licence_checked_on)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'cdi', 'actif', ?, ?, ?, ?, ?)`,
        org,
        `M${String(employeeIds.length + 1).padStart(3, '0')}`,
        e.first,
        e.last,
        `${e.first.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}@exemple.fr`,
        `06 00 00 00 ${String(employeeIds.length + 10).padStart(2, '0')}`,
        e.position,
        addDays(today, -200 - employeeIds.length * 37),
        `DEMO${String(100000 + employeeIds.length * 7919).slice(0, 6)}`,
        e.categories,
        e.licenceInDays === null ? null : addDays(today, e.licenceInDays),
        addDays(today, -60),
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
    const nadia = employeeIds[10];

    const adminPassword = hashPassword(DEMO_PASSWORD);
    run(db, `INSERT INTO users (org_id, name, login, password_hash, roles) VALUES (?, 'Claire Dirigeante', 'admin@demo.fr', ?, 'admin')`, org, adminPassword);
    run(db, `INSERT INTO users (org_id, employee_id, name, login, password_hash, roles) VALUES (?, ?, 'Nadia Roux', 'exploitation@demo.fr', ?, 'exploitation,rh')`, org, nadia, adminPassword);
    run(db, `INSERT INTO users (org_id, name, login, password_hash, roles) VALUES (?, 'Marc Flotte', 'flotte@demo.fr', ?, 'flotte,compta')`, org, adminPassword);

    const vehicleIds: number[] = [];
    for (const v of VEHICLES) {
      const firstReg = addDays(today, v.firstReg);
      const id = run(
        db,
        `INSERT INTO vehicles (org_id, plate, vin, brand, model, year, type, energy, status, first_registration_on, initial_km, current_km, owner)
         VALUES (?, ?, ?, ?, ?, ?, 'fourgon', ?, 'disponible', ?, ?, ?, 'Loueur longue durée')`,
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
      org, employeeIds[9], addDays(today, 26));
    run(db, `INSERT INTO documents (org_id, entity_type, entity_id, type, reference, expires_on) VALUES (?, 'organization', ?, 'attestation_urssaf', 'Attestation de vigilance', ?)`,
      org, org, addDays(today, 38));
    run(db, `INSERT INTO documents (org_id, entity_type, entity_id, type, reference, expires_on) VALUES (?, 'organization', ?, 'licence_transport', 'Licence transport intérieur', ?)`,
      org, org, addDays(today, 900));

    // Historique d'affectations sur 21 jours : 8 chauffeurs, rotation des véhicules.
    const drivers = employeeIds.slice(0, 10);
    const history: { vehicle: number; employee: number; start: string; end: string }[] = [];
    for (let back = 21; back >= 1; back--) {
      const day = addDays(today, -back);
      const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
      if (weekday === 0) continue;
      for (let slot = 0; slot < 8; slot++) {
        const employee = drivers[(slot + back) % drivers.length];
        const vehicle = vehicleIds[slot];
        history.push({
          vehicle,
          employee,
          start: parisLocalToIso(day, `07:${String(5 + slot * 3).padStart(2, '0')}`),
          end: parisLocalToIso(day, `17:${String(10 + slot * 4).padStart(2, '0')}`),
        });
      }
    }
    const km = new Map<number, number>(vehicleIds.map((id, i) => [id, VEHICLES[i].km - 21 * 110]));
    for (const h of history) {
      const start = km.get(h.vehicle) ?? 0;
      const end = start + 95 + ((h.employee * 7 + h.vehicle * 13) % 40);
      km.set(h.vehicle, end);
      run(db, `INSERT INTO assignments (org_id, vehicle_id, employee_id, started_at, ended_at, start_km, end_km, source) VALUES (?, ?, ?, ?, ?, ?, ?, 'historique')`,
        org, h.vehicle, h.employee, h.start, h.end, start, end);
    }
    for (const [id, value] of km) run(db, `UPDATE vehicles SET current_km = ? WHERE id = ?`, value, id);

    // Tournées et planning de la semaine en cours.
    const monday = startOfWeek(today);
    for (let d = 0; d < 6; d++) {
      const day = addDays(monday, d);
      if (day > addDays(today, 1)) break;
      const routeIds: number[] = [];
      for (let r = 0; r < 8; r++) {
        routeIds.push(
          run(db, `INSERT INTO routes (org_id, day, code, client, depot, start_time) VALUES (?, ?, ?, 'Amazon', 'Agence Nord', ?)`,
            org, day, `A${String(r + 1).padStart(2, '0')}`, `07:${String(r * 5).padStart(2, '0')}`).id,
        );
      }
      for (let i = 0; i < drivers.length; i++) {
        // Inès (4) et Lucas (8) sont en repos aujourd'hui, candidats naturels au remplacement.
        const resting = day === today ? i === 4 || i === 8 : (i + d) % 5 === 4;
        const slot = resting ? -1 : [0, 1, 2, 3, -1, 4, 5, 6, -1, 7][i];
        run(db, `INSERT INTO plans (org_id, day, employee_id, status, route_id, vehicle_id) VALUES (?, ?, ?, ?, ?, ?)`,
          org, day, drivers[i], slot >= 0 ? 'travail' : 'repos', slot >= 0 ? routeIds[slot] : null, slot >= 0 ? vehicleIds[slot] : null);
      }
    }

    // Absences : Karim en arrêt aujourd'hui (tournée A02 à couvrir), congé à venir pour Julie.
    run(db, `INSERT INTO absences (org_id, employee_id, type, start_on, end_on, note) VALUES (?, ?, 'maladie', ?, ?, 'Prévenu par SMS à 6 h 10')`,
      org, drivers[1], today, addDays(today, 2));
    run(db, `INSERT INTO absences (org_id, employee_id, type, start_on, end_on) VALUES (?, ?, 'conge', ?, ?)`,
      org, drivers[2], addDays(today, 9), addDays(today, 16));

    // Ce matin : Samir est déjà parti avec FG-481-KL.
    const answers = Object.fromEntries(CHECKLIST.map((c) => [c.key, { result: 'ok', note: '' }]));
    const vSamir = vehicleIds[0];
    const kmSamir = km.get(vSamir) ?? 0;
    const insp = run(db, `INSERT INTO inspections (org_id, vehicle_id, employee_id, kind, odometer, answers, worst, photos, status, created_at)
      VALUES (?, ?, ?, 'depart', ?, ?, 'ok', '{}', 'validee', ?)`,
      org, vSamir, drivers[0], kmSamir, JSON.stringify(answers), parisLocalToIso(today, '07:04')).id;
    run(db, `INSERT INTO assignments (org_id, vehicle_id, employee_id, started_at, start_inspection_id, start_km, source) VALUES (?, ?, ?, ?, ?, ?, 'application')`,
      org, vSamir, drivers[0], parisLocalToIso(today, '07:04'), insp, kmSamir);
    run(db, `UPDATE vehicles SET status = 'en_tournee' WHERE id = ?`, vSamir);

    // Dommages : un choc en réparation (véhicule immobilisé), une rayure déclarée hier.
    const vChoc = vehicleIds[7];
    const choc = run(db, `INSERT INTO damages (org_id, vehicle_id, employee_id, type, severity, status, description, occurred_at, location_text, estimated_cost_cents, created_at)
      VALUES (?, ?, ?, 'choc', 'grave', 'reparation_planifiee', 'Choc arrière droit en manœuvre sur le parking du dépôt. Feu arrière cassé.', ?, 'Parking Agence Nord', 145000, ?)`,
      org, vChoc, drivers[6], parisLocalToIso(addDays(today, -3), '16:40'), parisLocalToIso(addDays(today, -3), '16:52')).id;
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

    const rayure = run(db, `INSERT INTO damages (org_id, vehicle_id, employee_id, type, severity, status, description, occurred_at, created_at)
      VALUES (?, ?, ?, 'rayure', 'mineur', 'nouveau', 'Rayure sur la porte latérale, constatée au retour de tournée.', ?, ?)`,
      org, vehicleIds[3], drivers[3], parisLocalToIso(addDays(today, -1), '17:25'), parisLocalToIso(addDays(today, -1), '17:31')).id;
    run(db, `INSERT INTO damage_events (org_id, damage_id, author, kind, to_status, text, created_at) VALUES (?, ?, 'Thomas Petit', 'statut', 'nouveau', 'Déclaration depuis l’application chauffeur.', ?)`,
      org, rayure, parisLocalToIso(addDays(today, -1), '17:31'));

    // Amendes : une à désigner, une presque hors délai, une déjà désignée.
    const fineOn = (back: number) => history.find((h) => h.start.slice(0, 10) === addDays(today, -back)) ?? history[0];
    const f1 = fineOn(12);
    run(db, `INSERT INTO fines (org_id, vehicle_id, notice_number, offense_at, notice_sent_on, location, amount_cents, description, status)
      VALUES (?, ?, 'AVIS-0001', ?, ?, 'Boulevard périphérique, Paris', 13500, 'Excès de vitesse inférieur à 20 km/h', 'a_designer')`,
      org, f1.vehicle, new Date(Date.parse(f1.start) + 3 * 3600_000).toISOString(), addDays(today, -8));
    const f2 = fineOn(19);
    run(db, `INSERT INTO fines (org_id, vehicle_id, notice_number, offense_at, notice_sent_on, location, amount_cents, description, status)
      VALUES (?, ?, 'AVIS-0002', ?, ?, 'Rue de la République, Saint-Denis', 3500, 'Stationnement gênant', 'a_designer')`,
      org, f2.vehicle, new Date(Date.parse(f2.start) + 5 * 3600_000).toISOString(), addDays(today, -41));
    const f3 = fineOn(15);
    run(db, `INSERT INTO fines (org_id, vehicle_id, notice_number, offense_at, notice_sent_on, location, amount_cents, description, status, employee_id, designated_on)
      VALUES (?, ?, 'AVIS-0003', ?, ?, 'Avenue Jean Jaurès, Aubervilliers', 13500, 'Feu rouge', 'designe', ?, ?)`,
      org, f3.vehicle, new Date(Date.parse(f3.start) + 2 * 3600_000).toISOString(), addDays(today, -13), f3.employee, addDays(today, -2));

    const admin = get<{ id: number }>(db, `SELECT id FROM users WHERE login = 'admin@demo.fr'`);
    run(db, `INSERT INTO notifications (org_id, target_roles, kind, title, body, link) VALUES (?, 'admin,exploitation', 'absence', 'Karim Lahlou est absent aujourd’hui', 'Tournée A02 à couvrir.', '/aujourdhui')`, org);
    run(db, `INSERT INTO notifications (org_id, target_roles, kind, title, body, link) VALUES (?, 'admin,flotte', 'dommage', 'Thomas Petit a déclaré un dommage sur FR-118-ZE', 'Rayure, porte latérale.', ?)`, org, `/dommages/${rayure}`);
    run(db, `INSERT INTO audit_log (org_id, user_id, actor, action, entity_type, entity_id, summary, origin) VALUES (?, ?, 'Système', 'creation', 'organization', ?, 'Données de démonstration créées.', 'systeme')`,
      org, admin?.id ?? null, org);
  });
}
