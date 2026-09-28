import type { Metadata } from 'next';
import Link from 'next/link';
import { FaqList } from '@/components/FaqList';
import { PageHeader } from '@/components/ui/PageHeader';
import { faqGroups } from '@/lib/faq';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Questions fréquentes',
  description:
    'Litière autonettoyante, fontaine à eau, livraison, paiement, retours : les réponses aux questions les plus courantes.',
  alternates: { canonical: '/faq' },
};

export default function FaqPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqGroups.flatMap((group) =>
      group.items.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    ),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <PageHeader
        eyebrow="Aide"
        title="Questions fréquentes"
        intro={
          <>
            Vous ne trouvez pas votre réponse ? <Link href="/contact">Contactez-nous</Link>.
          </>
        }
        breadcrumbs={[{ label: 'Accueil', href: '/' }, { label: 'Questions fréquentes' }]}
      />
      <section className="section">
        <div className={`container-narrow ${styles.groups}`}>
          {faqGroups.map((group) => (
            <section key={group.title} aria-labelledby={`faq-${group.title}`}>
              <h2 id={`faq-${group.title}`} className={styles.title}>
                {group.title}
              </h2>
              <FaqList items={group.items} />
            </section>
          ))}
        </div>
      </section>
    </>
  );
}
