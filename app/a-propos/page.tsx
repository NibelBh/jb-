import type { Metadata } from 'next';
import Link from 'next/link';
import { CatIllustration } from '@/components/brand/CatIllustration';
import { IconChat, IconCheckCircle, IconLeaf } from '@/components/icons';
import { PageHeader } from '@/components/ui/PageHeader';
import { site } from '@/lib/site';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'À propos',
  description: `${site.name} sélectionne des litières autonettoyantes, des fontaines et des consommables pour simplifier la vie des chats et de leurs humains.`,
  alternates: { canonical: '/a-propos' },
};

// Textes d'exemple : racontez ici votre propre histoire et vos engagements.
const values = [
  {
    icon: IconCheckCircle,
    title: 'Une sélection courte',
    text: 'Peu de modèles, choisis pour leur fiabilité et leur entretien facile. Nous connaissons chacun d’eux en détail.',
  },
  {
    icon: IconLeaf,
    title: 'Des recharges toujours disponibles',
    text: 'Sacs, filtres et litière compatibles restent au catalogue, pour que votre appareil ne dorme jamais au placard faute de recharge.',
  },
  {
    icon: IconChat,
    title: 'Des conseils avant l’achat',
    text: 'Un doute sur le modèle adapté à votre chat ? Écrivez-nous avant de commander, nous vous aiderons à choisir.',
  },
];

export default function AboutPage() {
  return (
    <>
      <PageHeader
        eyebrow="À propos"
        title="Des chats heureux, des humains tranquilles"
        breadcrumbs={[{ label: 'Accueil', href: '/' }, { label: 'À propos' }]}
      />

      <section className="section">
        <div className={`container ${styles.story}`}>
          <div className={styles.storyText}>
            <h2>Pourquoi Tigerz ?</h2>
            <p className="lead">
              Tigerz est née d’un constat simple : entre la litière à ramasser chaque jour et la gamelle d’eau à
              changer, s’occuper d’un chat demande beaucoup de petites corvées.
            </p>
            <p>
              Les litières autonettoyantes et les fontaines filtrées règlent une bonne partie du problème, à
              condition de bien les choisir. Nous avons donc réuni une petite sélection d’appareils fiables, les
              consommables qui vont avec, et les conseils pour que votre chat les adopte sans stress.
            </p>
            <p>
              Notre catalogue reste volontairement court. Nous préférons proposer peu de modèles que nous
              connaissons bien, plutôt que des dizaines de références que personne ne peut vraiment conseiller.
            </p>
          </div>
          <div className={styles.storyArt} aria-hidden="true">
            <CatIllustration />
          </div>
        </div>
      </section>

      <section className="section section-alt" aria-labelledby="valeurs-title">
        <div className="container">
          <div className="section-head">
            <div>
              <p className="eyebrow">Nos engagements</p>
              <h2 id="valeurs-title">Ce qui guide nos choix</h2>
            </div>
          </div>
          <ul role="list" className={styles.values}>
            {values.map(({ icon: Icon, title, text }) => (
              <li key={title} className={styles.value}>
                <span className={styles.valueIcon}>
                  <Icon />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section">
        <div className={`container-narrow ${styles.cta}`}>
          <h2>Envie d’en parler ?</h2>
          <p className="lead">Une question sur un produit ou sur votre chat : nous vous répondons avec plaisir.</p>
          <div className={styles.ctaActions}>
            <Link href="/boutique" className="btn btn-primary">
              Voir la boutique
            </Link>
            <Link href="/contact" className="btn btn-secondary">
              Nous contacter
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
