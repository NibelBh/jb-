import Image from 'next/image';
import Link from 'next/link';
import { CatIllustration } from '@/components/brand/CatIllustration';
import { FaqList } from '@/components/FaqList';
import {
  IconArrowRight,
  IconCheck,
  IconCheckCircle,
  IconDroplet,
  IconSparkle,
  IconVolumeLow,
} from '@/components/icons';
import { ProductCard } from '@/components/product/ProductCard';
import { Reassurance } from '@/components/Reassurance';
import { homeFaq } from '@/lib/faq';
import { formatPrice, pluralize } from '@/lib/format';
import { categories, getFeaturedProducts, getProductsByCategory } from '@/lib/products';
import { shipping, site } from '@/lib/site';
import styles from './page.module.css';

const categoryTones = ['green', 'cream', 'brown'] as const;

const litterSteps = [
  {
    title: 'Votre chat fait ses besoins',
    text: 'Les capteurs repèrent son passage et attendent qu’il soit sorti.',
  },
  {
    title: 'Le nettoyage démarre',
    text: 'Quelques minutes plus tard, le mécanisme sépare les agglomérats de la litière propre.',
  },
  {
    title: 'Vous videz le tiroir',
    text: 'Les déchets restent enfermés dans un sac. Il suffit de le changer quand il est plein.',
  },
];

