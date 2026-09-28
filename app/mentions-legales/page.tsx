import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { legal, site } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Mentions légales',
  alternates: { canonical: '/mentions-legales' },
};

export default function LegalNoticePage() {
  return (
    <>
      <PageHeader
        eyebrow="Informations légales"
        title="Mentions légales"
        intro={`Dernière mise à jour : ${legal.lastUpdated}`}
        breadcrumbs={[{ label: 'Accueil', href: '/' }, { label: 'Mentions légales' }]}
      />
      <section className="section">
        <div className="container-narrow prose">
          <h2>Éditeur du site</h2>
          <p>
            {legal.companyName}, {legal.legalForm}
            <br />
            Siège social : {legal.address}
            <br />
            SIRET : {legal.siret} ({legal.rcs})
            <br />
            TVA intracommunautaire : {legal.vatNumber}
            <br />
            Contact : <a href={`mailto:${site.contact.email}`}>{site.contact.email}</a>
            {site.contact.phone && (
              <>
                <br />
                Téléphone : {site.contact.phone}
              </>
            )}
          </p>
          <p>Directeur ou directrice de la publication : {legal.publicationDirector}</p>

          <h2>Hébergement</h2>
          <p>
            {legal.host.name}
            <br />
            {legal.host.address}
            <br />
            <a href={legal.host.website} rel="noopener noreferrer" target="_blank">
              {legal.host.website}
            </a>
          </p>

          <h2>Paiement</h2>
          <p>
            Les paiements sont traités par Stripe Payments Europe, Ltd. {site.name} n’a jamais accès à vos
            coordonnées bancaires.
          </p>

          <h2>Propriété intellectuelle</h2>
          <p>
            Les textes, illustrations, logos et éléments graphiques de ce site sont la propriété de{' '}
            {legal.companyName} ou de leurs auteurs respectifs. Toute reproduction sans autorisation préalable est
            interdite.
          </p>

          <h2>Données personnelles et cookies</h2>
          <p>
            Le traitement de vos données personnelles est décrit dans notre{' '}
            <Link href="/confidentialite">politique de confidentialité</Link>. Ce site n’utilise pas de cookies
            publicitaires ni de mesure d’audience : seul le contenu de votre panier est enregistré dans votre
            navigateur.
          </p>
        </div>
      </section>
    </>
  );
}
