import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { formatPrice } from '@/lib/format';
import { legal, returns, shipping, site } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Conditions générales de vente',
  description: `Conditions générales de vente de la boutique en ligne ${site.name}.`,
  alternates: { canonical: '/cgv' },
};

/*
 * Modèle de CGV pour la vente en ligne à des consommateurs en France.
 * Complétez les informations dans lib/site.ts et faites relire ce texte par
 * un professionnel du droit avant l'ouverture de la boutique.
 */
export default function TermsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Informations légales"
        title="Conditions générales de vente"
        intro={`Dernière mise à jour : ${legal.lastUpdated}`}
        breadcrumbs={[{ label: 'Accueil', href: '/' }, { label: 'Conditions générales de vente' }]}
      />
      <section className="section">
        <div className="container-narrow prose">
          <h2>1. Objet</h2>
          <p>
            Les présentes conditions générales de vente (CGV) s’appliquent à toutes les commandes passées sur le
            site {site.name} par des consommateurs, c’est-à-dire des personnes physiques agissant à des fins
            étrangères à leur activité professionnelle. Elles doivent être acceptées avant toute commande.
          </p>

          <h2>2. Vendeur</h2>
          <p>
            Le site est exploité par {legal.companyName}, {legal.legalForm}, dont le siège est situé{' '}
            {legal.address}, immatriculée sous le numéro SIRET {legal.siret} ({legal.rcs}), numéro de TVA
            intracommunautaire {legal.vatNumber}.
          </p>
          <p>
            Service client : <a href={`mailto:${site.contact.email}`}>{site.contact.email}</a>
            {site.contact.phone ? `, ${site.contact.phone}` : ''}. {site.contact.hours}.
          </p>

          <h2>3. Produits</h2>
          <p>
            Les caractéristiques essentielles des produits sont présentées sur chaque fiche produit. Les offres sont
            valables dans la limite des stocks disponibles. Si un produit devient indisponible après votre commande,
            nous vous en informons et vous remboursons sans délai.
          </p>

          <h2>4. Prix</h2>
          <p>
            Les prix sont indiqués en euros, toutes taxes comprises (TTC). Ils incluent, le cas échéant,
            l’éco-participation due sur les équipements électriques. Les frais de livraison sont indiqués avant la
            validation de la commande : {formatPrice(shipping.standard.price)} en livraison standard, offerte dès{' '}
            {formatPrice(shipping.freeShippingThreshold)} d’achat, et {formatPrice(shipping.express.price)} en
            livraison express. Le prix facturé est celui affiché au moment de la validation de la commande.
          </p>

          <h2>5. Commande</h2>
          <p>Pour commander, vous suivez les étapes suivantes :</p>
          <ol>
            <li>vous ajoutez les produits choisis à votre panier ;</li>
            <li>vous vérifiez le contenu du panier et acceptez les présentes CGV ;</li>
            <li>
              vous êtes redirigé vers la page de paiement sécurisée, où vous indiquez vos coordonnées, votre adresse
              de livraison et le mode de livraison, puis vous vérifiez le récapitulatif ;
            </li>
            <li>vous validez la commande avec obligation de paiement en cliquant sur le bouton « Payer ».</li>
          </ol>
          <p>
            Le contrat est conclu dès la confirmation du paiement. Un récapitulatif de la commande vous est envoyé
            par e-mail. Nous nous réservons le droit de refuser une commande en cas de litige existant avec le
            client ou de suspicion de fraude.
          </p>

          <h2>6. Paiement</h2>
          <p>
            Le paiement s’effectue en ligne, au moment de la commande, par carte bancaire ou par les autres moyens
            proposés sur la page de paiement (par exemple Apple Pay ou Google Pay). Il est traité par notre
            prestataire Stripe, certifié PCI-DSS. Vos données bancaires ne sont jamais transmises ni conservées
            par {site.name}.
          </p>

          <h2>7. Livraison</h2>
          <p>
            Nous livrons en {shipping.countryNames}. {shipping.dispatchDelay}, puis le transporteur livre en{' '}
            {shipping.standard.minDays} à {shipping.standard.maxDays} jours ouvrés en livraison standard, ou{' '}
            {shipping.express.minDays} à {shipping.express.maxDays} jours ouvrés en livraison express. Sauf délai
            différent indiqué lors de la commande, la livraison intervient au plus tard 30 jours après la
            conclusion du contrat.
          </p>
          <p>
            En cas de retard, vous pouvez nous demander de livrer dans un délai supplémentaire raisonnable. Si la
            livraison n’a pas lieu dans ce délai, vous pouvez résoudre le contrat par écrit et être remboursé
            conformément aux articles L. 216-6 et L. 216-7 du Code de la consommation.
          </p>
          <p>
            Les risques de perte ou d’endommagement vous sont transférés lorsque vous, ou un tiers désigné par
            vous, prenez physiquement possession des produits. En cas de colis abîmé, nous vous conseillons de
            noter des réserves précises auprès du transporteur et de nous prévenir rapidement.
          </p>

          <h2 id="retractation">8. Droit de rétractation</h2>
          <p>
            Conformément à l’article L. 221-18 du Code de la consommation, vous disposez d’un délai de{' '}
            {returns.days} jours à compter de la réception des produits pour vous rétracter, sans avoir à motiver
            votre décision. Pour une commande livrée en plusieurs fois, le délai court à compter de la réception du
            dernier produit.
          </p>
          <p>
            Pour exercer ce droit, informez-nous de votre décision par une déclaration dénuée d’ambiguïté, par
            exemple par e-mail à <a href={`mailto:${site.contact.email}`}>{site.contact.email}</a>, ou en utilisant
            le formulaire ci-dessous. Vous devez ensuite renvoyer les produits au plus tard 14 jours après nous
            avoir informés. Les frais de retour sont à votre charge.
          </p>
          <p>
            Nous vous remboursons la totalité des sommes versées, frais de livraison inclus (dans la limite du tarif
            de la livraison standard), au plus tard 14 jours après avoir été informés de votre décision. Nous
            pouvons différer le remboursement jusqu’à la récupération des produits ou jusqu’à ce que vous ayez
            fourni une preuve de leur expédition. Le remboursement utilise le même moyen de paiement que celui de
            la commande.
          </p>
          <p>
            Votre responsabilité n’est engagée qu’en cas de dépréciation des produits résultant de manipulations
            autres que celles nécessaires pour établir leur nature, leurs caractéristiques et leur bon
            fonctionnement (article L. 221-23 du Code de la consommation).
          </p>

          <div className="callout">
            <h3>Formulaire de rétractation</h3>
            <p>
              <em>(Complétez et renvoyez ce formulaire uniquement si vous souhaitez vous rétracter du contrat.)</em>
            </p>
            <p>
              À l’attention de {legal.companyName}, {legal.address}, {site.contact.email} :
            </p>
            <p>
              Je/nous (*) vous notifie/notifions (*) par la présente ma/notre (*) rétractation du contrat portant sur
              la vente du bien (*) ci-dessous :
            </p>
            <ul>
              <li>Commandé le (*) / reçu le (*) :</li>
              <li>Nom du (des) consommateur(s) :</li>
              <li>Adresse du (des) consommateur(s) :</li>
              <li>Signature du (des) consommateur(s) (uniquement en cas de notification sur papier) :</li>
              <li>Date :</li>
            </ul>
            <p>
              <em>(*) Rayez la mention inutile.</em>
            </p>
          </div>

          <h2 id="garanties">9. Garanties légales</h2>
          <p>
            Tous les produits vendus bénéficient de la garantie légale de conformité (articles L. 217-1 et
            suivants du Code de la consommation) et de la garantie légale des vices cachés (articles 1641 à 1649 du
            Code civil). Pour mettre en œuvre une garantie, contactez notre service client.
          </p>
          <div className="callout">
            <p>
              Le consommateur dispose d’un délai de deux ans à compter de la délivrance du bien pour obtenir la
              mise en œuvre de la garantie légale de conformité en cas d’apparition d’un défaut de conformité.
              Durant ce délai, le consommateur n’est tenu d’établir que l’existence du défaut de conformité et non
              la date d’apparition de celui-ci.
            </p>
            <p>
              Lorsque le contrat de vente du bien prévoit la fourniture d’un contenu numérique ou d’un service
              numérique de manière continue pendant une durée supérieure à deux ans, la garantie légale est
              applicable à ce contenu numérique ou ce service numérique tout au long de la période de fourniture
              prévue. Durant ce délai, le consommateur n’est tenu d’établir que l’existence du défaut de conformité
              affectant le contenu numérique ou le service numérique et non la date d’apparition de celui-ci.
            </p>
            <p>
              La garantie légale de conformité emporte obligation pour le professionnel, le cas échéant, de fournir
              toutes les mises à jour nécessaires au maintien de la conformité du bien.
            </p>
            <p>
              La garantie légale de conformité donne au consommateur droit à la réparation ou au remplacement du
              bien dans un délai de trente jours suivant sa demande, sans frais et sans inconvénient majeur pour
              lui.
            </p>
            <p>
              Si le bien est réparé dans le cadre de la garantie légale de conformité, le consommateur bénéficie
              d’une extension de six mois de la garantie initiale.
            </p>
            <p>
              Si le consommateur demande la réparation du bien, mais que le vendeur impose le remplacement, la
              garantie légale de conformité est renouvelée pour une période de deux ans à compter de la date de
              remplacement du bien.
            </p>
            <p>
              Le consommateur peut obtenir une réduction du prix d’achat en conservant le bien ou mettre fin au
              contrat en se faisant rembourser intégralement contre restitution du bien, si :
            </p>
            <ol>
              <li>le professionnel refuse de réparer ou de remplacer le bien ;</li>
              <li>la réparation ou le remplacement du bien intervient après un délai de trente jours ;</li>
              <li>
                la réparation ou le remplacement du bien occasionne un inconvénient majeur pour le consommateur,
                notamment lorsque le consommateur supporte définitivement les frais de reprise ou d’enlèvement du
                bien non conforme, ou s’il supporte les frais d’installation du bien réparé ou de remplacement ;
              </li>
              <li>
                la non-conformité du bien persiste en dépit de la tentative de mise en conformité du vendeur restée
                infructueuse.
              </li>
            </ol>
            <p>
              Le consommateur a également droit à une réduction du prix du bien ou à la résolution du contrat
              lorsque le défaut de conformité est si grave qu’il justifie que la réduction du prix ou la résolution
              du contrat soit immédiate. Le consommateur n’est alors pas tenu de demander la réparation ou le
              remplacement du bien au préalable.
            </p>
            <p>Le consommateur n’a pas droit à la résolution de la vente si le défaut de conformité est mineur.</p>
            <p>
              Toute période d’immobilisation du bien en vue de sa réparation ou de son remplacement suspend la
              garantie qui restait à courir jusqu’à la délivrance du bien remis en état.
            </p>
            <p>
              Les droits mentionnés ci-dessus résultent de l’application des articles L. 217-1 à L. 217-32 du Code
              de la consommation.
            </p>
            <p>
              Le vendeur qui fait obstacle de mauvaise foi à la mise en œuvre de la garantie légale de conformité
              encourt une amende civile d’un montant maximal de 300 000 euros, qui peut être porté jusqu’à 10 % du
              chiffre d’affaires moyen annuel (article L. 241-5 du Code de la consommation).
            </p>
            <p>
              Le consommateur bénéficie également de la garantie légale des vices cachés en application des articles
              1641 à 1649 du Code civil, pendant une durée de deux ans à compter de la découverte du défaut. Cette
              garantie donne droit à une réduction de prix si le bien est conservé ou à un remboursement intégral
              contre restitution du bien.
            </p>
          </div>

          <h2>10. Reprise des équipements électriques usagés</h2>
          <p>
            Lors de l’achat d’un équipement électrique, vous pouvez nous remettre gratuitement un équipement usagé
            de même type, dans la limite de la quantité achetée, afin qu’il soit collecté et recyclé. Contactez
            notre service client pour organiser cette reprise.
          </p>

          <h2>11. Réclamations et médiation</h2>
          <p>
            Pour toute réclamation, contactez notre service client à{' '}
            <a href={`mailto:${site.contact.email}`}>{site.contact.email}</a>. Si aucune solution n’a été trouvée
            après une réclamation écrite, vous pouvez recourir gratuitement au médiateur de la consommation dont
            nous relevons, conformément aux articles L. 612-1 et suivants du Code de la consommation :{' '}
            {legal.mediator.name}, {legal.mediator.address}, {legal.mediator.website}.
          </p>

          <h2>12. Données personnelles</h2>
          <p>
            Les données recueillies lors de votre commande sont nécessaires à son traitement. Leur utilisation et
            vos droits sont détaillés dans notre <Link href="/confidentialite">politique de confidentialité</Link>.
          </p>

          <h2>13. Droit applicable</h2>
          <p>
            Les présentes CGV sont soumises au droit français. Elles ne privent pas le consommateur résidant dans un
            autre pays de l’Union européenne de la protection que lui accordent les dispositions impératives du droit
            de son pays de résidence. En cas de litige, les tribunaux compétents sont ceux désignés par les règles
            de droit commun.
          </p>
        </div>
      </section>
    </>
  );
}
