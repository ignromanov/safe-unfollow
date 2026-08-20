import { LoadingTips } from 'safe-unfollow';

// Reveals its two privacy tips on 800/1100ms timers while isProcessing=true.
// Reads useTranslation('upload') for title/description with no fallback
// strings — see learnings if this renders raw i18n keys instead of copy.
export function WhileProcessing() {
  return (
    <div className="max-w-sm">
      <LoadingTips isProcessing={true} />
    </div>
  );
}
