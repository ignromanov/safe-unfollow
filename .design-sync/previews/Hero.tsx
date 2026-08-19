import { Hero } from 'safe-unfollow';

// Real landing state, before any file is loaded: primary CTA reads "Check
// Unfollowers Free" and the tertiary "I already have my ZIP file" link is
// shown (Hero.tsx hides it once hasData is true).
export function Default() {
  return (
    <Hero
      hasData={false}
      onStartGuide={() => {}}
      onLoadSample={() => {}}
      onUploadDirect={() => {}}
    />
  );
}

// Returning-user state: primary CTA swaps to "View Analysis Results" with
// onContinue, and the tertiary link disappears — the four feature cards and
// trust badges underneath are unchanged.
export function WithData() {
  return (
    <Hero
      hasData={true}
      onStartGuide={() => {}}
      onLoadSample={() => {}}
      onUploadDirect={() => {}}
      onContinue={() => {}}
    />
  );
}
