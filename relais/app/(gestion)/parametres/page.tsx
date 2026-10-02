import type { Metadata } from 'next';
import { ActionForm } from '@/components/ActionForm';
import { PageHeader } from '@/components/PageHeader';
import { requireModule } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { type UserRow, fullName, listEmployees, listUsers } from '@/lib/data/employees';
import { formatDateTime } from '@/lib/domain/dates';
import { ACCESS_LEVELS, ROLES, accessLevel, parseRoles, roleLabel } from '@/lib/domain/roles';
import { createMemberAction, deleteMemberAction, toggleMemberAction, updateMemberAction } from './actions';

export const metadata: Metadata = { title: 'Membres et accès' };

const SCOPES = ROLES.filter((r) => r.level === 'responsable');

function MemberFields({ user, employees, prefix }: { user?: UserRow; employees: { id: number; name: string }[]; prefix: string }) {
  const roles = user ? parseRoles(user.roles) : [];
  const level = user ? accessLevel(roles) : 'responsable';
  return (
    <>
      <div className="form-grid">
        <div className="field">
          <label htmlFor={`${prefix}-name`}>Nom affiché</label>
          <input id={`${prefix}-name`} name="name" className="input" defaultValue={user?.name} required />
        </div>
        <div className="field">
          <label htmlFor={`${prefix}-login`}>Identifiant de connexion</label>
          <input id={`${prefix}-login`} name="login" className="input" defaultValue={user?.login} required autoComplete="off" />
          <span className="hint">E-mail pour un responsable, prénom pour un salarié.</span>
        </div>
        <div className="field">
          <label htmlFor={`${prefix}-employee`}>Fiche salarié liée</label>
          <select id={`${prefix}-employee`} name="employeeId" className="input" defaultValue={user?.employee_id ?? ''}>
            <option value="">Aucune</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <span className="hint">Obligatoire pour un salarié (application chauffeur).</span>
        </div>
        <div className="field">
          <label htmlFor={`${prefix}-password`}>{user ? 'Nouveau mot de passe ou code (facultatif)' : 'Mot de passe provisoire ou code'}</label>
          <input id={`${prefix}-password`} name="password" type="password" className="input" autoComplete="new-password" required={!user} />
          <span className="hint">8 caractères minimum ; code à 6 chiffres pour un salarié.</span>
        </div>
      </div>
      <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="label">Niveau d’accès</legend>
        <div className="stack-sm">
          {ACCESS_LEVELS.map((l) => (
            <label key={l.value} className="checkbox">
              <input type="radio" name="level" value={l.value} defaultChecked={level === l.value} required /> <strong>{l.label}</strong>{' '}
              <span className="small muted">{l.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="small muted">Périmètre d’un responsable (facultatif : sans choix, accès responsable complet hors paie)</legend>
        <div className="btn-row">
          {SCOPES.map((r) => (
            <label key={r.value} className="checkbox small">
              <input type="checkbox" name="scopes" value={r.value} defaultChecked={roles.includes(r.value)} /> {r.label}
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}

export default async function SettingsPage() {
  const ctx = await requireModule('parametres');
  const db = getDb();
  const users = listUsers(db, ctx.orgId);
  const employees = listEmployees(db, ctx.orgId).map((e) => ({ id: e.id, name: fullName(e) }));

  return (
    <>
      <PageHeader
        title="Membres et accès"
        subtitle="Qui peut se connecter, et à quoi. Désactivez un compte pour couper l’accès temporairement ; supprimez-le s’il n’a plus lieu d’être (son nom reste dans le journal)."
      />

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <h2 className="section-title">Membres</h2>
          <span className="small muted">
            {users.length} membre{users.length > 1 ? 's' : ''}, dont {users.filter((u) => !u.active).length} désactivé{users.filter((u) => !u.active).length > 1 ? 's' : ''}
          </span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Identifiant</th>
                <th>Niveau</th>
                <th>Fiche salarié</th>
                <th>Dernière connexion</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const roles = parseRoles(u.roles);
                const level = ACCESS_LEVELS.find((l) => l.value === accessLevel(roles));
                const self = u.id === ctx.userId;
                return (
                  <tr key={u.id} style={{ verticalAlign: 'top', opacity: u.active ? 1 : 0.65 }}>
                    <td>
                      <strong>{u.name}</strong>
                      {self && <span className="small muted"> (vous)</span>}
                      <div>{u.active ? <span className="badge">Actif</span> : <span className="badge badge-soft">Désactivé</span>}</div>
                    </td>
                    <td className="mono small">{u.login}</td>
                    <td>
                      <strong>{level?.label}</strong>
                      {level?.value === 'responsable' && <div className="small muted">{roles.map(roleLabel).join(', ')}</div>}
                    </td>
                    <td className="small">{employees.find((e) => e.id === u.employee_id)?.name ?? '·'}</td>
                    <td className="small">{u.last_login_at ? formatDateTime(u.last_login_at) : 'Jamais'}</td>
                    <td>
                      <div className="btn-row" style={{ alignItems: 'flex-start' }}>
                        {!self && (
                          <ActionForm
                            action={toggleMemberAction}
                            submitLabel={u.active ? 'Désactiver' : 'Réactiver'}
                            submitClassName="btn btn-ghost btn-sm"
                            className="btn-row"
                            confirmMessage={u.active ? `Désactiver ${u.name} ? Il ne pourra plus se connecter.` : undefined}
                          >
                            <input type="hidden" name="userId" value={u.id} />
                          </ActionForm>
                        )}
                        {!self && (
                          <ActionForm
                            action={deleteMemberAction}
                            submitLabel="Supprimer"
                            submitClassName="btn btn-danger btn-sm"
                            className="btn-row"
                            confirmMessage={`Supprimer définitivement le membre ${u.name} ? Son nom restera dans l’historique.`}
                          >
                            <input type="hidden" name="userId" value={u.id} />
                          </ActionForm>
                        )}
                      </div>
                      <details className="disclosure">
                        <summary>Modifier</summary>
                        <ActionForm action={updateMemberAction} submitLabel="Enregistrer" submitClassName="btn btn-sm">
                          <input type="hidden" name="userId" value={u.id} />
                          <MemberFields user={u} employees={employees} prefix={`u${u.id}`} />
                          <label className="checkbox small">
                            <input type="checkbox" name="active" defaultChecked={u.active === 1} /> Accès actif
                          </label>
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
          <h2 className="section-title">Ajouter un membre</h2>
          <span className="small muted">Un salarié peut aussi recevoir son accès depuis sa fiche.</span>
        </div>
        <div className="card-body">
          <ActionForm action={createMemberAction} submitLabel="Ajouter le membre" resetOnSuccess>
            <MemberFields employees={employees} prefix="new" />
          </ActionForm>
        </div>
      </section>
    </>
  );
}
