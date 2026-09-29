import type { Metadata } from 'next';
import { ActionForm } from '@/components/ActionForm';
import { PageHeader } from '@/components/PageHeader';
import { requireModule } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { listEmployees, listUsers } from '@/lib/data/employees';
import { formatDateTime } from '@/lib/domain/dates';
import { ROLES, parseRoles } from '@/lib/domain/roles';
import { createManagerAction, updateAccessAction } from './actions';

export const metadata: Metadata = { title: 'Paramètres' };

export default async function SettingsPage() {
  const ctx = await requireModule('parametres');
  const db = getDb();
  const users = listUsers(db, ctx.orgId);
  const employees = listEmployees(db, ctx.orgId);

  return (
    <>
      <PageHeader title="Utilisateurs et accès" subtitle="Chaque personne a son propre accès. Un utilisateur peut cumuler plusieurs rôles. Les chauffeurs se connectent avec un identifiant et un code à 6 chiffres." />

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Identifiant</th>
                <th>Dernière connexion</th>
                <th>Rôles et accès</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const current = parseRoles(u.roles);
                return (
                  <tr key={u.id} style={{ verticalAlign: 'top' }}>
                    <td>
                      <strong>{u.name}</strong>
                      {!u.active && <div className="badge badge-soft">Désactivé</div>}
                    </td>
                    <td className="mono small">{u.login}</td>
                    <td className="small">{u.last_login_at ? formatDateTime(u.last_login_at) : 'Jamais'}</td>
                    <td>
                      <details className="disclosure">
                        <summary>{current.map((r) => ROLES.find((x) => x.value === r)?.label).join(', ')}</summary>
                        <ActionForm action={updateAccessAction} submitLabel="Enregistrer" submitClassName="btn btn-sm">
                          <input type="hidden" name="userId" value={u.id} />
                          <div className="btn-row">
                            {ROLES.map((r) => (
                              <label key={r.value} className="checkbox small">
                                <input type="checkbox" name="roles" value={r.value} defaultChecked={current.includes(r.value)} /> {r.label}
                              </label>
                            ))}
                          </div>
                          <label className="checkbox small">
                            <input type="checkbox" name="active" defaultChecked={u.active === 1} /> Accès actif
                          </label>
                          <div className="field">
                            <label htmlFor={`pw-${u.id}`}>Nouveau mot de passe ou code (facultatif)</label>
                            <input id={`pw-${u.id}`} name="password" type="password" className="input" autoComplete="new-password" />
                          </div>
                        </ActionForm>
                      </details>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2 className="section-title">Ajouter un responsable</h2>
          <span className="small muted">Pour un chauffeur, créez l’accès depuis sa fiche salarié.</span>
        </div>
        <div className="card-body">
          <ActionForm action={createManagerAction} submitLabel="Créer l’utilisateur" resetOnSuccess>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="name">Nom</label>
                <input id="name" name="name" className="input" required />
              </div>
              <div className="field">
                <label htmlFor="login">Identifiant (e-mail)</label>
                <input id="login" name="login" type="email" className="input" required />
              </div>
              <div className="field">
                <label htmlFor="password">Mot de passe provisoire</label>
                <input id="password" name="password" type="password" className="input" minLength={8} autoComplete="new-password" required />
              </div>
              <div className="field">
                <label htmlFor="employeeId">Fiche salarié liée (facultatif)</label>
                <select id="employeeId" name="employeeId" className="input">
                  <option value="">Aucune</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.first_name} {e.last_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="btn-row">
              {ROLES.filter((r) => r.value !== 'chauffeur').map((r) => (
                <label key={r.value} className="checkbox">
                  <input type="checkbox" name="roles" value={r.value} /> {r.label}
                </label>
              ))}
            </div>
          </ActionForm>
        </div>
      </section>
    </>
  );
}
