import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useLanguagePrefix } from '@/hooks/useLanguagePrefix';
import { WIZARD_STEPS } from '@/config/wizard-steps';

export function useWizardNavigation(initialStep: number = 1) {
  const location = useLocation();
  const navigate = useNavigate();
  const prefix = useLanguagePrefix();

  // Derive step from URL (single source of truth)
  const currentStep = (() => {
    const match = location.pathname.match(/\/wizard\/step\/(\d+)/);
    if (match?.[1]) {
      const step = parseInt(match[1], 10);
      if (step >= 1 && step <= WIZARD_STEPS.length) {
        return step;
      }
    }
    return initialStep;
  })();

  const goToStep = useCallback(
    (step: number) => {
      navigate(`${prefix}/wizard/step/${step}`);
    },
    [navigate, prefix]
  );

  return { currentStep, goToStep, prefix, navigate };
}
