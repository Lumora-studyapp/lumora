import test from "node:test";
import assert from "node:assert/strict";
import {
  GROUP_INVITE_CODE_LENGTH,
  isGroupInviteCode,
  normalizeGroupInviteCode,
} from "./groupLeaderboards.js";

test("group invite codes normalize to the trusted eight-character alphabet", () => {
  assert.equal(normalizeGroupInviteCode(" abcd-2345 "), "ABCD2345");
  assert.equal(normalizeGroupInviteCode("abcio10z2345"), "ABCZ2345");
  assert.equal(normalizeGroupInviteCode("ABCDEFGH9"), "ABCDEFGH");
  assert.equal(normalizeGroupInviteCode("ABCDEFGH").length, GROUP_INVITE_CODE_LENGTH);
});

test("group invite validation accepts only complete normalized codes", () => {
  assert.equal(isGroupInviteCode("abcd2345"), true);
  assert.equal(isGroupInviteCode("ABC12345"), false);
  assert.equal(isGroupInviteCode("ABC234"), false);
});
