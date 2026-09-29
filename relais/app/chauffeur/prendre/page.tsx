import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireDriver } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { availableVehicles } from '@/lib/data/driver';
import { openAssignmentFor, pendingInspectionFor } from '@/lib/data/operations';
import { takeVehicleAction } from '../actions';
import styles from '../driver.module.css';
import { InspectionForm } from '../InspectionForm';

export const metadata: Metadata = { title: 'Prendre le véhicule' };

export default async function TakeVehiclePage(props: PageProps<'/chauffeur/prendre'>) {
  const ctx = await requireDriver();
  const db = getDb();
  if (openAssignmentFor(db, ctx.orgId, ctx.employeeId) || pendingInspectionFor(db, ctx.orgId, ctx.employeeId)) redirect('/chauffeur');
  const params = await props.searchParams;
  const vehicles = availableVehicles(db, ctx.orgId);
  const selected = vehicles.find((v) => String(v.id) === params.vehicule);

  if (!selected) {
    return (
      <>
        <Link href="/chauffeur" className={styles.backLink}>
          ← Retour
        </Link>
        <h1 style={{ color: 'var(--white)' }}>Quel véhicule prenez-vous ?</h1>
        {params.vehicule && <p className={`${styles.notice} ${styles.noticeRed}`}>Le véhicule prévu n’est pas disponible. Choisissez-en un autre ou appelez votre responsable.</p>}
        <div className={styles.list}>
          {vehicles.length === 0 && <p className={styles.notice}>Aucun véhicule disponible. Appelez votre responsable.</p>}
          {vehicles.map((v) => (
            <Link key={v.id} href={`/chauffeur/prendre?vehicule=${v.id}`} className={styles.secondary}>
              <span className={styles.plate}>{v.plate}</span>
              <span className={styles.muted}>{[v.brand, v.model].filter(Boolean).join(' ')}</span>
            </Link>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <Link href="/chauffeur/prendre" className={styles.backLink}>
        ← Changer de véhicule
      </Link>
      <h1 style={{ color: 'var(--white)' }}>
        Départ avec <span className={styles.plate}>{selected.plate}</span>
      </h1>
      <InspectionForm action={takeVehicleAction} vehicleId={selected.id} lastKm={selected.current_km} submitLabel="Valider et partir" />
    </>
  );
}
