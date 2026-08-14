import test from "node:test";
import assert from "node:assert/strict";
import {
  filterBoardForFriends,
  friendConnectionId,
  friendNetworkFromConnections,
  normalizeFriendUsername,
  normalizePresenceRecord,
} from "./friendships.js";

test("friend identities and connection IDs are canonical and stable", () => {
  assert.equal(normalizeFriendUsername("  RAPH  "), "raph");
  assert.equal(friendConnectionId("uid-b", "uid-a"), "uid-a__uid-b");
  assert.equal(friendConnectionId("uid-a", "uid-a"), "");
});

test("friend network separates accepted and pending directions", () => {
  const network = friendNetworkFromConnections([
    { id: "a", requesterUid: "me", requesterUsername: "Me", recipientUid: "one", recipientUsername: "One", status: "accepted" },
    { id: "b", requesterUid: "two", requesterUsername: "Two", recipientUid: "me", recipientUsername: "Me", status: "pending" },
    { id: "c", requesterUid: "me", requesterUsername: "Me", recipientUid: "three", recipientUsername: "Three", status: "pending" },
  ], "me");
  assert.deepEqual(network.friends.map(x => x.username), ["one"]);
  assert.deepEqual(network.incoming.map(x => x.username), ["two"]);
  assert.deepEqual(network.outgoing.map(x => x.username), ["three"]);
});

test("friends leaderboard includes only the user and accepted friends", () => {
  const rows = filterBoardForFriends([
    { username: "stranger", totalSecs: 900 },
    { username: "friend", totalSecs: 600 },
    { username: "me", totalSecs: 300 },
  ], "me", [{ username: "friend" }]);
  assert.deepEqual(rows.map(row => row.username), ["friend", "me"]);
});

test("presence defaults safely and legacy subject records remain studying", () => {
  assert.equal(normalizePresenceRecord({ username: "One", ts: 1 }).status, "online");
  assert.equal(normalizePresenceRecord({ username: "Legacy", subjLabel: "English", ts: 1 }).status, "studying");
  assert.deepEqual(normalizePresenceRecord({ username: "Two", status: "studying", subjLabel: "Math", subjEmoji: "📐", ts: 2 }), {
    username: "two", status: "studying", subjLabel: "Math", subjEmoji: "📐", subjColor: "#56B68B", ts: 2,
  });
});
