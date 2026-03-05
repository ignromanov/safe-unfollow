import { vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithRouter } from '@/__tests__/test-utils';
import commonEN from '@/locales/en/common.json';
import { createI18nMock } from '@/__tests__/utils/mockI18n';

// Mock useLanguagePrefix
vi.mock('@/hooks/useLanguagePrefix', () => ({
  useLanguagePrefix: () => '',
}));

vi.mock('react-i18next', () => createI18nMock(commonEN));

import { Footer } from '@/components/Footer';
import * as analytics from '@/lib/analytics';

// Mock analytics module
vi.mock('@/lib/analytics', () => ({
  analytics: {
    linkClick: vi.fn(),
  },
  isTrackingOptedOut: vi.fn(() => false),
  optOutOfTracking: vi.fn(),
  optIntoTracking: vi.fn(),
}));

describe('Footer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render footer with copyright text', () => {
    renderWithRouter(<Footer />);

    expect(screen.getByText(commonEN.footer.copyright)).toBeInTheDocument();
  });

  it('should render SafeUnfollow branding', () => {
    renderWithRouter(<Footer />);

    // Use getAllByText since "SafeUnfollow" appears in multiple places
    const safeUnfollowTexts = screen.getAllByText(/SafeUnfollow/);
    expect(safeUnfollowTexts.length).toBeGreaterThan(0);
    expect(screen.getByText('.app')).toBeInTheDocument();
  });

  it('should render Privacy Policy link', () => {
    renderWithRouter(<Footer />);

    const privacyLink = screen.getByText(commonEN.footer.privacyPolicy);
    expect(privacyLink).toBeInTheDocument();
    expect(privacyLink).toHaveAttribute('href', '/privacy');
  });

  it('should render Terms of Service link', () => {
    renderWithRouter(<Footer />);

    const termsLink = screen.getByText(commonEN.footer.termsOfService);
    expect(termsLink).toBeInTheDocument();
    expect(termsLink).toHaveAttribute('href', '/terms');
  });

  it('should render Contact link', () => {
    renderWithRouter(<Footer />);

    const contactLink = screen.getByText(commonEN.footer.contact);
    expect(contactLink).toBeInTheDocument();
    expect(contactLink).toHaveAttribute('href', 'mailto:hello@safeunfollow.app');
  });

  it('should render Docs link', () => {
    renderWithRouter(<Footer />);

    const docsLink = screen.getByText(commonEN.footer.docs);
    expect(docsLink).toBeInTheDocument();
    expect(docsLink).toHaveAttribute('href', 'https://safeunfollow.app/docs');
    expect(docsLink).toHaveAttribute('target', '_blank');
    expect(docsLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('should call analytics on Docs click', () => {
    renderWithRouter(<Footer />);

    const docsLink = screen.getByText(commonEN.footer.docs);
    fireEvent.click(docsLink);

    expect(analytics.analytics.linkClick).toHaveBeenCalledWith('docs');
  });

  it('should render tracking toggle button', () => {
    renderWithRouter(<Footer />);

    const trackingButton = screen.getByText(commonEN.footer.dontTrackMe);
    expect(trackingButton).toBeInTheDocument();
  });

  it('should toggle tracking state when clicked', () => {
    renderWithRouter(<Footer />);

    const trackingButton = screen.getByText(commonEN.footer.dontTrackMe);
    fireEvent.click(trackingButton);

    expect(analytics.optOutOfTracking).toHaveBeenCalled();
  });

  it('should show opted-out state', () => {
    vi.mocked(analytics.isTrackingOptedOut).mockReturnValue(true);

    renderWithRouter(<Footer />);

    expect(screen.getByText(commonEN.footer.trackingOff)).toBeInTheDocument();
  });

  it('should render MIT License text', () => {
    renderWithRouter(<Footer />);

    expect(screen.getByText(commonEN.footer.license)).toBeInTheDocument();
  });

  it('should render buy a coffee button', () => {
    renderWithRouter(<Footer />);

    const supportButton = screen.getByText(commonEN.footer.buyACoffee);
    expect(supportButton).toBeInTheDocument();

    const link = supportButton.closest('a');
    expect(link).toHaveAttribute('href', 'https://www.buymeacoffee.com/ignromanov');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('should render description text', () => {
    renderWithRouter(<Footer />);

    expect(screen.getByText(commonEN.footer.description)).toBeInTheDocument();
  });

  it('should render "Made with" text', () => {
    renderWithRouter(<Footer />);

    // Text is split by Heart icon, so use regex to find partial matches
    expect(screen.getByText(/Made with/)).toBeInTheDocument();
    expect(screen.getByText(/for the Community/)).toBeInTheDocument();
  });

  it('should have proper footer structure', () => {
    renderWithRouter(<Footer />);

    const footer = screen.getByRole('contentinfo');
    expect(footer).toBeInTheDocument();
    expect(footer.tagName).toBe('FOOTER');
  });

  it('should call analytics on Privacy Policy click', () => {
    renderWithRouter(<Footer />);

    const privacyLink = screen.getByText('Privacy Policy');
    fireEvent.click(privacyLink);

    expect(analytics.analytics.linkClick).toHaveBeenCalledWith('privacy-policy');
  });

  it('should call analytics on Terms click', () => {
    renderWithRouter(<Footer />);

    const termsLink = screen.getByText('Terms of Service');
    fireEvent.click(termsLink);

    expect(analytics.analytics.linkClick).toHaveBeenCalledWith('terms-of-service');
  });

  it('should call analytics on support button click', () => {
    renderWithRouter(<Footer />);

    const supportButton = screen.getByText('Buy a Coffee');
    fireEvent.click(supportButton);

    expect(analytics.analytics.linkClick).toHaveBeenCalledWith('buy-me-coffee');
  });

  it('should render Logo component', () => {
    renderWithRouter(<Footer />);

    // Logo should be an SVG with role="img"
    const logo = screen.getByRole('img', { name: 'SafeUnfollow logo' });
    expect(logo).toBeInTheDocument();
  });
});
