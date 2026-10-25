import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import resultsEN from '@/locales/en/results.json';
import { createI18nMock } from '@/__tests__/utils/mockI18n';

vi.mock('react-i18next', () => createI18nMock(resultsEN));

import { StaleDatesHint } from '@/components/StaleDatesHint';

describe('StaleDatesHint', () => {
  it('says the ruled sentence when stale', () => {
    render(<StaleDatesHint stale isSample={false} />);
    expect(
      screen.getByText(/Upload your Instagram ZIP again to see follow dates/)
    ).toBeInTheDocument();
  });

  it('renders nothing on /sample, and nothing when not stale', () => {
    const { container: a } = render(<StaleDatesHint stale isSample />);
    const { container: b } = render(<StaleDatesHint stale={false} isSample={false} />);
    expect(a).toBeEmptyDOMElement();
    expect(b).toBeEmptyDOMElement();
  });

  it('has no control and no role alert', () => {
    render(<StaleDatesHint stale isSample={false} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
