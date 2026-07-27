import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Component as HomePage } from '@/pages/HomePage';
import heroEN from '@/locales/en/hero.json';
import commonEN from '@/locales/en/common.json';

// Mock child components
vi.mock('@/components/Hero', () => ({
  Hero: ({
    onStartGuide,
    onLoadSample,
    onUploadDirect,
    hasData,
    onContinue,
  }: {
    onStartGuide: (stepIndex?: number) => void;
    onLoadSample: () => void;
    onUploadDirect: () => void;
    hasData?: boolean;
    onContinue?: () => void;
  }) => (
    <div data-testid="hero">
      <button onClick={() => onStartGuide(0)}>{heroEN.buttons.getGuide}</button>
      <button onClick={onLoadSample}>{heroEN.buttons.trySample}</button>
      <button onClick={onUploadDirect}>{heroEN.buttons.haveFile}</button>
      {hasData && onContinue && <button onClick={onContinue}>{heroEN.buttons.viewResults}</button>}
      <span data-testid="has-data">{String(hasData)}</span>
    </div>
  ),
}));

vi.mock('@/components/HowToSection', () => ({
  HowToSection: ({ onStart }: { onStart: (stepIndex?: number) => void }) => (
    <div data-testid="how-to-section">
      <button onClick={() => onStart(2)}>How To Start</button>
    </div>
  ),
}));

vi.mock('@/components/FAQSection', () => ({
  FAQSection: () => <div data-testid="faq-section">FAQ Section</div>,
}));

vi.mock('@/components/FooterCTA', () => ({
  FooterCTA: ({
    onStart,
    onSample,
  }: {
    onStart: (stepIndex?: number) => void;
    onSample: () => void;
  }) => (
    <div data-testid="footer-cta">
      <button onClick={() => onStart()}>{commonEN.cta.getStarted}</button>
      <button onClick={onSample}>{commonEN.cta.trySample}</button>
    </div>
  ),
}));

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// Mock hooks with vi.fn() for dynamic returns
const mockUseLanguagePrefix = vi.fn(() => '');
vi.mock('@/hooks/useLanguagePrefix', () => ({
  useLanguagePrefix: () => mockUseLanguagePrefix(),
}));

