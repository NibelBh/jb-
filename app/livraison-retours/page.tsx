import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { formatPrice } from '@/lib/format';
import { returns, shipping, site } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Livraison et retours',
  description: `Délais et frais de livraison, retours sous ${returns.days} jours et garanties : tout savoir avant de commander chez ${site.name}.`,
  alternates: { canonical: '/livraison-retours' },
};

export default function ShippingPage() {
  return (
    <>
      <PageHeader
        eyebrow="Aide"
        title="Livraison et retours"
        intro={`Livraison offerte dès ${formatPrice(shipping.freeShippingThreshold)} d’achat et ${returns.days} jours pour changer d’avis.`}
        breadcrumbs={[{ label: 'Accueil', href: '/' }, { label: 'Livraison et retours' }]}
      />
      <section className="section">
        <div className="container-narrow prose">
          <h2>Zones de livraison</h2>
          <p>Nous livrons en {shipping.countryNames}.</p>

          <h2>Délais et tarifs</h2>
          <p>{shipping.dispatchDelay} après la confirmation de votre paiement.</p>
          <ul>
            <li>
              <strong>{shipping.standard.label}</strong> : {formatPrice(shipping.standard.price)}, livrée en{' '}
              {shipping.standard.minDays} à {shipping.standard.maxDays} jours ouvrés. Offerte dès{' '}
              {formatPrice(shipping.freeShippingThreshold)} d’achat.
            </li>
            <li>
              <strong>{shipping.express.label}</strong> : {formatPrice(shipping.express.price)}, livrée en{' '}
              {shipping.express.minDays} à {shipping.express.maxDays} jours ouvrés.
            </li>
          </ul>
          <p>
            Le mode de livraison se choisit à l’étape du paiement. Vous recevez un e-mail avec le numéro de suivi dès
            l’expédition de votre colis.
          </p>

          <h2>À la réception</h2>
          <p>
            Vérifiez l’état du colis en présence du livreur. S’il est abîmé, notez des réserves précises sur le bon
            de livraison ou refusez-le, puis prévenez-nous sous 48 heures avec quelques photos. Nous organisons
            alors un remplacement ou un remboursement.
          </p>

          <h2>Changer d’avis : {returns.days} jours pour nous retourner un produit</h2>
          <p>
            Vous disposez de {returns.days} jours à compter de la réception de votre commande pour exercer votre
            droit de rétractation, sans avoir à donner de motif.
          </p>
          <ol>
            <li>
              Écrivez-nous à <a href={`mailto:${site.contact.email}`}>{site.contact.email}</a> en indiquant votre
              numéro de commande, ou utilisez le formulaire de rétractation présent dans nos{' '}
              <Link href="/cgv#retractation">conditions générales de vente</Link>.
            </li>
            <li>Nous vous envoyons l’adresse de retour.</li>
            <li>
              Renvoyez le produit complet, avec ses accessoires et si possible dans son emballage d’origine, au plus
              tard 14 jours après nous avoir informés.
            </li>
          </ol>
          <p>
            Nous vous remboursons le prix des produits et les frais de livraison standard au plus tard 14 jours
            après votre demande. Nous pouvons attendre d’avoir reçu le produit, ou la preuve de son expédition,
            avant d’effectuer le remboursement. Il est fait sur le moyen de paiement utilisé lors de la commande.
          </p>
          <p>
            Les frais de retour restent à votre charge, sauf si le produit est défectueux ou si nous avons commis
            une erreur. Vous pouvez manipuler le produit pour l’essayer comme vous le feriez en magasin ; une
            dépréciation liée à une autre utilisation peut être déduite du remboursement.
          </p>

          <h2>Produit défectueux</h2>
          <p>
            Tous nos produits bénéficient de la garantie légale de conformité pendant 2 ans à compter de la
            livraison, et de la garantie des vices cachés. En cas de panne ou de défaut, contactez-nous : nous
            réparons ou remplaçons le produit sans frais. Le détail de ces garanties figure dans nos{' '}
            <Link href="/cgv#garanties">conditions générales de vente</Link>.
          </p>

          <h2>Reprise de votre ancien appareil</h2>
          <p>
            Pour l’achat d’une litière autonettoyante ou d’une fontaine, vous pouvez nous confier gratuitement
            votre ancien appareil électrique du même type afin qu’il soit recyclé. Contactez-nous pour organiser la
            reprise.
          </p>
        </div>
      </section>
    </>
  );
}
