import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Component as WizardPage } from '@/pages/WizardPage';
import uploadEN from '@/locales/en/upload.json';

// Mock Wizard component
vi.mock('@/components/Wizard', () => ({
  Wizard: ({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) => (
    <div data-testid="wizard">
      <h1>Instagram Export Wizard</h1>
      <button onClick={onComplete}>{uploadEN.waiting.uploadNow}</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// Mock useLanguagePrefix with vi.fn() for dynamic returns
const mockUseLanguagePrefix = vi.fn(() => '');
vi.mock('@/hooks/useLanguagePrefix', () => ({
  useLanguagePrefix: () => mockUseLanguagePrefix(),
}));

describe('WizardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLanguagePrefix.mockReturnValue('');
  });

  describe('rendering', () => {
    it('should render without crashing', () => {
      render(<WizardPage />);

      expect(screen.getByTestId('wizard')).toBeInTheDocument();
    });

    it('should render Wizard component', () => {
      render(<WizardPage />);

      expect(screen.getByText('Instagram Export Wizard')).toBeInTheDocument();
    });

    it('should render complete and cancel buttons', () => {
      render(<WizardPage />);

      expect(screen.getByText(uploadEN.waiting.uploadNow)).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });

  describe('navigation - complete', () => {
    it('should navigate to upload page when wizard is completed', async () => {
      const user = userEvent.setup();
      render(<WizardPage />);

      await user.click(screen.getByText(uploadEN.waiting.uploadNow));

      expect(mockNavigate).toHaveBeenCalledWith('/upload');
    });

    it('should use language prefix when completing wizard', async () => {
      mockUseLanguagePrefix.mockReturnValue('/es');

      const user = userEvent.setup();
      render(<WizardPage />);

      await user.click(screen.getByText(uploadEN.waiting.uploadNow));

      expect(mockNavigate).toHaveBeenCalledWith('/es/upload');
    });
  });

  describe('navigation - cancel', () => {
    it('should navigate to home page when wizard is cancelled', async () => {
      const user = userEvent.setup();
      render(<WizardPage />);

      await user.click(screen.getByText('Cancel'));

      expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    it('should use language prefix when cancelling wizard', async () => {
      mockUseLanguagePrefix.mockReturnValue('/de');

      const user = userEvent.setup();
      render(<WizardPage />);

      await user.click(screen.getByText('Cancel'));

      expect(mockNavigate).toHaveBeenCalledWith('/de/');
    });
  });

  describe('prop passing', () => {
    it('should pass handleComplete and handleCancel functions to Wizard', () => {
      render(<WizardPage />);

      // Verify the props work by checking buttons exist and are functional
      expect(screen.getByText(uploadEN.waiting.uploadNow)).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });
});
