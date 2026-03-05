import { vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import uploadEN from '@/locales/en/upload.json';
import { createI18nMock } from '@/__tests__/utils/mockI18n';

vi.mock('react-i18next', () => createI18nMock(uploadEN));

vi.mock('@/lib/stats/core', () => ({
  trackEvent: vi.fn(),
}));

import { FormatQuiz } from '@/components/upload/FormatQuiz';

const ANSWER_KEY = 'format-quiz-answer';
const DISMISS_KEY = 'format-quiz-dismissed';

describe('FormatQuiz', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.removeItem(ANSWER_KEY);
    localStorage.removeItem(DISMISS_KEY);
  });

  describe('rendering', () => {
    it('should render quiz title when no stored answer', () => {
      render(<FormatQuiz />);
      expect(screen.getByText(uploadEN.quiz.title)).toBeInTheDocument();
    });

    it('should render three option buttons', () => {
      render(<FormatQuiz />);
      expect(screen.getByText(uploadEN.quiz.json)).toBeInTheDocument();
      expect(screen.getByText(uploadEN.quiz.html)).toBeInTheDocument();
      expect(screen.getByText(uploadEN.quiz.notSure)).toBeInTheDocument();
    });

    it('should not render when stored answer is json', () => {
      localStorage.setItem(ANSWER_KEY, 'json');
      const { container } = render(<FormatQuiz />);
      expect(container.firstChild).toBeNull();
    });

    it('should not render when isProcessing is true', () => {
      const { container } = render(<FormatQuiz isProcessing />);
      expect(container.firstChild).toBeNull();
    });

    it('should have radiogroup role with aria-labelledby', () => {
      render(<FormatQuiz />);
      const radiogroup = screen.getByRole('radiogroup');
      expect(radiogroup).toHaveAttribute('aria-labelledby', 'format-quiz-title');
    });

    it('should render buttons with min touch target height', () => {
      render(<FormatQuiz />);
      const radios = screen.getAllByRole('radio');
      for (const radio of radios) {
        expect(radio.className).toContain('min-h-[44px]');
      }
    });
  });

  describe('JSON answer', () => {
    it('should show success message when JSON is selected', async () => {
      const user = userEvent.setup();
      render(<FormatQuiz />);

      await user.click(screen.getByText(uploadEN.quiz.json));

      expect(screen.getByText(uploadEN.quiz.successMessage)).toBeInTheDocument();
    });

    it('should persist json answer to localStorage', async () => {
      const user = userEvent.setup();
      render(<FormatQuiz />);

      await user.click(screen.getByText(uploadEN.quiz.json));

      expect(localStorage.getItem(ANSWER_KEY)).toBe('json');
    });

    it('should track analytics event', async () => {
      const { trackEvent } = await import('@/lib/stats/core');
      const user = userEvent.setup();
      render(<FormatQuiz />);

      await user.click(screen.getByText(uploadEN.quiz.json));

      expect(trackEvent).toHaveBeenCalledWith('format_quiz_answer', { answer: 'json' });
    });
  });

  describe('HTML answer', () => {
    it('should show HTML warning when HTML is selected', async () => {
      const user = userEvent.setup();
      render(<FormatQuiz />);

      await user.click(screen.getByText(uploadEN.quiz.html));

      expect(screen.getByText(uploadEN.quiz.htmlMessage)).toBeInTheDocument();
    });

    it('should show wizard CTA when onOpenWizard is provided', async () => {
      const user = userEvent.setup();
      const onOpenWizard = vi.fn();
      render(<FormatQuiz onOpenWizard={onOpenWizard} />);

      await user.click(screen.getByText(uploadEN.quiz.html));

      const cta = screen.getByText(uploadEN.quiz.htmlCta);
      expect(cta).toBeInTheDocument();

      await user.click(cta);
      expect(onOpenWizard).toHaveBeenCalledTimes(1);
    });

    it('should show "I\'ve fixed it" button', async () => {
      const user = userEvent.setup();
      render(<FormatQuiz />);

      await user.click(screen.getByText(uploadEN.quiz.html));

      expect(screen.getByText(uploadEN.quiz.fixedIt)).toBeInTheDocument();
    });

    it('should reset quiz when "I\'ve fixed it" is clicked', async () => {
      const user = userEvent.setup();
      render(<FormatQuiz />);

      await user.click(screen.getByText(uploadEN.quiz.html));
      expect(screen.getByText(uploadEN.quiz.htmlMessage)).toBeInTheDocument();

      await user.click(screen.getByText(uploadEN.quiz.fixedIt));

      // Should show quiz options again
      expect(screen.getByText(uploadEN.quiz.title)).toBeInTheDocument();
      expect(screen.getByText(uploadEN.quiz.json)).toBeInTheDocument();
    });

    it('should clear localStorage when "I\'ve fixed it" is clicked', async () => {
      const user = userEvent.setup();
      render(<FormatQuiz />);

      await user.click(screen.getByText(uploadEN.quiz.html));
      expect(localStorage.getItem(ANSWER_KEY)).toBe('html');

      await user.click(screen.getByText(uploadEN.quiz.fixedIt));

      expect(localStorage.getItem(ANSWER_KEY)).toBeNull();
      expect(localStorage.getItem(DISMISS_KEY)).toBeNull();
    });

    it('should track analytics event for fixedIt', async () => {
      const { trackEvent } = await import('@/lib/stats/core');
      const user = userEvent.setup();
      render(<FormatQuiz />);

      await user.click(screen.getByText(uploadEN.quiz.html));
      await user.click(screen.getByText(uploadEN.quiz.fixedIt));

      expect(trackEvent).toHaveBeenCalledWith('format_quiz_fixed_it');
    });
  });

  describe('Not sure answer', () => {
    it('should show comparison when Not sure is selected', async () => {
      const user = userEvent.setup();
      render(<FormatQuiz />);

      await user.click(screen.getByText(uploadEN.quiz.notSure));

      expect(screen.getByText(uploadEN.quiz.comparisonTitle)).toBeInTheDocument();
      expect(screen.getByText(uploadEN.quiz.comparisonJson)).toBeInTheDocument();
      expect(screen.getByText(uploadEN.quiz.comparisonHtml)).toBeInTheDocument();
    });

    it('should show "I\'ve fixed it" button in comparison view', async () => {
      const user = userEvent.setup();
      render(<FormatQuiz />);

      await user.click(screen.getByText(uploadEN.quiz.notSure));

      expect(screen.getByText(uploadEN.quiz.fixedIt)).toBeInTheDocument();
    });

    it('should reset quiz when "I\'ve fixed it" is clicked from comparison', async () => {
      const user = userEvent.setup();
      render(<FormatQuiz />);

      await user.click(screen.getByText(uploadEN.quiz.notSure));
      await user.click(screen.getByText(uploadEN.quiz.fixedIt));

      expect(screen.getByText(uploadEN.quiz.title)).toBeInTheDocument();
    });
  });

  describe('dismiss', () => {
    it('should hide when dismiss button is clicked on success state', async () => {
      const user = userEvent.setup();
      render(<FormatQuiz />);

      await user.click(screen.getByText(uploadEN.quiz.json));
      expect(screen.getByText(uploadEN.quiz.successMessage)).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: uploadEN.quiz.dismiss }));
      expect(screen.queryByText(uploadEN.quiz.successMessage)).not.toBeInTheDocument();
    });

    it('should hide when dismiss button is clicked on HTML state', async () => {
      const user = userEvent.setup();
      render(<FormatQuiz />);

      await user.click(screen.getByText(uploadEN.quiz.html));
      expect(screen.getByText(uploadEN.quiz.htmlMessage)).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: uploadEN.quiz.dismiss }));
      expect(screen.queryByText(uploadEN.quiz.htmlMessage)).not.toBeInTheDocument();
    });

    it('should persist dismiss to localStorage', async () => {
      const user = userEvent.setup();
      render(<FormatQuiz />);

      await user.click(screen.getByText(uploadEN.quiz.json));
      await user.click(screen.getByRole('button', { name: uploadEN.quiz.dismiss }));

      expect(localStorage.getItem(DISMISS_KEY)).toBe('1');
    });

    it('should not render when dismiss was persisted', () => {
      localStorage.setItem(DISMISS_KEY, '1');
      localStorage.setItem(ANSWER_KEY, 'html');
      const { container } = render(<FormatQuiz />);
      expect(container.firstChild).toBeNull();
    });
  });
});
