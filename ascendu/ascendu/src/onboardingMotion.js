// Keep navigation independent of animation timing: the latest destination wins.
export function createOnboardingNavigator({getStep, commit, animateExit}) {
  let pending = null;
  const cancel = () => {
    const previous = pending;
    pending = null;
    previous?.animation?.cancel();
  };
  const finish = request => {
    if (pending !== request) return;
    pending = null;
    request.animation?.cancel();
    commit(request.step);
  };
  return {
    navigate(step) {
      // Exit is terminal: a click on the fading screen must not reopen the flow.
      if (pending?.step === 0) return;
      if (pending?.step === step) return;
      cancel();
      if (step === getStep()) return;
      const request = {step};
      pending = request;
      request.animation = animateExit(step);
      if (!request.animation) finish(request);
      else request.animation.finished.then(() => finish(request), () => {
        if (pending === request) pending = null;
      });
    },
    cancel,
    flush() {
      if (pending) finish(pending);
    },
    get target() { return pending?.step ?? getStep(); },
  };
}
