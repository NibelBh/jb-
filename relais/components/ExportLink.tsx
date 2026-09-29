/** Lien de téléchargement d'un export CSV (route handler, pas une page : pas de <Link>). */
export function ExportLink({ type }: { type: 'vehicules' | 'personnel' | 'dommages' | 'amendes' | 'journal' }) {
  const href = `/api/export/${type}`;
  return (
    <a href={href} className="btn btn-ghost" download>
      Exporter (CSV)
    </a>
  );
}
