import type { Metadata } from 'next';
import Link from 'next/link';
import { requireDriver } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { reportableVehicles } from '@/lib/data/driver';
import { openAssignmentFor } from '@/lib/data/operations';
import { reportProblemAction } from '../actions';
import styles from '../driver.module.css';
import { ReportForm } from '../ReportForm';

export const metadata: Metadata = { title: 'Signaler un problème' };

export default async function ReportPage(props: PageProps<'/chauffeur/signaler'>) {
  const ctx = await requireDriver();
  const db = getDb();
  const params = await props.searchParams;
  const open = openAssignmentFor(db, ctx.orgId, ctx.employeeId);
  const vehicles = reportableVehicles(db, ctx.orgId);
  const requested = Number(params.vehicule);
  const defaultVehicleId = vehicles.some((v) => v.id === requested) ? requested : open?.vehicle_id;

  return (
    <>
      <Link href="/chauffeur" className={styles.backLink}>
        ← Retour
      </Link>
      <h1 style={{ color: 'var(--white)' }}>Signaler un problème</h1>
      <ReportForm action={reportProblemAction} vehicles={vehicles} defaultVehicleId={defaultVehicleId} />
    </>
  );
}
