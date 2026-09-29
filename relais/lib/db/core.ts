/*
 * Base SQLite embarquée (module node:sqlite, sans dépendance native).
 * Chaque table métier porte org_id : c'est la frontière entre clients.
 * SQLite n'a pas de Row Level Security, donc toutes les requêtes passent
 * par lib/data, qui ajoute toujours le filtre org_id. En production, prévoir
 * PostgreSQL avec RLS comme seconde barrière (voir docs/dsp-saas).
 */
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

export type Db = DatabaseSync;
export type Param = SQLInputValue;

const MIGRATIONS: string[] = [
  `
  CREATE TABLE organizations (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    siren TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );

  CREATE TABLE employees (
    id INTEGER PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    position TEXT NOT NULL DEFAULT 'chauffeur',
    contract_type TEXT,
    status TEXT NOT NULL DEFAULT 'actif',
    hired_on TEXT,
    left_on TEXT,
    licence_number TEXT,
    licence_categories TEXT NOT NULL DEFAULT '',
    licence_expires_on TEXT,
    licence_checked_on TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX employees_org ON employees(org_id);

  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id),
    employee_id INTEGER REFERENCES employees(id),
    name TEXT NOT NULL,
    login TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    roles TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    last_login_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX users_org ON users(org_id);

  CREATE TABLE sessions (
    id INTEGER PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_id INTEGER NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );

  CREATE TABLE files (
    id INTEGER PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id),
    storage_key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    mime TEXT NOT NULL,
    size INTEGER NOT NULL,
    uploaded_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX files_org ON files(org_id);

  CREATE TABLE vehicles (
    id INTEGER PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id),
    plate TEXT NOT NULL,
    vin TEXT,
    brand TEXT,
    model TEXT,
    year INTEGER,
    type TEXT NOT NULL DEFAULT 'fourgon',
    energy TEXT NOT NULL DEFAULT 'diesel',
    status TEXT NOT NULL DEFAULT 'disponible',
    first_registration_on TEXT,
    initial_km INTEGER NOT NULL DEFAULT 0,
    current_km INTEGER NOT NULL DEFAULT 0,
    owner TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    UNIQUE (org_id, plate)
  );

  CREATE TABLE inspections (
    id INTEGER PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id),
    vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
    employee_id INTEGER NOT NULL REFERENCES employees(id),
    kind TEXT NOT NULL CHECK (kind IN ('depart','retour')),
    odometer INTEGER NOT NULL,
    answers TEXT NOT NULL,
    worst TEXT NOT NULL,
    photos TEXT NOT NULL,
    status TEXT NOT NULL,
    comment TEXT,
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at TEXT,
    review_note TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX inspections_vehicle ON inspections(org_id, vehicle_id, created_at);

  CREATE TABLE assignments (
    id INTEGER PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id),
    vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
    employee_id INTEGER NOT NULL REFERENCES employees(id),
    started_at TEXT NOT NULL,
    ended_at TEXT,
    start_inspection_id INTEGER REFERENCES inspections(id),
    end_inspection_id INTEGER REFERENCES inspections(id),
    start_km INTEGER,
    end_km INTEGER,
    source TEXT NOT NULL DEFAULT 'application'
  );
  CREATE INDEX assignments_vehicle ON assignments(org_id, vehicle_id, started_at);
  CREATE INDEX assignments_employee ON assignments(org_id, employee_id, started_at);

  CREATE TABLE immobilizations (
    id INTEGER PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id),
    vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
    started_on TEXT NOT NULL,
    ended_on TEXT,
    reason TEXT NOT NULL,
    damage_id INTEGER
  );

  CREATE TABLE damages (
    id INTEGER PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id),
    vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
    employee_id INTEGER REFERENCES employees(id),
    reported_by INTEGER REFERENCES users(id),
    type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'moyen',
    status TEXT NOT NULL DEFAULT 'nouveau',
    description TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    latitude REAL,
    longitude REAL,
    location_text TEXT,
    injured INTEGER NOT NULL DEFAULT 0,
    photos TEXT NOT NULL DEFAULT '[]',
    estimated_cost_cents INTEGER,
    final_cost_cents INTEGER,
    inspection_id INTEGER REFERENCES inspections(id),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    closed_at TEXT
  );
  CREATE INDEX damages_org ON damages(org_id, status);

  CREATE TABLE damage_events (
    id INTEGER PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id),
    damage_id INTEGER NOT NULL REFERENCES damages(id),
    user_id INTEGER REFERENCES users(id),
    author TEXT NOT NULL,
    kind TEXT NOT NULL,
    from_status TEXT,
    to_status TEXT,
    text TEXT,
    file_id INTEGER REFERENCES files(id),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );

  CREATE TABLE fines (
    id INTEGER PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id),
    vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
    notice_number TEXT,
    offense_at TEXT NOT NULL,
    notice_sent_on TEXT NOT NULL,
    location TEXT,
    amount_cents INTEGER,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'a_designer',
    employee_id INTEGER REFERENCES employees(id),
    designated_on TEXT,
    notice_file_id INTEGER REFERENCES files(id),
    proof_file_id INTEGER REFERENCES files(id),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX fines_org ON fines(org_id, status);

  CREATE TABLE documents (
    id INTEGER PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id),
    entity_type TEXT NOT NULL CHECK (entity_type IN ('vehicle','employee','organization')),
    entity_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    reference TEXT,
    issued_on TEXT,
    expires_on TEXT,
    file_id INTEGER REFERENCES files(id),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX documents_entity ON documents(org_id, entity_type, entity_id);

  CREATE TABLE routes (
    id INTEGER PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id),
    day TEXT NOT NULL,
    code TEXT NOT NULL,
    client TEXT,
    depot TEXT,
    start_time TEXT,
    notes TEXT,
    UNIQUE (org_id, day, code)
  );

  CREATE TABLE plans (
    id INTEGER PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id),
    day TEXT NOT NULL,
    employee_id INTEGER NOT NULL REFERENCES employees(id),
    status TEXT NOT NULL DEFAULT 'travail',
    route_id INTEGER REFERENCES routes(id) ON DELETE SET NULL,
    vehicle_id INTEGER REFERENCES vehicles(id),
    UNIQUE (org_id, day, employee_id)
  );
  CREATE INDEX plans_day ON plans(org_id, day);

  CREATE TABLE absences (
    id INTEGER PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id),
    employee_id INTEGER NOT NULL REFERENCES employees(id),
    type TEXT NOT NULL,
    start_on TEXT NOT NULL,
    end_on TEXT NOT NULL,
    note TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX absences_range ON absences(org_id, start_on, end_on);

  CREATE TABLE notifications (
    id INTEGER PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id),
    target_roles TEXT,
    user_id INTEGER REFERENCES users(id),
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    link TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX notifications_org ON notifications(org_id, created_at);

  CREATE TABLE notification_reads (
    notification_id INTEGER NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    PRIMARY KEY (notification_id, user_id)
  );

  CREATE TABLE audit_log (
    id INTEGER PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id),
    user_id INTEGER,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    summary TEXT NOT NULL,
    changes TEXT,
    origin TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX audit_entity ON audit_log(org_id, entity_type, entity_id);
  CREATE INDEX audit_date ON audit_log(org_id, created_at);

  -- Le journal d'audit est en ajout seul.
  CREATE TRIGGER audit_no_update BEFORE UPDATE ON audit_log
  BEGIN SELECT RAISE(ABORT, 'audit_log est en ajout seul'); END;
  CREATE TRIGGER audit_no_delete BEFORE DELETE ON audit_log
  BEGIN SELECT RAISE(ABORT, 'audit_log est en ajout seul'); END;
  `,
];

