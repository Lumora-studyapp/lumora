export const GROUP_REWARD_MIN_PARTICIPANTS = 5;

const canonical = value => String(value || "").trim().normalize("NFC").toLowerCase();

export function groupRows(group, entries, { participantsOnly = false } = {}) {
  const byUsername = new Map((Array.isArray(entries) ? entries : [])
    .map(row => [canonical(row?.username), row]));
  return [...new Set((Array.isArray(group?.members) ? group.members : []).map(canonical).filter(Boolean))]
    .map(username => byUsername.get(username) || { username, totalSecs: 0, sessions: 0, subjects: {} })
    .filter(row => !participantsOnly || Number(row.totalSecs) > 0)
    .sort((a, b) => Number(b.totalSecs || 0) - Number(a.totalSecs || 0)
      || canonical(a.username).localeCompare(canonical(b.username)));
}

export function groupRewardEligibility(group, weeklyEntries, minimum = GROUP_REWARD_MIN_PARTICIPANTS) {
  const participants = groupRows(group, weeklyEntries, { participantsOnly: true });
  return {
    eligible: participants.length >= minimum,
    participantCount: participants.length,
    participants,
    minimum,
  };
}

export function selectLargestEligibleRewardGroup(groups, weeklyEntries, username, minimum = GROUP_REWARD_MIN_PARTICIPANTS) {
  const currentUsername = canonical(username);
  const candidates = (Array.isArray(groups) ? groups : []).map(group => {
    const eligibility = groupRewardEligibility(group, weeklyEntries, minimum);
    const rank = eligibility.participants.findIndex(row => canonical(row.username) === currentUsername);
    const memberCount = new Set((Array.isArray(group?.members) ? group.members : []).map(canonical).filter(Boolean)).size;
    return { group, rank, memberCount, ...eligibility };
  }).filter(candidate => candidate.eligible && candidate.rank >= 0)
    .sort((a, b) => b.memberCount - a.memberCount
      || b.participantCount - a.participantCount
      || canonical(a.group?.id).localeCompare(canonical(b.group?.id)));
  return candidates[0] || null;
}
