import { vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import commonEN from '@/locales/en/common.json';
import { createI18nMock } from '@/__tests__/utils/mockI18n';

// Mock react-router-dom
const mockNavigate = vi.fn();
const mockUseLocation = vi.fn();
vi.mock('react-router-dom', () => ({
  useLocation: () => mockUseLocation(),
  useNavigate: () => mockNavigate,
}));

vi.mock('react-i18next', () => createI18nMock(commonEN));

// Mock analytics module
vi.mock('@/lib/analytics', () => ({
  analytics: {
    languageChange: vi.fn(),
  },
}));

// Mock the store
vi.mock('@/lib/store', () => ({
  useAppStore: vi.fn(),
  persistLanguageSync: vi.fn(),
}));

// Mock locales exports - must match src/config/languages.ts
vi.mock('@/locales', () => ({
  SUPPORTED_LANGUAGES: ['en', 'es', 'pt', 'hi', 'id', 'tr', 'ja', 'ru', 'de', 'ar'] as const,
  LANGUAGE_NAMES: {
    en: 'English',
    es: 'Español',
    pt: 'Português',
    hi: 'हिन्दी',
    id: 'Indonesia',
    tr: 'Türkçe',
    ja: '日本語',
    ru: 'Русский',
    de: 'Deutsch',
    ar: 'العربية',
  },
}));

import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import * as analytics from '@/lib/analytics';
import * as store from '@/lib/store';

describe('LanguageSwitcher', () => {
  const mockSetLanguage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Default location mock
    mockUseLocation.mockReturnValue({ pathname: '/' });

    vi.mocked(store.useAppStore).mockReturnValue({
      language: 'en',
      setLanguage: mockSetLanguage,
    });
  });

  // Helper to open dropdown with userEvent (required for Radix UI)
  async function openDropdown() {
    const user = userEvent.setup();
    const trigger = screen.getByRole('button');
    await user.click(trigger);
  }

  it('should render without crashing', () => {
    render(<LanguageSwitcher />);

    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('should show current language code', () => {
    render(<LanguageSwitcher />);

    expect(screen.getByText('en')).toBeInTheDocument();
  });

  it('should show different language when URL path changes', () => {
    // Mock Spanish URL path - language comes from URL, not store
    mockUseLocation.mockReturnValue({ pathname: '/es/wizard' });

    render(<LanguageSwitcher />);

    expect(screen.getByText('es')).toBeInTheDocument();
  });

  it('should have accessible label for language change', () => {
    render(<LanguageSwitcher />);

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', commonEN.language.changeLanguage);
  });

  it('should render Globe icon', () => {
    render(<LanguageSwitcher />);

    // Globe icon is rendered as SVG inside the button
    const button = screen.getByRole('button');
    const svg = button.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('should open dropdown menu on click', async () => {
    render(<LanguageSwitcher />);

    await openDropdown();

    // After clicking, dropdown should show language options
    expect(await screen.findByText('English')).toBeInTheDocument();
    expect(await screen.findByText('Español')).toBeInTheDocument();
    expect(await screen.findByText('Português')).toBeInTheDocument();
  });

  it('should show all supported languages in dropdown', async () => {
    render(<LanguageSwitcher />);

    await openDropdown();

    // Check all language names are present
    expect(await screen.findByText('English')).toBeInTheDocument();
    expect(await screen.findByText('Español')).toBeInTheDocument();
    expect(await screen.findByText('Português')).toBeInTheDocument();
    expect(await screen.findByText('हिन्दी')).toBeInTheDocument();
    expect(await screen.findByText('Indonesia')).toBeInTheDocument();
    expect(await screen.findByText('Türkçe')).toBeInTheDocument();
    expect(await screen.findByText('日本語')).toBeInTheDocument();
    expect(await screen.findByText('Русский')).toBeInTheDocument();
    expect(await screen.findByText('Deutsch')).toBeInTheDocument();
  });

  it('should trigger full page reload to new language URL when language is selected', async () => {
    const user = userEvent.setup();

    // Mock location for /wizard path
    mockUseLocation.mockReturnValue({ pathname: '/wizard' });

    // Mock window.location.href
    delete (window as any).location;
    (window as any).location = { href: '', pathname: '/wizard' };

    render(<LanguageSwitcher />);

    await openDropdown();

    const spanishOption = await screen.findByText('Español');
    await user.click(spanishOption);

    // Should persist language synchronously BEFORE redirect
    expect(store.persistLanguageSync).toHaveBeenCalledWith('es');
    // Should reload to Spanish URL
    expect(window.location.href).toBe('/es/wizard');
  });

  it('should call analytics.languageChange when language is selected', async () => {
    const user = userEvent.setup();
    render(<LanguageSwitcher />);

    await openDropdown();

    const germanOption = await screen.findByText('Deutsch');
    await user.click(germanOption);

    expect(analytics.analytics.languageChange).toHaveBeenCalledWith('de');
  });

  it('should highlight current language in dropdown', async () => {
    render(<LanguageSwitcher />);

    await openDropdown();

    // Find the menu item containing "English" (current language)
    const englishOption = await screen.findByText('English');
    const menuItem = englishOption.closest('[role="menuitem"]');

    // Current language should have special styling class
    expect(menuItem).toHaveClass('bg-primary/10');
  });

  it('should not highlight non-current languages in dropdown', async () => {
    render(<LanguageSwitcher />);

    await openDropdown();

    // Find a non-current language
    const spanishOption = await screen.findByText('Español');
    const menuItem = spanishOption.closest('[role="menuitem"]');

    // Non-current language should not have highlight class
    expect(menuItem).not.toHaveClass('bg-primary/10');
  });
});
