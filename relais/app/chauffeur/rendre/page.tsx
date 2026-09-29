import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireDriver } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { openAssignmentFor } from '@/lib/data/operations';
import { getVehicle } from '@/lib/data/vehicles';
import { returnVehicleAction } from '../actions';
import styles from '../driver.module.css';
import { InspectionForm } from '../InspectionForm';

export const metadata: Metadata = { title: 'Rendre le véhicule' };

export default async function ReturnVehiclePage() {
  const ctx = await requireDriver();
  const db = getDb();
  const open = openAssignmentFor(db, ctx.orgId, ctx.employeeId);
  if (!open) redirect('/chauffeur');
  const vehicle = getVehicle(db, ctx.orgId, open.vehicle_id);

  return (
    <>
      <Link href="/chauffeur" className={styles.backLink}>
        ← Retour
      </Link>
      <h1 style={{ color: 'var(--white)' }}>
        Retour de <span className={styles.plate}>{open.plate}</span>
      </h1>
      <p className={styles.muted}>
        État du véhicule en fin de journée. Les photos sont rattachées au véhicule, à vous et à votre journée. Un nouveau dégât crée un dossier pour le responsable.
      </p>
      <InspectionForm action={returnVehicleAction} lastKm={vehicle?.current_km ?? 0} submitLabel="Valider l’état et rendre le véhicule" kind="retour" />
    </>
  );
}
