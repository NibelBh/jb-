import { getSession } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { payrollCodes, payrollMonth, recordPayrollExport } from '@/lib/data/payroll';
import { parisDate } from '@/lib/domain/dates';
import { isPeriod, payrollImportCsv, recapCsv } from '@/lib/domain/payroll';
import { can, canAccess } from '@/lib/domain/roles';

/** Fichiers de variables de paie d'un mois : récapitulatif (cabinet) ou import (logiciel de paie). */
export async function GET(request: Request, ctx: RouteContext<'/api/paie/[format]'>) {
  const session = await getSession();
  if (!session) return new Response('Non connecté', { status: 401 });
  if (!canAccess(session.roles, 'paie') || !can(session.roles, 'paie.gerer')) return new Response('Accès refusé', { status: 403 });
  const { format } = await ctx.params;
  if (format !== 'recapitulatif' && format !== 'import') return new Response('Format inconnu', { status: 404 });
  const period = new URL(request.url).searchParams.get('mois') ?? '';
  if (!isPeriod(period)) return new Response('Période invalide', { status: 400 });

  const db = getDb();
  const month = payrollMonth(db, session.orgId, period, parisDate());
  let csv: string;
  let rows: number;
  if (format === 'import') {
    ({ csv, rows } = payrollImportCsv(month.lines, period, payrollCodes(db, session.orgId)));
  } else {
    csv = recapCsv(month.lines, period);
    rows = month.lines.length;
  }
  recordPayrollExport(db, session, period, format, rows);

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="variables-paie-${period}-${format}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
