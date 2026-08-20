import { Logo } from 'safe-unfollow';

// Logo is a small brand mark (ShieldCheck on a gradient rounded square) meant
// to sit inline next to a wordmark in Header/Footer/FooterCTA — at its real
// usage size (~32-40px) it is genuinely tiny. Sized up here so the gradient
// and icon detail are legible in a review cell.
export function Sizes() {
  return (
    <div className="flex items-end gap-6 p-4">
      <Logo size={24} />
      <Logo size={40} />
      <Logo size={64} />
      <Logo size={96} />
    </div>
  );
}

// Real context: Header/Footer render it on the app background, at ~40px,
// next to the "SafeUnfollow" wordmark it does not itself include.
export function InHeaderContext() {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-4">
      <Logo size={32} />
      <span className="text-lg font-bold text-foreground">SafeUnfollow</span>
    </div>
  );
}
