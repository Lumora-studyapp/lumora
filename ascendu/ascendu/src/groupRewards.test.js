import test from "node:test";
import assert from "node:assert/strict";
import {
  GROUP_REWARD_MIN_PARTICIPANTS,
  groupRewardEligibility,
  groupRows,
  selectLargestEligibleRewardGroup,
} from "./groupRewards.js";

const entries = count => Array.from({ length: count }, (_, index) => ({
  username: `user${index + 1}`,
  totalSecs: (count - index) * 600,
  sessions: 1,
  subjects: { math: (count - index) * 600 },
}));

test("group rows preserve members with no study time while participant mode excludes them", () => {
  const group = { members: ["User1", "user2", "user3"] };
  assert.equal(groupRows(group, entries(2)).length, 3);
  assert.deepEqual(groupRows(group, entries(2), { participantsOnly: true }).map(row => row.username), ["user1", "user2"]);
});

test("weekly group rewards require five participating members", () => {
  const group = { members: entries(6).map(row => row.username) };
  assert.equal(GROUP_REWARD_MIN_PARTICIPANTS, 5);
  assert.equal(groupRewardEligibility(group, entries(4)).eligible, false);
  assert.equal(groupRewardEligibility(group, entries(5)).eligible, true);
});

test("one reward uses the largest eligible group by membership", () => {
  const weekly = entries(10);
  const selected = selectLargestEligibleRewardGroup([
    { id: "more-active", members: weekly.slice(0, 8).map(row => row.username) },
    { id: "largest", members: [...weekly.slice(0, 5).map(row => row.username), "absent1", "absent2", "absent3", "absent4"] },
  ], weekly, "USER2");
  assert.equal(selected.group.id, "largest");
  assert.equal(selected.memberCount, 9);
  assert.equal(selected.participantCount, 5);
  assert.equal(selected.rank, 1);
});

test("a non-participant cannot receive a group podium reward", () => {
  const weekly = entries(5);
  const selected = selectLargestEligibleRewardGroup([
    { id: "eligible", members: [...weekly.map(row => row.username), "absent"] },
  ], weekly, "absent");
  assert.equal(selected, null);
});
