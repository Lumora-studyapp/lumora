export const FRIEND_USERNAME_MAX_LENGTH = 20;

export function normalizeFriendUsername(value) {
  return String(value || "").trim().normalize("NFC").toLowerCase().slice(0, FRIEND_USERNAME_MAX_LENGTH);
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
  const status = record.status === "studying" || (!record.status && record.subjLabel) ? "studying" : "online";
  return {
    username: normalizeFriendUsername(record.username),
    status,
    subjLabel: status === "studying" ? String(record.subjLabel || "Study") : "",
    subjEmoji: status === "studying" ? String(record.subjEmoji || "📚") : "",
    subjColor: status === "studying" ? String(record.subjColor || "#56B68B") : "#A7B0A9",
    ts: Number(record.ts || 0),
  };
}
