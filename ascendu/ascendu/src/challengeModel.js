export const CHALLENGE_GOALS=[2,5,10];
export function weekChoices(prefs,weekKey){return prefs?.studyChallengeWeek?.weekKey===weekKey?prefs.studyChallengeWeek.choices||{}:{};}
export function validChoice(choice){return !!choice&&['together','friendly'].includes(choice.mode)&&CHALLENGE_GOALS.includes(choice.goalHours)&&typeof choice.id==='string'&&choice.id.length>0&&['invited','accepted','declined'].includes(choice.status);}
export function challengeState(mine,theirs){
  if(!validChoice(mine)&&!validChoice(theirs))return 'none';
  const same=validChoice(mine)&&validChoice(theirs)&&mine.id===theirs.id&&mine.mode===theirs.mode&&mine.goalHours===theirs.goalHours;
  if(same&&[mine.status,theirs.status].includes('declined'))return 'ended';
  if(same&&[mine.status,theirs.status].includes('accepted'))return 'active';
  if(validChoice(theirs)&&theirs.status==='invited')return 'incoming';
  if(validChoice(mine)&&mine.status==='invited')return 'waiting';
  return 'none';
}
export function challengeProgress(choice,mine,theirs){
  const individual=choice.goalHours*3600;
  const total=choice.mode==='together'?mine+theirs:mine;
  const goal=choice.mode==='together'?individual*2:individual;
  return {goal,total,percent:Math.min(100,Math.floor(total/goal*100)),remaining:Math.max(0,goal-total)};
}
