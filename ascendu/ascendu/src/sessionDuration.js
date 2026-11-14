export const MIN_SESSION_SECONDS=5*60;
export const canSaveSession=seconds=>Number.isFinite(seconds)&&seconds>=MIN_SESSION_SECONDS;