const mockUseInstagramData = vi.fn(() => ({
  uploadState: { status: 'idle', error: null, fileName: null },
  fileMetadata: null,
}));
vi.mock('@/hooks/useInstagramData', () => ({
  useInstagramData: () => mockUseInstagramData(),
}));

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLanguagePrefix.mockReturnValue('');
    mockUseInstagramData.mockReturnValue({
      uploadState: { status: 'idle', error: null, fileName: null },
      fileMetadata: null,
    });
  });

  describe('rendering', () => {
    it('should render without crashing', () => {
      render(<HomePage />);

      expect(screen.getByTestId('hero')).toBeInTheDocument();
    });

    it('should render all main sections', () => {
      render(<HomePage />);

      expect(screen.getByTestId('hero')).toBeInTheDocument();
      expect(screen.getByTestId('how-to-section')).toBeInTheDocument();
      expect(screen.getByTestId('faq-section')).toBeInTheDocument();
      expect(screen.getByTestId('footer-cta')).toBeInTheDocument();
    });

    it('should pass hasData as false when no upload data', () => {
      render(<HomePage />);

      expect(screen.getByTestId('has-data')).toHaveTextContent('false');
    });

    it('should pass hasData as true when upload is successful', () => {
      mockUseInstagramData.mockReturnValue({
        uploadState: { status: 'success', error: null, fileName: 'test.zip' },
        fileMetadata: { fileHash: 'abc123', accountCount: 100, name: 'test.zip' },
      });

      render(<HomePage />);

      expect(screen.getByTestId('has-data')).toHaveTextContent('true');
    });
  });

  describe('navigation - Hero handlers', () => {
    it('should navigate to wizard step 1 when Start Guide is clicked', async () => {
      const user = userEvent.setup();
      render(<HomePage />);

      await user.click(screen.getByText(heroEN.buttons.getGuide));

      expect(mockNavigate).toHaveBeenCalledWith('/wizard/step/1');
    });

    it('should navigate to sample page when Load Sample is clicked', async () => {
      const user = userEvent.setup();
      render(<HomePage />);

      await user.click(screen.getByText(heroEN.buttons.trySample));

      expect(mockNavigate).toHaveBeenCalledWith('/sample');
    });

    it('should navigate to upload page when Upload Direct is clicked', async () => {
      const user = userEvent.setup();
      render(<HomePage />);

      await user.click(screen.getByText(heroEN.buttons.haveFile));

      expect(mockNavigate).toHaveBeenCalledWith('/upload');
    });

    it('should navigate to results when Continue is clicked', async () => {
      mockUseInstagramData.mockReturnValue({
        uploadState: { status: 'success', error: null, fileName: 'test.zip' },
        fileMetadata: { fileHash: 'abc123', accountCount: 100, name: 'test.zip' },
      });

      const user = userEvent.setup();
      render(<HomePage />);

      await user.click(screen.getByText(heroEN.buttons.viewResults));

      expect(mockNavigate).toHaveBeenCalledWith('/results');
    });
  });

  describe('navigation - HowToSection handlers', () => {
    it('should navigate to wizard with step index from HowTo section', async () => {
      const user = userEvent.setup();
      render(<HomePage />);

      await user.click(screen.getByText('How To Start'));

      expect(mockNavigate).toHaveBeenCalledWith('/wizard/step/3');
    });
  });

  describe('navigation - FooterCTA handlers', () => {
    it('should navigate to wizard step 1 from FooterCTA', async () => {
      const user = userEvent.setup();
      render(<HomePage />);

      await user.click(screen.getByText(commonEN.cta.getStarted));

      expect(mockNavigate).toHaveBeenCalledWith('/wizard/step/1');
    });

    it('should navigate to sample from FooterCTA', async () => {
      const user = userEvent.setup();
      render(<HomePage />);

      await user.click(screen.getByText(commonEN.cta.trySample));

      expect(mockNavigate).toHaveBeenCalledWith('/sample');
    });
  });

  describe('language prefix support', () => {
    it('should use language prefix in navigation when set', async () => {
      mockUseLanguagePrefix.mockReturnValue('/es');

      const user = userEvent.setup();
      render(<HomePage />);

      await user.click(screen.getByText(heroEN.buttons.getGuide));

      expect(mockNavigate).toHaveBeenCalledWith('/es/wizard/step/1');
    });
  });

  describe('ad placements', () => {
    const withAdEnv = (fn: () => void) => {
      vi.stubEnv('VITE_ADSENSE_CLIENT', 'ca-pub-test');
      vi.stubEnv('VITE_ADSENSE_SLOT_HOME', '111');
      vi.stubEnv('VITE_ADSENSE_SLOT_HOME_FOOTER', '222');
      try {
        fn();
      } finally {
        vi.unstubAllEnvs();
      }
    };

    it('should render no ads when the slot env vars are unset', () => {
      const { container } = render(<HomePage />);

      expect(container.querySelectorAll('[data-ad-name]')).toHaveLength(0);
    });

    it('should place the in-content ad between HowTo and FAQ', () => {
      withAdEnv(() => {
        render(<HomePage />);

        const ad = document.querySelector('[data-ad-name="home"]') as HTMLElement;
        expect(ad).not.toBeNull();
        expect(
          screen.getByTestId('how-to-section').compareDocumentPosition(ad) &
            Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
        expect(
          screen.getByTestId('faq-section').compareDocumentPosition(ad) &
            Node.DOCUMENT_POSITION_PRECEDING
        ).toBeTruthy();
      });
    });

    it('should place the multiplex ad after the footer CTA, so the CTA is seen first', () => {
      withAdEnv(() => {
        render(<HomePage />);

        const ad = document.querySelector('[data-ad-name="home_footer"]') as HTMLElement;
        expect(ad).not.toBeNull();
        expect(
          screen.getByTestId('footer-cta').compareDocumentPosition(ad) &
            Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
      });
    });
  });

  describe('sections animation', () => {
    it('should wrap sections in animated container', () => {
      const { container } = render(<HomePage />);

      const animatedDiv = container.querySelector('.animate-in.fade-in');
      expect(animatedDiv).toBeInTheDocument();
      expect(animatedDiv).toContainElement(screen.getByTestId('how-to-section'));
      expect(animatedDiv).toContainElement(screen.getByTestId('faq-section'));
      expect(animatedDiv).toContainElement(screen.getByTestId('footer-cta'));
    });
  });
});
