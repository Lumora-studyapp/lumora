export const GROUP_INVITE_CODE_LENGTH = 8;
export const GROUP_INVITE_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{8}$/;

export function normalizeGroupInviteCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-HJ-NP-Z2-9]/g, "")
    .slice(0, GROUP_INVITE_CODE_LENGTH);
}

export function isGroupInviteCode(value) {
  return GROUP_INVITE_CODE_PATTERN.test(normalizeGroupInviteCode(value));
}
