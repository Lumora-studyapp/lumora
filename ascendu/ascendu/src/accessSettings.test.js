import test from "node:test";
import assert from "node:assert/strict";
import {
  isAdminConsoleUsername,
  normalizeAnimationMode,
  shouldDisableAnimations,
} from "./accessSettings.js";

test("admin console allowlist canonicalizes the two named admins", () => {
  assert.equal(isAdminConsoleUsername(" Phamalam "), true);
  assert.equal(isAdminConsoleUsername("V2TRAPPY"), true);
  assert.equal(isAdminConsoleUsername("learner"), false);
});

test("configured admin usernames can supplement the built-in console admins", () => {
  assert.equal(isAdminConsoleUsername("teacher_one", ["Teacher_One"]), true);
});

test("animation mode falls back safely and respects explicit choices", () => {
  assert.equal(normalizeAnimationMode("unknown"), "device");
  assert.equal(shouldDisableAnimations("device", true), true);
  assert.equal(shouldDisableAnimations("device", false), false);
  assert.equal(shouldDisableAnimations("full", true), false);
  assert.equal(shouldDisableAnimations("off", false), true);
});
