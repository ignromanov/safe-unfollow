import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { SAME_PATH_PUSH } from '@/hooks/useGuideDialog';

/**
 * Every link of the `source` chain was tested with the next one mocked:
 * `useGuideDialog.test.tsx` derives the source and never renders the dialog,
 * `GuideDialog.test.tsx` takes it as a literal prop, and `UploadPage.test.tsx`
 * mocks the dialog module to *throw* — deliberately, since it tests the
 * ErrorBoundary path, but the consequence is that no test anywhere observes
 * the one line that joins the two halves.
 *
 * A later edit that hardcoded `source="url"` on that line would pass tsc
 * ('url' is a valid GuideSource), pass lint, and pass every other test in the
 * suite — while pinning every row of the `source` breakdown to one
 * plausible-looking value. Failing to a plausible value rather than a broken
 * one is what kept this branch's first two defects invisible.
 *
 * So this file renders the real page, the real hook and a real router, and
 * mocks the dialog only to record what it is handed. Its own file rather than
 * a case inside `UploadPage.test.tsx`, because that file's throwing module
 * mock is module-scoped and the two cannot coexist.
 */
const rendered = vi.hoisted(() => ({ props: [] as Array<Record<string, unknown>> }));

vi.mock('@/components/guide/GuideDialog', () => ({
  GuideDialog: (props: Record<string, unknown>) => {
    rendered.props.push(props);
    return (
      <div data-testid="guide-dialog" data-source={String(props.source)}>
        {String(props.step)}
      </div>
    );
  },
}));

vi.mock('@/components/UploadZone', () => ({
  UploadZone: ({
    onOpenWizard,
    onOpenGuide,
  }: {
    onOpenWizard: () => void;
    onOpenGuide: (step: number) => void;
  }) => (
    <div>
      <button onClick={onOpenWizard}>zone</button>
      <button onClick={() => onOpenGuide(3)}>accordion</button>
    </div>
  ),
}));

vi.mock('@/hooks/useInstagramData', () => ({
  useInstagramData: () => ({
    uploadState: { status: 'idle', error: null, fileName: null },
    handleZipUpload: vi.fn(() => Promise.resolve()),
    handleClearData: vi.fn(),
    parseWarnings: [],
  }),
}));

import { Component as UploadPage } from '@/pages/UploadPage';

type Entry = { pathname: string; search: string; state?: unknown };

function at(entry: string | Entry) {
  render(
    <MemoryRouter
      initialEntries={[entry]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <UploadPage />
    </MemoryRouter>
  );
}

/** What the dialog was actually handed, once the lazy chunk has resolved. */
async function dialogSource() {
  const dialog = await screen.findByTestId('guide-dialog');
  return dialog.getAttribute('data-source');
}

describe('UploadPage hands the guide dialog the source the hook derived', () => {
  it('reports the accordion, and the section it named', async () => {
    at('/upload');

    await userEvent.click(screen.getByRole('button', { name: 'accordion' }));

    expect(await dialogSource()).toBe('accordion');
    expect(screen.getByTestId('guide-dialog')).toHaveTextContent('3');
  });

  it('reports the zone', async () => {
    at('/upload');

    await userEvent.click(screen.getByRole('button', { name: 'zone' }));

    expect(await dialogSource()).toBe('zone');
  });

  it('reports a plain deep link as url', async () => {
    at({ pathname: '/upload', search: '?step=6' });

    expect(await dialogSource()).toBe('url');
  });

  it('reports the error screen whichever lands first, the dialog or the consume', async () => {
    // The one sequence the hook's own tests cannot state. The dialog is
    // `lazy()`, so its mount and the effect that takes the gesture off the
    // history entry are two independently scheduled pieces of work — under
    // `v7_startTransition` React guarantees no order between them, and on a
    // cold chunk fetch the consume lands first by a wide margin.
    //
    // The assertion holds under either ordering, and that is the point: the
    // gesture is kept in ephemeral memory rather than read back off the entry,
    // so the dialog does not depend on arriving before the consume. Reading
    // the entry alone, a dialog that mounted second would find nothing there
    // and report 'url' for the very click the channel exists to name — which
    // is what the second red-first perturbation in the report demonstrates.
    at({ pathname: '/upload', search: '?step=6', state: { ...SAME_PATH_PUSH, source: 'error' } });

    expect(await dialogSource()).toBe('error');
    await waitFor(() => expect(rendered.props.length).toBeGreaterThan(0));
    expect(rendered.props.at(-1)).toMatchObject({ source: 'error', open: true, step: 6 });
  });

  it('never hands the dialog a source the hook does not declare', async () => {
    // `location.state` is same-origin writable and outlives the page life that
    // wrote it, and `source` is a categorical column — an unlisted string
    // would not fail, it would reach the database as a fifth arm of a four-arm
    // breakdown.
    //
    // Stated at the prop boundary, which is the last place before the emitter:
    // `analytics.guideOpen(source, …)` is the only thing GuideDialog does with
    // this prop, so a value that cannot arrive here cannot reach the event.
    // What this does NOT isolate is the emitter itself — that is
    // GuideDialog.test.tsx's, and asserting `guideOpen` not-called in this
    // file would pass vacuously, since the dialog is mocked out of it.
    at({ pathname: '/upload', search: '?step=6', state: { source: 'wizard' } });

    expect(await dialogSource()).toBe('url');
  });
});
