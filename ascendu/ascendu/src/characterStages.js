export const CHARACTER_STAGE_RANGES=['0–45 min','45–90 min','90–150 min','150–180 min','180+ min'];
export const CHARACTER_STAGE_ENDS=[45,90,150,180,Infinity].map(minutes=>minutes*60);

export function characterStageIndex(seconds,stageCount=CHARACTER_STAGE_RANGES.length){
  const elapsed=Math.max(0,Number(seconds)||0);
  const index=CHARACTER_STAGE_ENDS.findIndex(end=>elapsed<end);
  return Math.min(Math.max(0,stageCount-1),index<0?CHARACTER_STAGE_ENDS.length-1:index);
}
