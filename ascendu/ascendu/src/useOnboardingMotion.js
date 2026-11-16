import {useLayoutEffect, useRef} from 'react';
import {createOnboardingNavigator} from './onboardingMotion.js';

export function useOnboardingMotion({step, setStep, disabled, identity, ready}) {
  const ref = useRef(null);
  const environment = useRef(null);
  const entrance = useRef(null);
  const direction = useRef(1);
  const previous = useRef({step: 0, identity});
  const navigator = useRef(null);
  const revision = useRef(0);
  if (environment.current && (environment.current.step !== step || environment.current.identity !== identity)) revision.current++;
  const renderRevision = revision.current;
  environment.current = {step, setStep, disabled, identity};

  if (!navigator.current) navigator.current = createOnboardingNavigator({
    getStep: () => environment.current.step,
    commit: next => environment.current.setStep(next),
    animateExit: next => {
      entrance.current?.cancel();
      const current = environment.current;
      direction.current = next < current.step ? -1 : 1;
      if (current.disabled || !current.step || !ref.current?.animate) return null;
      return ref.current.animate([
        {opacity: 1, transform: 'translateX(0)'},
        {opacity: 0, transform: next ? `translateX(${-16 * direction.current}px)` : 'translateX(0)'},
      ], {duration: 80, easing: 'ease-in', fill: 'forwards'});
    },
  });

  useLayoutEffect(() => {
    if (!ready) return;
    const changed = previous.current.step !== step || previous.current.identity !== identity;
    const leaving = previous.current.step > 0 && step === 0 && previous.current.identity === identity;
    if (changed) navigator.current.cancel();
    else if (disabled) navigator.current.flush();
    previous.current = {step, identity};
    entrance.current?.cancel();
    const node = ref.current;
    if (!node) return;
    if (step && changed) {
      window.scrollTo(0, 0);
      const heading = node.querySelector('h1, h2, h3');
      if (heading) {
        heading.setAttribute('tabindex', '-1');
        heading.focus({preventScroll: true});
      }
    }
    if (!disabled && (step || leaving) && node.animate) {
      entrance.current = node.animate([
        {opacity: 0, transform: step ? `translateX(${16 * direction.current}px)` : 'translateX(0)'},
        {opacity: 1, transform: 'translateX(0)'},
      ], {duration: 200, easing: 'cubic-bezier(.2,.75,.25,1)'});
    }
    return () => entrance.current?.cancel();
  }, [step, identity, disabled, ready]);

  useLayoutEffect(() => () => navigator.current.cancel(), []);

  return {
    ref,
    navigate: next => navigator.current.navigate(next),
    // A completed async save must not reopen onboarding after Exit or an account change.
    isCurrentStep: (expected, owner) => revision.current === renderRevision && environment.current.identity === owner && navigator.current.target === expected,
  };
}
