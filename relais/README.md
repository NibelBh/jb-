# Relais

MVP of an operations tool for delivery subcontractors running vans (DSPs working for Amazon, and subcontractors of other parcel networks). Built from the product study in `docs/dsp-saas/etude-produit-dsp.md`.

"Relais" is a placeholder name, set in `lib/config.ts`.

## What it does

Back office (managers, on a computer):

- **Aujourd'hui**: routes that need a driver, vehicles blocked at inspection, fines to designate, upcoming deadlines, and who is working today.
- **Planning**: day and week views. You add routes one by one or import them from a CSV or an Excel paste (same format whichever client the routes are for). It assigns a driver and a vehicle to each route and flags problems: absent driver, expired licence, unavailable vehicle, vehicle booked twice. Replacement help ranks the free drivers but never assigns anyone automatically.
- **Véhicules**: vehicle record, status, immobilisations, technical inspection date worked out from the first registration (4 years, then every 2 years), inspections with photos, a history of who drove what and when, documents, and the audit log.
- **Personnel**: employee record, driving licence and licence checks, absences (never with a medical reason), vehicles driven, incidents, documents, and driver-app access.
- **Dommages**: a case file for each damage, with statuses, comments, attachments and costs.
- **Amendes**: records each fine notice, finds the driver from the assignment history, and counts down the 45 days allowed to designate the driver.
- **Documents**: every deadline, with alerts at 90, 30, 15 and 7 days.
- **Paie** (payroll): Relais does not calculate salaries. For each month it gathers the variable pay items (days worked, routes, dated absences, late arrivals, bonuses, advances, overtime entered by hand) and produces two CSV files: an import file for the payroll software (one line per employee and pay code, absences with their dates, pay codes configurable to match Silae, PayFit, Sage, Cegid or the accounting firm) and a one-line-per-employee summary for the accountant. The payroll journal (gross, net, employer cost) can then be imported back to show labour cost per employee and per route. Salary amounts never appear in the audit log.
- **Imports CSV**: staff, vehicles, documents with expiry dates, and absences, from Excel files (UTF-8 or the Windows-1252 encoding French Excel uses by default). Each import can be checked first: the report lists what would be created, updated or rejected, line by line, and nothing is saved until you click Import. Existing records are matched (payroll number, name, number plate) and completed, never duplicated. Templates can be downloaded from each import.
- **Journal**: an append-only audit log (a database trigger blocks any update or deletion). CSV exports.
- **Paramètres**: users and roles. One person can hold several roles.

Driver app (phone): take the vehicle (5 photos, mileage, 10 checks). A blocking problem keeps the vehicle at the depot until a manager decides. Also: return the vehicle (a problem found at return automatically opens a case), report a problem (location only if the driver taps the button), my documents, and call dispatch.

Choices taken from the study: no continuous GPS tracking, no clock-in system that would duplicate Mobilic (the app sends drivers there instead), no driver scores, no deducting damage from wages.

## Try it without installing anything (GitHub Codespaces)

Open this link while logged in to the GitHub account that has access to the repository:

https://codespaces.new/NibelBh/jb-/tree/claude/dsp-delivery-saas-design-ury7jc?quickstart=1&devcontainer_path=.devcontainer/relais/devcontainer.json

Click "Create codespace". The first start takes about 3 to 5 minutes: installation, then build. The app then opens in a new tab (if it doesn't, open the **Ports** tab and click the globe next to port 3100). Log in with the demo accounts below.

- To test the driver app on a phone: in the **Ports** tab, right-click port 3100, choose Port Visibility, then Public, and open the same address on the phone. Anyone with that address can then open the demo, which contains only fictional data.
- The codespace stops by itself after a period of inactivity. The same link resumes it with its data.
- To get a newer version of the code, delete the codespace (github.com/codespaces) and open the link again.

`next.config.ts` accepts the Codespaces public address for forms (Server Actions). Behind another proxy or tunnel, list the public host in `RELAIS_ALLOWED_ORIGINS` (comma-separated).

## Running it

```bash
cd relais
npm install
npm run dev        # http://localhost:3100
```

The database (SQLite built into Node 22, no dependency to install) is created in `data/`. On first launch it is filled with demo data based on today's date.

| Account | Login | Password |
|---|---|---|
| Owner | `admin@demo.fr` | `demo1234` |
| Operations | `exploitation@demo.fr` | `demo1234` |
| Fleet | `flotte@demo.fr` | `demo1234` |
| Driver | `lucas`, `samir`, `ines`… | `123456` |

Environment variables: `RELAIS_DATA_DIR` (data folder), `RELAIS_DEMO=0` (no demo data, and the accounts are hidden on the login page).

Before delivering: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

## Architecture

- `lib/domain/`: pure business rules (dates, deadlines, fines, inspection, replacement, CSV, imports, payroll, roles). They are tested without a database.
- `lib/db/`: SQLite schema and migrations, demo data.
- `lib/data/`: every query. Each one filters on `org_id`, which separates one client company from another.
- `app/(gestion)/`: back office. `app/chauffeur/`: driver app. Writes go through Server Actions that check the role on every call.
- Uploaded files live in `data/uploads/<organisation>/` and are served only through `/api/fichiers/[id]` after a session and organisation check. On upload the file type is checked against its real content, and photos are compressed in the browser before they are sent.

## Known limits

- SQLite on a single server. Before commercial use: PostgreSQL with Row Level Security as a second layer of isolation between clients, S3-compatible object storage in the EU, backups.
- Notifications are in-app only. Email and push are not connected yet (one entry point: `lib/data/notifications.ts`).
- The driver app is a web page, not an installable app. It does not work offline yet.
- Payroll: the pay codes shipped are generic and must be replaced with the ones from the client's payroll software. Days worked come from the planning and vehicle pick-ups, not from hours: working time stays in Mobilic or the paper log book. The payroll accounting entries (accounts 641, 645, 421, 431…) are produced by the payroll software, not by Relais.
- Not built yet (V2 in the study): Mobilic integration, fuel, costs per vehicle, multi-company groups.
