import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { analytics } from '@/lib/analytics';
import { useLanguagePrefix } from '@/hooks/useLanguagePrefix';

interface FAQItem {
  key: string;
  question: string;
  answer: string;
  // Optional: link to related page
  relatedLink?: {
    text: string;
    href: string;
  };
}

// Reordered: high-intent questions first for better SEO
const FAQ_KEYS = [
  'howToFind', // "How to check who unfollowed" - highest intent
  'withoutDownload', // NEW: "Can I check without download" - captures "no app" searches
  'privacy', // "How does it work without login" - trust + method
  'safety', // "Is it safe to use" - trust signal
  'dataIncluded', // NEW: "What data is included" - educational
  'zipFile', // "What is data download" - educational
  'accountSafety', // "Is account safe" - trust
  'downloadTime', // NEW: "How long to receive" - practical
  'scale', // "How many accounts" - differentiator
  'free', // "Is it free" - objection handling
  'analyzeData', // NEW: "How to analyze data" - tutorial
  'shareDataSafely', // NEW: "Is it safe to upload" - trust
  'withoutPassword', // "How does it work without my password" - AI/LLM query target
  'betterThanPaid', // "Is SafeUnfollow better than paid apps" - comparison query target
  'mobileUse', // "Can I use this on iPhone/Android" - mobile query target
] as const;

export function FAQSection() {
  const { t, i18n } = useTranslation('faq');
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const langPrefix = useLanguagePrefix();

  // Build FAQ items from translations
  const faqItems: FAQItem[] = FAQ_KEYS.map(key => {
    const relatedLinkText = t(`items.${key}.relatedLink.text`, { defaultValue: '' });
    const relatedLinkHref = t(`items.${key}.relatedLink.href`, { defaultValue: '' });

    return {
      key,
      question: t(`items.${key}.question`),
      answer: t(`items.${key}.answer`),
      relatedLink:
        relatedLinkText && relatedLinkHref
          ? { text: relatedLinkText, href: relatedLinkHref }
          : undefined,
    };
  });

  // Generate Schema.org FAQ structured data with inLanguage
  // Safe: uses our own translation strings from i18n files, not user input
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    inLanguage: i18n.language,
    mainEntity: faqItems.map(item => ({
      '@type': 'Question',
      name: item.question,
      answerCount: 1,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
        url: `https://safeunfollow.app${langPrefix}#faq-${item.key}`,
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          // Safe: JSON.stringify escapes special characters, data comes from i18n not user input
          __html: JSON.stringify(faqSchema),
        }}
      />
      <section
        id="faq"
        className="py-24 md:py-40 border-t border-border"
        aria-labelledby="faq-heading"
      >
        <div className="max-w-3xl mx-auto px-4">
          <h2
            id="faq-heading"
            className="text-3xl md:text-5xl font-display font-extrabold mb-12 md:mb-24 text-center tracking-tight leading-[1.15] px-4"
          >
            {t('title')}
          </h2>
          <div className="space-y-6">
            {faqItems.map((item, index) => (
              <article
                key={item.key}
                id={`faq-${item.key}`}
                className="rounded-3xl md:rounded-4xl border border-border bg-card overflow-hidden transition-all duration-200 shadow-sm"
              >
                {/* Semantic: h3 wraps button for proper hierarchy */}
                <h3 className="text-lg md:text-2xl font-bold">
                  <button
                    id={`faq-trigger-${item.key}`}
                    onClick={() => {
                      const isOpening = openIndex !== index;
                      if (isOpening) {
                        analytics.faqExpand(index, item.question);
                      }
                      setOpenIndex(openIndex === index ? null : index);
                    }}
                    className="cursor-pointer w-full px-6 py-6 md:px-10 md:py-10 flex items-center justify-between text-start hover:bg-[oklch(0.5_0_0_/_0.02)] transition-colors group"
                    aria-expanded={openIndex === index}
                    aria-controls={`faq-answer-${item.key}`}
                  >
                    <span className="pe-8 group-hover:text-primary transition-colors leading-tight">
                      {item.question}
                    </span>
                    <div
                      className={`shrink-0 w-11 h-11 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-all ${
                        openIndex === index
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-[oklch(0.5_0_0_/_0.05)] text-zinc-400'
                      }`}
                    >
                      {openIndex === index ? <ChevronUp size={22} /> : <ChevronDown size={22} />}
                    </div>
                  </button>
                </h3>
                <div
                  id={`faq-answer-${item.key}`}
                  role="region"
                  aria-labelledby={`faq-trigger-${item.key}`}
                  hidden={openIndex !== index}
                  className={`transition-all duration-500 ease-in-out ${
                    openIndex === index ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="px-6 md:px-10 pb-8 md:pb-12 text-zinc-600 dark:text-zinc-400 leading-[1.625] font-medium text-base md:text-xl">
                    <p>{item.answer}</p>
                    {item.relatedLink && (
                      <p className="mt-4 text-sm">
                        <Link
                          to={`${langPrefix}${item.relatedLink.href}`}
                          className="text-primary hover:underline"
                        >
                          {item.relatedLink.text} →
                        </Link>
                      </p>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
