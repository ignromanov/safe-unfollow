import { useState } from 'react';
import { FormatQuiz } from 'safe-unfollow';

// FormatQuiz has no prop for its initial answer — it reads localStorage
// ('format-quiz-answer' / 'format-quiz-dismissed', mirrored here since
// neither key is exported) in a useEffect on mount. Each story seeds those
// keys via a `useState(() => …)` lazy initializer, which runs synchronously
// during the render phase — strictly before FormatQuiz's own mount effect —
// so it deterministically overwrites whatever a previous story in the same
// browser page/origin left behind, regardless of capture order. Without
// this, every story would show whatever localStorage happened to hold.

function useSeedQuizStorage(answer: 'json' | 'html' | 'not-sure' | null) {
  useState(() => {
    try {
      if (answer) localStorage.setItem('format-quiz-answer', answer);
      else localStorage.removeItem('format-quiz-answer');
      localStorage.removeItem('format-quiz-dismissed');
    } catch {
      // localStorage unavailable
    }
    return null;
  });
}

export function Unanswered() {
  useSeedQuizStorage(null);
  return (
    <div className="max-w-lg">
      <FormatQuiz onOpenWizard={() => {}} />
    </div>
  );
}

export function JsonAnswered() {
  useSeedQuizStorage('json');
  return (
    <div className="max-w-lg">
      <FormatQuiz onOpenWizard={() => {}} />
    </div>
  );
}

export function HtmlAnswered() {
  useSeedQuizStorage('html');
  return (
    <div className="max-w-lg">
      <FormatQuiz onOpenWizard={() => {}} />
    </div>
  );
}

export function NotSureAnswered() {
  useSeedQuizStorage('not-sure');
  return (
    <div className="max-w-lg">
      <FormatQuiz onOpenWizard={() => {}} />
    </div>
  );
}