export default function HomePage() {
  const featured = getFeaturedProducts();
  const litterFrom = Math.min(...getProductsByCategory('litieres-autonettoyantes').map((p) => p.price));

  return (
    <>
      <section className={styles.hero}>
        <div className={`container ${styles.heroInner}`}>
          <div className={styles.heroText}>
            <p className={styles.heroEyebrow}>Boutique en ligne pour chats</p>
            <h1 className={styles.heroTitle}>
              Moins de corvées, plus de <em>ronrons</em>.
            </h1>
            <p className={`lead ${styles.heroLead}`}>
              Litières autonettoyantes, fontaines à eau et consommables choisis pour le confort de votre chat. Et
              pour vous, beaucoup moins de ménage.
            </p>
            <div className={styles.heroActions}>
              <Link href="/boutique" className="btn btn-primary">
                Découvrir la boutique
                <IconArrowRight />
              </Link>
              <Link href="/boutique/litieres-autonettoyantes" className="btn btn-secondary">
                Voir les litières
              </Link>
            </div>
            <ul role="list" className={styles.heroChecks}>
              <li>
                <IconCheck />
                Paiement sécurisé
              </li>
              <li>
                <IconCheck />
                {shipping.dispatchDelay}
              </li>
            </ul>
          </div>

          <div className={styles.heroArt}>
            <div className={styles.arch} aria-hidden="true">
              <Image
                className={styles.artDome}
                src="/images/products/litiere-dome.svg"
                alt=""
                width={800}
                height={800}
                preload
              />
              <CatIllustration className={styles.artCat} />
              <Image
                className={styles.artFountain}
                src="/images/products/fontaine-inox.svg"
                alt=""
                width={800}
                height={800}
              />
            </div>
            <p className={`${styles.chip} ${styles.chipTop}`}>
              <IconSparkle />
              Nettoyage automatique
            </p>
            <p className={`${styles.chip} ${styles.chipMid}`}>
              <IconDroplet />
              Eau filtrée en continu
            </p>
            <Link href="/boutique/litieres-autonettoyantes" className={styles.priceTag}>
              <span>Litières autonettoyantes</span>
              <strong>dès {formatPrice(litterFrom)}</strong>
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.reassurance} aria-label="Nos engagements">
        <div className="container">
          <Reassurance />
        </div>
      </section>

      <section className="section" aria-labelledby="rayons-title">
        <div className="container">
          <div className="section-head">
            <div>
              <p className="eyebrow">Nos rayons</p>
              <h2 id="rayons-title">Tout pour le coin de votre chat</h2>
            </div>
          </div>
          <ul role="list" className={styles.categories}>
            {categories.map((category, index) => {
              const count = getProductsByCategory(category.slug).length;
              return (
                <li key={category.slug}>
                  <Link
                    href={`/boutique/${category.slug}`}
                    className={styles.categoryCard}
                    data-tone={categoryTones[index % categoryTones.length]}
                  >
                    <div className={styles.categoryMedia}>
                      <Image src={category.image} alt="" width={800} height={800} sizes="(max-width: 860px) 60vw, 300px" />
                    </div>
                    <div className={styles.categoryBody}>
                      <h3>{category.name}</h3>
                      <p>{category.description}</p>
                      <span className="link-arrow">
                        Voir les {pluralize(count, 'produit', 'produits')}
                        <IconArrowRight />
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="section section-alt" aria-labelledby="selection-title">
        <div className="container">
          <div className="section-head">
            <div>
              <p className="eyebrow">Sélection</p>
              <h2 id="selection-title">Les indispensables</h2>
              <p>Nos produits les plus demandés pour bien démarrer.</p>
            </div>
            <Link href="/boutique" className="link-arrow">
              Voir toute la boutique
              <IconArrowRight />
            </Link>
          </div>
          <ul role="list" className={styles.productGrid}>
            {featured.map((product) => (
              <li key={product.id}>
                <ProductCard product={product} />
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section" aria-labelledby="litiere-title">
        <div className={`container ${styles.split}`}>
          <div className={`${styles.splitMedia} ${styles.splitMediaBrown}`}>
            <Image src="/images/products/litiere-compacte.svg" alt="" width={800} height={800} sizes="(max-width: 860px) 90vw, 520px" />
            <p className={`${styles.chip} ${styles.chipSplit}`}>
              <IconCheckCircle />
              Cycle lancé 5 min après le passage
            </p>
          </div>
          <div className={styles.splitText}>
            <p className="eyebrow">Litière autonettoyante</p>
            <h2 id="litiere-title">Un bac propre, sans sortir la pelle</h2>
            <p className="lead">
              Fini le ramassage quotidien. La litière se nettoie seule après chaque visite et votre chat trouve
              toujours un bac net, ce qui compte beaucoup pour lui.
            </p>
            <ol className={styles.steps}>
              {litterSteps.map((step, index) => (
                <li key={step.title}>
                  <span className={styles.stepNumber} aria-hidden="true">
                    {index + 1}
                  </span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Link href="/boutique/litieres-autonettoyantes" className="btn btn-primary">
              Choisir ma litière
            </Link>
          </div>
        </div>
      </section>

      <section className="section section-alt" aria-labelledby="fontaine-title">
        <div className={`container ${styles.split} ${styles.splitReverse}`}>
          <div className={`${styles.splitMedia} ${styles.splitMediaGreen}`}>
            <Image src="/images/products/fontaine-ceramique.svg" alt="" width={800} height={800} sizes="(max-width: 860px) 90vw, 520px" />
          </div>
          <div className={styles.splitText}>
            <p className="eyebrow">Hydratation</p>
            <h2 id="fontaine-title">Une eau fraîche qui donne envie de boire</h2>
            <p className="lead">
              Beaucoup de chats boivent trop peu, surtout quand ils mangent des croquettes. L’eau en mouvement les
              attire davantage qu’une gamelle immobile, et le filtre la garde propre plus longtemps.
            </p>
            <ul role="list" className={styles.features}>
              <li>
                <IconDroplet />
                <span>
                  <strong>Eau filtrée en continu.</strong> Le filtre retient poils et impuretés, à changer toutes
                  les 2 à 4 semaines.
                </span>
              </li>
              <li>
                <IconVolumeLow />
                <span>
                  <strong>Pompe silencieuse.</strong> Elle se fait oublier, même posée dans une chambre.
                </span>
              </li>
              <li>
                <IconSparkle />
                <span>
                  <strong>Entretien facile.</strong> Plateau en inox ou bol en céramique, qui passent au
                  lave-vaisselle.
                </span>
              </li>
            </ul>
            <Link href="/boutique/fontaines-a-eau" className="btn btn-primary">
              Voir les fontaines
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.band} aria-labelledby="recharges-title">
        <div className={`container ${styles.bandInner}`}>
          <div>
            <h2 id="recharges-title">Pensez aux recharges</h2>
            <p>
              Sacs, filtres, litière et désodorisants compatibles avec nos appareils. Ajoutez-les à votre commande
              pour ne pas tomber à court.
            </p>
            <Link href="/boutique/consommables" className="btn btn-light">
              Voir les consommables
              <IconArrowRight />
            </Link>
          </div>
          <ul role="list" className={styles.bandProducts} aria-hidden="true">
            {['sacs-litiere', 'filtres-fontaine', 'litiere-vegetale'].map((name) => (
              <li key={name}>
                <Image src={`/images/products/${name}.svg`} alt="" width={800} height={800} sizes="160px" />
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section" aria-labelledby="faq-title">
        <div className={`container ${styles.faq}`}>
          <div className={styles.faqIntro}>
            <p className="eyebrow">Questions fréquentes</p>
            <h2 id="faq-title">Avant de vous lancer</h2>
            <p className="lead">
              Vous ne trouvez pas votre réponse ? Écrivez-nous : {site.contact.responseTime.toLowerCase()}.
            </p>
            <div className={styles.faqLinks}>
              <Link href="/faq" className="link-arrow">
                Toutes les questions
                <IconArrowRight />
              </Link>
              <Link href="/contact" className="link-arrow">
                Nous contacter
                <IconArrowRight />
              </Link>
            </div>
          </div>
          <FaqList items={homeFaq} />
        </div>
      </section>
    </>
  );
}