export function openDatabase(location: string): Db {
  const db = new DatabaseSync(location);
  db.exec('PRAGMA foreign_keys = ON;');
  if (location !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA busy_timeout = 5000;');
  }
  migrate(db);
  return db;
}

function migrate(db: Db) {
  const row = db.prepare('PRAGMA user_version').get() as { user_version: number };
  for (let version = row.user_version; version < MIGRATIONS.length; version++) {
    db.exec('BEGIN');
    try {
      db.exec(MIGRATIONS[version]);
      db.exec(`PRAGMA user_version = ${version + 1}`);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
}

// node:sqlite renvoie des objets sans prototype, que React refuse de passer aux composants client :
// on les recopie en objets ordinaires.
export function all<T>(db: Db, sql: string, ...params: Param[]): T[] {
  return db.prepare(sql).all(...params).map((row) => ({ ...row })) as T[];
}

export function get<T>(db: Db, sql: string, ...params: Param[]): T | undefined {
  const row = db.prepare(sql).get(...params);
  return row ? ({ ...row } as T) : undefined;
}

export function run(db: Db, sql: string, ...params: Param[]): { id: number; changes: number } {
  const result = db.prepare(sql).run(...params);
  return { id: Number(result.lastInsertRowid), changes: Number(result.changes) };
}

export function transaction<T>(db: Db, fn: () => T): T {
  db.exec('BEGIN');
  try {
    const value = fn();
    db.exec('COMMIT');
    return value;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
