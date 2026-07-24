import { vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import wizardEN from '@/locales/en/wizard.json';
import { createI18nMock } from '@/__tests__/utils/mockI18n';

// Mock react-router-dom with pathname tracking
let mockPathname = '/wizard';
const mockNavigate = vi.fn((path: string) => {
  // Update mockPathname when navigate is called
  if (typeof path === 'string') {
    mockPathname = path;
  }
});

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: mockPathname }),
  useNavigate: () => mockNavigate,
}));

// Mock useLanguagePrefix
vi.mock('@/hooks/useLanguagePrefix', () => ({
  useLanguagePrefix: () => '',
}));

vi.mock('react-i18next', () => createI18nMock(wizardEN));

import { Wizard } from '@/components/Wizard';

// Mock analytics module
vi.mock('@/lib/analytics', () => ({
  analytics: {
    wizardStepView: vi.fn(),
    wizardNextClick: vi.fn(),
    wizardBackClick: vi.fn(),
    wizardCancel: vi.fn(),
    wizardExternalLinkClick: vi.fn(),
  },
}));

describe('Wizard', () => {
  const mockOnComplete = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = '/wizard';
  });

  it('should render without crashing', () => {
    render(<Wizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    expect(screen.getByText('Step 1 of 8')).toBeInTheDocument();
  });

  it('should render step indicator with progress dots', () => {
    render(<Wizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    // Step counter text
    expect(screen.getByText('Step 1 of 8')).toBeInTheDocument();
  });

  it('should render first step title and description', () => {
    render(<Wizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    // Title appears twice (heading + button), check heading specifically
    expect(screen.getByRole('heading', { name: wizardEN.steps['1'].title })).toBeInTheDocument();
    // Use partial match for description (contains quotes that may render differently)
    expect(
      screen.getByText(/Click the button below to open Meta Accounts Center/)
    ).toBeInTheDocument();
  });

  it('should render navigation buttons', () => {
    render(<Wizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    expect(screen.getByText('Next Step')).toBeInTheDocument();
    expect(screen.getByText('buttons.cancel')).toBeInTheDocument();
  });

  it('should render external link button on step 1', () => {
    render(<Wizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    const externalLink = screen.getByRole('link', {
      name: new RegExp(wizardEN.buttons.openInstagram),
    });
    expect(externalLink).toBeInTheDocument();
    expect(externalLink).toHaveAttribute(
      'href',
      'https://accountscenter.instagram.com/info_and_permissions/dyi/?entry_point=app_settings'
    );
  });

  it('should call navigate to next step when Next is clicked', () => {
    mockPathname = '/wizard/step/1';
    render(<Wizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    fireEvent.click(screen.getByText(wizardEN.buttons.next));

    expect(mockNavigate).toHaveBeenCalledWith('/wizard/step/2');
  });

  it('should call navigate to previous step when Back is clicked', () => {
    mockPathname = '/wizard/step/2';
    render(<Wizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    expect(screen.getByText('Step 2 of 8')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Back'));

    expect(mockNavigate).toHaveBeenCalledWith('/wizard/step/1');
  });

  it('should call onCancel when close button is clicked', () => {
    render(<Wizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    // Find the close button by its aria-label from translations
    const closeButton = screen.getByRole('button', { name: wizardEN.buttons.close });
    fireEvent.click(closeButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should show warning badge on step 4', () => {
    mockPathname = '/wizard/step/4';
    render(<Wizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    expect(screen.getByText(wizardEN.format.warning)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: new RegExp('Followers and following') })
    ).toBeInTheDocument();
  });

  it('should call onComplete on last step when Done is clicked', () => {
    mockPathname = '/wizard/step/8';
    render(<Wizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    expect(screen.getByText("Done, let's go!")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Done, let's go!"));

    expect(mockOnComplete).toHaveBeenCalled();
  });

  it('should render step video with alt text as aria-label', () => {
    render(<Wizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    const video = screen.getByLabelText(wizardEN.steps['1'].alt);
    expect(video).toBeInTheDocument();
  });

  it('should navigate via goToStep when clicking Next', () => {
    mockPathname = '/wizard/step/1';
    render(<Wizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    fireEvent.click(screen.getByText('Next Step'));

    // Navigation to step 2
    expect(mockNavigate).toHaveBeenCalledWith('/wizard/step/2');
  });

  it('should render correct step based on URL pathname', () => {
    // Test step 5
    mockPathname = '/wizard/step/5';
    render(<Wizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    expect(screen.getByText('Step 5 of 8')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
  });

  it('should navigate to correct path when Next is clicked', () => {
    mockPathname = '/wizard/step/3';
    render(<Wizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    fireEvent.click(screen.getByText(wizardEN.buttons.next));

    expect(mockNavigate).toHaveBeenCalledWith('/wizard/step/4');
  });

  it('should navigate to correct path when Back is clicked', () => {
    mockPathname = '/wizard/step/5';
    render(<Wizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    fireEvent.click(screen.getByText('Back'));

    expect(mockNavigate).toHaveBeenCalledWith('/wizard/step/4');
  });

  it('should render "I already have my ZIP file" button on step 1', () => {
    mockPathname = '/wizard/step/1';
    render(<Wizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    const alreadyHaveFileButton = screen.getByRole('button', {
      name: wizardEN.buttons.alreadyHaveFile,
    });
    expect(alreadyHaveFileButton).toBeInTheDocument();
  });

  it('should navigate to /upload when "I already have my ZIP file" is clicked', () => {
    mockPathname = '/wizard/step/1';
    render(<Wizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    const alreadyHaveFileButton = screen.getByRole('button', {
      name: wizardEN.buttons.alreadyHaveFile,
    });
    fireEvent.click(alreadyHaveFileButton);

    expect(mockNavigate).toHaveBeenCalledWith('/upload');
  });

  it('should not render "I already have my ZIP file" button on other steps', () => {
    mockPathname = '/wizard/step/2';
    render(<Wizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    const alreadyHaveFileButton = screen.queryByRole('button', {
      name: wizardEN.buttons.alreadyHaveFile,
    });
    expect(alreadyHaveFileButton).not.toBeInTheDocument();
  });
});
