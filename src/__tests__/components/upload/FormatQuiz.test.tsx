import { vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import uploadEN from '@/locales/en/upload.json';
import { createI18nMock } from '@/__tests__/utils/mockI18n';

vi.mock('react-i18next', () => createI18nMock(uploadEN));

vi.mock('@/lib/analytics/core', () => ({
  trackEvent: vi.fn(),
}));

import { FormatQuiz } from '@/components/upload/FormatQuiz';

const STORAGE_KEY = 'format-quiz-answer';

describe('FormatQuiz', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.removeItem(STORAGE_KEY);
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
      localStorage.setItem(STORAGE_KEY, 'json');
      const { container } = render(<FormatQuiz />);
      expect(container.firstChild).toBeNull();
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

      expect(localStorage.getItem(STORAGE_KEY)).toBe('json');
    });

    it('should track analytics event', async () => {
      const { trackEvent } = await import('@/lib/analytics/core');
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
  });
});
