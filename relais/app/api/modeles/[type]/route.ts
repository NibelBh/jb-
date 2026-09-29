import { getSession } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { IMPORT_KINDS, importTemplate, isImportKind } from '@/lib/data/imports';
import { payrollMonth } from '@/lib/data/payroll';
import { toCsv } from '@/lib/domain/csv';
import { parisDate } from '@/lib/domain/dates';
import { isPeriod } from '@/lib/domain/payroll';
import { can } from '@/lib/domain/roles';

function csvResponse(csv: string, name: string) {
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'no-store',
    },
  });
}

/** Modèles CSV à remplir : en-têtes reconnus par les imports, avec une ligne d'exemple. */
export async function GET(request: Request, ctx: RouteContext<'/api/modeles/[type]'>) {
  const session = await getSession();
  if (!session) return new Response('Non connecté', { status: 401 });
  const { type } = await ctx.params;

  if (isImportKind(type)) {
    if (!can(session.roles, IMPORT_KINDS[type].action)) return new Response('Accès refusé', { status: 403 });
    const t = importTemplate(type);
    return csvResponse(toCsv(t.header, [t.example]), `modele-${type}.csv`);
  }

  if (type === 'journal-paie') {
    if (!can(session.roles, 'paie.gerer')) return new Response('Accès refusé', { status: 403 });
    const period = new URL(request.url).searchParams.get('mois') ?? parisDate().slice(0, 7);
    if (!isPeriod(period)) return new Response('Période invalide', { status: 400 });
    // Pré-rempli avec les salariés du mois : il ne reste qu'à reporter les montants du journal de paie.
    const month = payrollMonth(getDb(), session.orgId, period);
    const rows = month.lines.map((l) => [l.payrollId ?? '', l.lastName, l.firstName, period, '', '', '']);
    return csvResponse(toCsv(['matricule', 'nom', 'prenom', 'periode', 'brut', 'net', 'cout_employeur'], rows), `journal-paie-${period}.csv`);
  }

  return new Response('Modèle inconnu', { status: 404 });
}
