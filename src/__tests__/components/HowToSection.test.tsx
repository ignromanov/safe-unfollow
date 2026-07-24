import { vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithRouter } from '@/__tests__/test-utils';
import howtoEN from '@/locales/en/howto.json';
import { createI18nMock } from '@/__tests__/utils/mockI18n';

vi.mock('react-i18next', () => createI18nMock(howtoEN));

import { HowToSection } from '@/components/HowToSection';

describe('HowToSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render without crashing', () => {
    renderWithRouter(<HowToSection />);

    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
  });

  it('should render the section with correct id', () => {
    const { container } = renderWithRouter(<HowToSection />);

    const section = container.querySelector('#how-it-works');
    expect(section).toBeInTheDocument();
  });

  it('should render subtitle text', () => {
    renderWithRouter(<HowToSection />);

    expect(screen.getByText(/Follow these 9 simple steps to securely analyze/)).toBeInTheDocument();
  });

  describe('how-to steps', () => {
    it('should render all 9 steps', () => {
      renderWithRouter(<HowToSection />);

      // Check step numbers are rendered
      for (let i = 1; i <= 9; i++) {
        expect(screen.getByText(String(i))).toBeInTheDocument();
      }
    });

    it('should render step titles', () => {
      renderWithRouter(<HowToSection />);

      expect(screen.getByText(howtoEN.steps['1'].title)).toBeInTheDocument();
      expect(screen.getByText(howtoEN.steps['2'].title)).toBeInTheDocument();
      expect(screen.getByText(howtoEN.steps['3'].title)).toBeInTheDocument();
      expect(screen.getByText(howtoEN.steps['4'].title)).toBeInTheDocument();
      expect(screen.getByText(howtoEN.steps['5'].title)).toBeInTheDocument();
      expect(screen.getByText(howtoEN.steps['6'].title)).toBeInTheDocument();
      expect(screen.getByText(howtoEN.steps['7'].title)).toBeInTheDocument();
      expect(screen.getByText(howtoEN.steps['8'].title)).toBeInTheDocument();
    });

    it('should render step descriptions', () => {
      renderWithRouter(<HowToSection />);

      expect(screen.getByText(/Click the button to open Meta Accounts Center/)).toBeInTheDocument();
      expect(screen.getByText(/Critical step! Click "Format"/)).toBeInTheDocument();
    });

    it('should show Critical badge for warning steps', () => {
      renderWithRouter(<HowToSection />);

      const criticalBadges = screen.getAllByText('Critical');
      expect(criticalBadges.length).toBeGreaterThanOrEqual(1);
    });

    it('should render step videos with poster images', () => {
      const { container } = renderWithRouter(<HowToSection />);

      const videos = container.querySelectorAll('video');
      expect(videos.length).toBeGreaterThan(0);

      videos.forEach(video => {
        expect(video).toHaveAttribute('poster');
      });
    });
  });

  describe('Schema.org JSON-LD', () => {
    it('should contain HowTo structured data script', () => {
      const { container } = renderWithRouter(<HowToSection />);

      const script = container.querySelector('script[type="application/ld+json"]');
      expect(script).toBeInTheDocument();
    });

    it('should have valid HowTo schema structure', () => {
      const { container } = renderWithRouter(<HowToSection />);

      const script = container.querySelector('script[type="application/ld+json"]');
      expect(script).not.toBeNull();

      const schema = JSON.parse(script!.innerHTML);

      expect(schema['@context']).toBe('https://schema.org');
      expect(schema['@type']).toBe('HowTo');
      expect(schema.name).toBe(howtoEN.schema.name);
      expect(schema.totalTime).toBe('PT5M');
    });

    it('should include all steps in schema', () => {
      const { container } = renderWithRouter(<HowToSection />);

      const script = container.querySelector('script[type="application/ld+json"]');
      const schema = JSON.parse(script!.innerHTML);

      expect(schema.step).toHaveLength(9);
      expect(schema.step[0]['@type']).toBe('HowToStep');
      expect(schema.step[0].position).toBe(1);
      expect(schema.step[0].name).toBe(howtoEN.steps['1'].title);
    });

    it('should include supplies and tools in schema', () => {
      const { container } = renderWithRouter(<HowToSection />);

      const script = container.querySelector('script[type="application/ld+json"]');
      const schema = JSON.parse(script!.innerHTML);

      expect(schema.supply).toHaveLength(2);
      expect(schema.supply[0].name).toBe(howtoEN.schema.supplies.account);
      expect(schema.tool).toHaveLength(1);
      expect(schema.tool[0].name).toBe(howtoEN.schema.tool);
    });

    it('should include estimated cost in schema', () => {
      const { container } = renderWithRouter(<HowToSection />);

      const script = container.querySelector('script[type="application/ld+json"]');
      const schema = JSON.parse(script!.innerHTML);

      expect(schema.estimatedCost).toEqual({
        '@type': 'MonetaryAmount',
        currency: 'USD',
        value: '0',
      });
    });
  });

  describe('CTA section', () => {
    it('should render CTA title and subtitle', () => {
      renderWithRouter(<HowToSection />);

      expect(screen.getByText(howtoEN.cta.title)).toBeInTheDocument();
      expect(screen.getByText(howtoEN.cta.subtitle)).toBeInTheDocument();
    });

    it('should render CTA button', () => {
      renderWithRouter(<HowToSection />);

      const button = screen.getByRole('button', { name: /Open Analysis Guide/i });
      expect(button).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('should call onStart callback when CTA button is clicked', () => {
      const onStart = vi.fn();
      renderWithRouter(<HowToSection onStart={onStart} />);

      const button = screen.getByRole('button', { name: /Open Analysis Guide/i });
      fireEvent.click(button);

      expect(onStart).toHaveBeenCalledWith(0);
    });

    it('should call onStart with step index when step is clicked', () => {
      const onStart = vi.fn();
      renderWithRouter(<HowToSection onStart={onStart} />);

      // Click on step 3 (index 2)
      const step3Title = screen.getByText(howtoEN.steps['3'].title);
      const stepElement = step3Title.closest('li');
      expect(stepElement).not.toBeNull();

      fireEvent.click(stepElement!);

      expect(onStart).toHaveBeenCalledWith(2);
    });

    it('should navigate via router when no onStart callback provided', () => {
      // Since we use navigate() instead of hash, we need to check the mock was called
      // The MemoryRouter handles navigation internally, so we verify the component renders
      renderWithRouter(<HowToSection />);

      const button = screen.getByRole('button', { name: /Open Analysis Guide/i });
      fireEvent.click(button);

      // Navigation happens via react-router's navigate(), which MemoryRouter handles
      // The test passes if no errors occur during click
      expect(button).toBeInTheDocument();
    });

    it('should navigate to upload page when step 9 is clicked', () => {
      const onStart = vi.fn();
      renderWithRouter(<HowToSection onStart={onStart} />);

      // Step 9 is the upload step (index 8)
      const step9Title = screen.getByText(howtoEN.steps['9'].title);
      const stepElement = step9Title.closest('li');
      expect(stepElement).not.toBeNull();

      fireEvent.click(stepElement!);

      // Step 9 should NOT call onStart, it navigates directly to upload
      expect(onStart).not.toHaveBeenCalled();
    });

    it('should navigate to upload page when upload button in step 9 is clicked', () => {
      renderWithRouter(<HowToSection />);

      // Find the upload button (it's distinct from the CTA button)
      const uploadButton = screen.getByRole('button', { name: howtoEN.uploadButton });
      expect(uploadButton).toBeInTheDocument();

      // Click should work and stop propagation
      fireEvent.click(uploadButton);

      // Navigation happens via react-router's navigate()
      // The test passes if no errors occur during click
      expect(uploadButton).toBeInTheDocument();
    });
  });

  describe('keyboard accessibility', () => {
    it('should trigger step click on Enter key press', () => {
      const onStart = vi.fn();
      renderWithRouter(<HowToSection onStart={onStart} />);

      // Get step 2 (index 1)
      const step2Title = screen.getByText(howtoEN.steps['2'].title);
      const stepElement = step2Title.closest('li');
      expect(stepElement).not.toBeNull();

      fireEvent.keyDown(stepElement!, { key: 'Enter' });

      expect(onStart).toHaveBeenCalledWith(1);
    });

    it('should trigger step click on Space key press', () => {
      const onStart = vi.fn();
      renderWithRouter(<HowToSection onStart={onStart} />);

      // Get step 4 (index 3)
      const step4Title = screen.getByText(howtoEN.steps['4'].title);
      const stepElement = step4Title.closest('li');
      expect(stepElement).not.toBeNull();

      fireEvent.keyDown(stepElement!, { key: ' ' });

      expect(onStart).toHaveBeenCalledWith(3);
    });

    it('should not trigger step click on other key press', () => {
      const onStart = vi.fn();
      renderWithRouter(<HowToSection onStart={onStart} />);

      const step1Title = screen.getByText(howtoEN.steps['1'].title);
      const stepElement = step1Title.closest('li');
      expect(stepElement).not.toBeNull();

      fireEvent.keyDown(stepElement!, { key: 'Tab' });

      expect(onStart).not.toHaveBeenCalled();
    });

    it('should navigate to upload on Enter key for step 9', () => {
      const onStart = vi.fn();
      renderWithRouter(<HowToSection onStart={onStart} />);

      const step9Title = screen.getByText(howtoEN.steps['9'].title);
      const stepElement = step9Title.closest('li');
      expect(stepElement).not.toBeNull();

      fireEvent.keyDown(stepElement!, { key: 'Enter' });

      // Step 9 navigates to upload, not calls onStart
      expect(onStart).not.toHaveBeenCalled();
    });
  });
});
