export const FRIEND_USERNAME_MAX_LENGTH = 20;

export function normalizeFriendUsername(value) {
  return String(value || "").trim().normalize("NFC").toLowerCase().slice(0, FRIEND_USERNAME_MAX_LENGTH);
}

export function filterFriendUsernameSuggestions(usernames, prefix, currentUsername, network) {
  const normalizedPrefix = normalizeFriendUsername(prefix);
  if (normalizedPrefix.length < 2) return [];
  const excluded = new Set([
    normalizeFriendUsername(currentUsername),
    ...(Array.isArray(network?.friends) ? network.friends.map(item => item?.username) : []),
    ...(Array.isArray(network?.incoming) ? network.incoming.map(item => item?.username) : []),
    ...(Array.isArray(network?.outgoing) ? network.outgoing.map(item => item?.username) : []),
  ].map(normalizeFriendUsername).filter(Boolean));
  return [...new Set((Array.isArray(usernames) ? usernames : [])
    .map(normalizeFriendUsername)
    .filter(username => username.startsWith(normalizedPrefix) && !excluded.has(username)))]
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 8);
}

export function friendNetworkErrorMessage(error) {
  const code = String(error?.code || "").replace(/^firestore\//, "");
  if (code === "permission-denied") {
    return "Firebase blocked the friend-list request. The current firestore.rules must be published to the Firebase project (firebase deploy --only firestore:rules).";
  }
  if (code === "unavailable" || code === "deadline-exceeded") {
    return "Could not reach Firebase. Check the connection and retry.";
  }
  return `Friends could not be loaded${code ? ` (${code})` : ""}. Retry, then check the browser console if it continues.`;
}

export function friendConnectionId(firstUid, secondUid) {
  const ids = [String(firstUid || "").trim(), String(secondUid || "").trim()].filter(Boolean).sort();
  return ids.length === 2 && ids[0] !== ids[1] ? ids.join("__") : "";
}

export function friendNetworkFromConnections(connections, currentUid) {
  const network = { friends: [], incoming: [], outgoing: [] };
  for (const connection of Array.isArray(connections) ? connections : []) {
    const requester = {
      uid: String(connection.requesterUid || ""),
      username: normalizeFriendUsername(connection.requesterUsername),
    };
    const recipient = {
      uid: String(connection.recipientUid || ""),
      username: normalizeFriendUsername(connection.recipientUsername),
    };
    const mine = requester.uid === currentUid ? requester : recipient.uid === currentUid ? recipient : null;
    const other = requester.uid === currentUid ? recipient : recipient.uid === currentUid ? requester : null;
    if (!mine || !other?.uid || !other.username) continue;
    const item = { id: connection.id, ...other };
    if (connection.status === "accepted") network.friends.push(item);
    else if (connection.status === "pending" && recipient.uid === currentUid) network.incoming.push(item);
    else if (connection.status === "pending" && requester.uid === currentUid) network.outgoing.push(item);
  }
  for (const key of Object.keys(network)) network[key].sort((a, b) => a.username.localeCompare(b.username));
  return network;
}

export function filterBoardForFriends(entries, currentUsername, friends) {
  const allowed = new Set([
    normalizeFriendUsername(currentUsername),
    ...(Array.isArray(friends) ? friends.map(friend => normalizeFriendUsername(friend.username || friend)) : []),
  ]);
  return (Array.isArray(entries) ? entries : [])
    .filter(entry => allowed.has(normalizeFriendUsername(entry?.username)))
    .sort((a, b) => Number(b?.totalSecs || 0) - Number(a?.totalSecs || 0)
      || normalizeFriendUsername(a?.username).localeCompare(normalizeFriendUsername(b?.username)));
}

export function normalizePresenceRecord(value) {
  const record = value && typeof value === "object" ? value : {};
  const status = record.status === "paused" ? "paused" : (record.status === "studying" || (!record.status && record.subjLabel) ? "studying" : "online");
  const hasSubject = status === "studying" || status === "paused";
  return {
    username: normalizeFriendUsername(record.username),
    status,
    subjLabel: hasSubject ? String(record.subjLabel || "Study") : "",
    subjEmoji: hasSubject ? String(record.subjEmoji || "📚") : "",
    subjColor: hasSubject ? String(record.subjColor || "#56B68B") : "#A7B0A9",
    ts: Number(record.ts || 0),
  };
}
