export const STAGE_BURST_MS = 1550;

// Consume every observed advancement, including suppressed ones. Restores and
// new sessions establish a baseline rather than replaying historical levels.
export function observeStage(previous, {sessionId, stage, active, enabled, visible}) {
  if (!previous || previous.sessionId !== sessionId) {
    return {cursor:{sessionId, stage}, advancement:null};
  }
  const cursor={sessionId, stage:Math.max(previous.stage,stage)};
  const advancement=stage>previous.stage && active && enabled && visible
    ? {id:`${sessionId}:${stage}`, from:previous.stage, to:stage} : null;
  return {cursor, advancement};
}
