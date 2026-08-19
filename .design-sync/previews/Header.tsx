import { Header } from 'safe-unfollow';

// Real usage from Layout.tsx: before any file is loaded, the toolbar shows
// only an "Upload File" action. AppState is a string enum at runtime — the
// package has no barrel export for it, so the raw string literal is what
// esbuild actually sees at 'HERO'.
export function Default() {
  return <Header hasData={false} activeScreen="HERO" onUpload={() => {}} onLogoClick={() => {}} />;
}

// Once a file is parsed, "Upload File" is replaced by "Results" + a
// destructive "Delete" action — the AlertDialog trigger, not the dialog
// itself (that belongs to AlertDialog's own preview).
export function WithData() {
  return (
    <Header
      hasData={true}
      activeScreen="RESULTS"
      onViewResults={() => {}}
      onClear={() => {}}
      onLogoClick={() => {}}
    />
  );
}

// The active-screen pill (bg-primary) is the only visual difference between
// "on this screen" and "one click away" — worth its own cell since it is
// easy to miss next to WithData's Results pill.
export function UploadActive() {
  return (
    <Header hasData={false} activeScreen="UPLOAD" onUpload={() => {}} onLogoClick={() => {}} />
  );
}
