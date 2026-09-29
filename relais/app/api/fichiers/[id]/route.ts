import { getSession } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { readFile } from '@/lib/data/files';

/** Fichiers envoyés (photos, documents) : jamais publics, toujours cloisonnés par organisation. */
export async function GET(_request: Request, ctx: RouteContext<'/api/fichiers/[id]'>) {
  const session = await getSession();
  if (!session) return new Response('Non connecté', { status: 401 });
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return new Response('Introuvable', { status: 404 });
  const file = readFile(getDb(), session.orgId, id);
  if (!file) return new Response('Introuvable', { status: 404 });
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      'Content-Type': file.row.mime,
      'Content-Length': String(file.bytes.length),
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(file.row.name)}`,
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
    },
  });
}
