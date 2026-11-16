import test from 'node:test';
import assert from 'node:assert/strict';
import {createOnboardingNavigator} from './onboardingMotion.js';

function setup({animated = true} = {}) {
  let step = 2;
  const commits = [], animations = [];
  const navigator = createOnboardingNavigator({
    getStep: () => step,
    commit: next => { commits.push(next); step = next; },
    animateExit: () => {
      if (!animated) return null;
      let resolve, reject;
      const animation = {
        finished: new Promise((yes, no) => { resolve = yes; reject = no; }),
        cancel() { reject(new Error('cancelled')); },
        complete() { resolve(); },
      };
      animations.push(animation);
      return animation;
    },
  });
  return {navigator, commits, animations};
}

test('forward and back commit once after the outgoing screen finishes', async () => {
  const {navigator, commits, animations} = setup();
  navigator.navigate(3);
  assert.deepEqual(commits, []);
  animations[0].complete();
  await Promise.resolve();
  navigator.navigate(2);
  animations[1].complete();
  await Promise.resolve();
  assert.deepEqual(commits, [3, 2]);
});

test('repeated Next clicks do not restart or skip the transition', async () => {
  const {navigator, commits, animations} = setup();
  navigator.navigate(3);
  navigator.navigate(3);
  assert.equal(animations.length, 1);
  animations[0].complete();
  await Promise.resolve();
  assert.deepEqual(commits, [3]);
});

test('Back interrupts Next and only the latest destination commits', async () => {
  const {navigator, commits, animations} = setup();
  navigator.navigate(3);
  animations[0].complete();
  navigator.navigate(1);
  await Promise.resolve();
  assert.deepEqual(commits, []);
  animations[1].complete();
  await Promise.resolve();
  assert.deepEqual(commits, [1]);
});

test('Exit supersedes pending navigation, including an async-save destination', async () => {
  const {navigator, commits, animations} = setup();
  navigator.navigate(3);
  navigator.navigate(0);
  navigator.navigate(3); // A late click on the outgoing screen cannot undo Exit.
  assert.equal(navigator.target, 0);
  animations.forEach(animation => animation.complete());
  await Promise.resolve();
  assert.deepEqual(commits, [0]);
});

test('account changes and unmount cancel stale destinations', async () => {
  const {navigator, commits, animations} = setup();
  navigator.navigate(3);
  animations[0].complete();
  navigator.cancel();
  await Promise.resolve();
  assert.deepEqual(commits, []);
  assert.equal(navigator.target, 2);
});

test('disabled motion or an unavailable animation API changes screens immediately', () => {
  const {navigator, commits} = setup({animated: false});
  navigator.navigate(3);
  navigator.navigate(0);
  assert.deepEqual(commits, [3, 0]);
});

test('enabling reduced motion during an exit flushes its destination once', async () => {
  const {navigator, commits, animations} = setup();
  navigator.navigate(3);
  navigator.flush();
  animations[0].complete();
  await Promise.resolve();
  assert.deepEqual(commits, [3]);
});
