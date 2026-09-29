import { redirect } from 'next/navigation';
import { getSession, homeFor } from '@/lib/auth';

export default async function Home() {
  const ctx = await getSession();
  redirect(ctx ? homeFor(ctx) : '/connexion');
}
