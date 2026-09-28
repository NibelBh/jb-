import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/PageHeader';
import { legal, site } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Politique de confidentialité',
  alternates: { canonical: '/confidentialite' },
};

export default function PrivacyPage() {
  return (
    <>
      <PageHeader
        eyebrow="Informations légales"
        title="Politique de confidentialité"
        intro={`Dernière mise à jour : ${legal.lastUpdated}`}
        breadcrumbs={[{ label: 'Accueil', href: '/' }, { label: 'Confidentialité' }]}
      />
      <section className="section">
        <div className="container-narrow prose">
          <p>
            Cette page explique quelles données personnelles {site.name} recueille, pourquoi, et comment exercer vos
            droits, conformément au Règlement général sur la protection des données (RGPD) et à la loi Informatique
            et Libertés.
          </p>

          <h2>Responsable du traitement</h2>
          <p>
            {legal.companyName}, {legal.address}. Contact :{' '}
            <a href={`mailto:${site.contact.email}`}>{site.contact.email}</a>.
          </p>

          <h2>Données recueillies et utilisation</h2>
          <ul>
            <li>
              <strong>Commandes</strong> : nom, adresse e-mail, adresse de livraison et de facturation, numéro de
              téléphone et contenu de la commande. Ces données servent à traiter, livrer et suivre votre commande
              (exécution du contrat) et à respecter nos obligations comptables et fiscales (obligation légale).
            </li>
            <li>
              <strong>Échanges avec le service client</strong> : les informations que vous nous transmettez par
              e-mail, pour répondre à vos demandes (intérêt légitime ou exécution du contrat).
            </li>
            <li>
              <strong>Paiement</strong> : vos données bancaires sont saisies directement sur la page de paiement de
              Stripe et ne sont jamais transmises à {site.name}.
            </li>
          </ul>
          <p>Nous ne vendons pas vos données et ne les utilisons pas à des fins publicitaires.</p>

          <h2>Destinataires</h2>
          <p>Vos données sont accessibles à notre équipe et, pour ce qui les concerne, à nos prestataires :</p>
          <ul>
            <li>Stripe, pour le paiement ;</li>
            <li>le transporteur chargé de la livraison ;</li>
            <li>{legal.host.name}, hébergeur du site.</li>
          </ul>
          <p>
            Certains de ces prestataires peuvent traiter des données hors de l’Union européenne. Ces transferts sont
            encadrés par les garanties prévues par le RGPD, comme les clauses contractuelles types de la Commission
            européenne ou le cadre de protection des données UE-États-Unis.
          </p>

          <h2>Durées de conservation</h2>
          <ul>
            <li>Données de commande : 10 ans, durée imposée pour les pièces comptables.</li>
            <li>Échanges avec le service client : 3 ans après le dernier contact.</li>
          </ul>

          <h2>Cookies et stockage local</h2>
          <p>
            Le site n’utilise ni cookie publicitaire ni outil de mesure d’audience. Le contenu de votre panier est
            enregistré dans le stockage local de votre navigateur pour le retrouver lors de votre prochaine visite ;
            il n’est pas transmis à nos serveurs avant votre commande. La page de paiement Stripe peut déposer ses
            propres cookies, nécessaires à la sécurité des transactions.
          </p>

          <h2>Vos droits</h2>
          <p>
            Vous disposez d’un droit d’accès, de rectification, d’effacement, de limitation, d’opposition et de
            portabilité de vos données. Pour les exercer, écrivez-nous à{' '}
            <a href={`mailto:${site.contact.email}`}>{site.contact.email}</a>. Nous répondons dans un délai d’un
            mois.
          </p>
          <p>
            Si vous estimez que vos droits ne sont pas respectés, vous pouvez adresser une réclamation à la CNIL (
            <a href="https://www.cnil.fr" rel="noopener noreferrer" target="_blank">
              www.cnil.fr
            </a>
            ).
          </p>
        </div>
      </section>
    </>
  );
}
