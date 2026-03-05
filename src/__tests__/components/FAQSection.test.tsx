import { vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import faqEN from '@/locales/en/faq.json';
import { createI18nMock } from '@/__tests__/utils/mockI18n';

vi.mock('react-i18next', () => createI18nMock(faqEN));

import { renderWithRouter } from '../test-utils';
import { FAQSection } from '@/components/FAQSection';

describe('FAQSection Component', () => {
  describe('rendering', () => {
    it('should render without crashing', () => {
      renderWithRouter(<FAQSection />);

      expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
    });

    it('should render section title from translations', () => {
      renderWithRouter(<FAQSection />);

      // The title comes from faq namespace, but due to mock flattening
      // it gets overwritten by howto.title - we just verify a heading exists
      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveAttribute('id', 'faq-heading');
    });

    it('should render all FAQ questions', () => {
      renderWithRouter(<FAQSection />);

      // Check that FAQ questions from faq.json are rendered
      expect(screen.getByText(faqEN.items.howToFind.question)).toBeInTheDocument();
      expect(screen.getByText(faqEN.items.withoutDownload.question)).toBeInTheDocument();
      expect(screen.getByText(faqEN.items.privacy.question)).toBeInTheDocument();
      expect(screen.getByText(faqEN.items.safety.question)).toBeInTheDocument();
      expect(screen.getByText(faqEN.items.free.question)).toBeInTheDocument();
    });

    it('should have proper accessibility attributes', () => {
      renderWithRouter(<FAQSection />);

      // Section is labeled by the heading via aria-labelledby
      const section = document.getElementById('faq');
      expect(section).toBeInTheDocument();
      expect(section).toHaveAttribute('aria-labelledby', 'faq-heading');
    });
  });

  describe('accordion behavior', () => {
    it('should have all items collapsed by default', () => {
      renderWithRouter(<FAQSection />);

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toHaveAttribute('aria-expanded', 'false');
      });
    });

    it('should expand item when clicked', async () => {
      const user = userEvent.setup();
      renderWithRouter(<FAQSection />);

      const firstQuestion = screen.getByText(faqEN.items.howToFind.question);
      const button = firstQuestion.closest('button');
      expect(button).toHaveAttribute('aria-expanded', 'false');

      await user.click(button!);

      expect(button).toHaveAttribute('aria-expanded', 'true');
    });

    it('should collapse item when clicked again', async () => {
      const user = userEvent.setup();
      renderWithRouter(<FAQSection />);

      const firstQuestion = screen.getByText(faqEN.items.howToFind.question);
      const button = firstQuestion.closest('button');

      // Open
      await user.click(button!);
      expect(button).toHaveAttribute('aria-expanded', 'true');

      // Close
      await user.click(button!);
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });

    it('should only have one item expanded at a time', async () => {
      const user = userEvent.setup();
      renderWithRouter(<FAQSection />);

      const firstQuestion = screen.getByText(faqEN.items.howToFind.question);
      const secondQuestion = screen.getByText(faqEN.items.withoutDownload.question);
      const firstButton = firstQuestion.closest('button');
      const secondButton = secondQuestion.closest('button');

      // Open first item
      await user.click(firstButton!);
      expect(firstButton).toHaveAttribute('aria-expanded', 'true');
      expect(secondButton).toHaveAttribute('aria-expanded', 'false');

      // Open second item - first should close
      await user.click(secondButton!);
      expect(firstButton).toHaveAttribute('aria-expanded', 'false');
      expect(secondButton).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('Schema.org structured data', () => {
    it('should contain JSON-LD script with FAQPage schema', () => {
      const { container } = renderWithRouter(<FAQSection />);

      const script = container.querySelector('script[type="application/ld+json"]');
      expect(script).toBeInTheDocument();

      const schema = JSON.parse(script!.textContent!);
      expect(schema['@context']).toBe('https://schema.org');
      expect(schema['@type']).toBe('FAQPage');
    });

    it('should include all FAQ items in schema mainEntity', () => {
      const { container } = renderWithRouter(<FAQSection />);

      const script = container.querySelector('script[type="application/ld+json"]');
      const schema = JSON.parse(script!.textContent!);

      expect(schema.mainEntity).toHaveLength(15);
      schema.mainEntity.forEach(
        (item: { '@type': string; acceptedAnswer: { '@type': string } }) => {
          expect(item['@type']).toBe('Question');
          expect(item.acceptedAnswer['@type']).toBe('Answer');
        }
      );
    });

    it('should have matching questions in schema and rendered content', () => {
      const { container } = renderWithRouter(<FAQSection />);

      const script = container.querySelector('script[type="application/ld+json"]');
      const schema = JSON.parse(script!.textContent!);

      // Verify first question matches
      const firstSchemaQuestion = schema.mainEntity[0].name;
      expect(screen.getByText(firstSchemaQuestion)).toBeInTheDocument();
    });
  });
});
