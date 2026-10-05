import {STUDY_WEEK_TIME_ZONE} from "./studyWeek.js";

const dayFormatter=new Intl.DateTimeFormat("en-CA",{timeZone:STUDY_WEEK_TIME_ZONE,year:"numeric",month:"2-digit",day:"2-digit"});
const dayKey=timestamp=>{
  const parts=Object.fromEntries(dayFormatter.formatToParts(Number(timestamp))
    .filter(part=>part.type!=="literal").map(part=>[part.type,Number(part.value)]));
  return Date.UTC(parts.year,parts.month-1,parts.day);
};

export function studyRecords(history){
  const sessions=(history||[]).filter(item=>item?.ts!=null&&Number.isFinite(Number(item.ts))
    &&Number.isFinite(Number(item?.secs))&&Number(item.secs)>0);
  const totals=new Map();
  for(const item of sessions){
    const key=dayKey(item.ts);
    totals.set(key,(totals.get(key)||0)+Number(item.secs));
  }
  const days=[...totals.keys()].sort((a,b)=>a-b);
  let streak=0,longest=0;
  for(let i=0;i<days.length;i++){
    streak=i&&days[i]-days[i-1]===86400000?streak+1:1;
    longest=Math.max(longest,streak);
  }
  return [
    {label:"Longest streak",value:longest+" days",icon:"🔥"},
    {label:"Best focus day",value:Math.round(Math.max(0,...totals.values())/60)+" min",icon:"🌟"},
    {label:"Total focus time",value:Math.round(sessions.reduce((sum,item)=>sum+Number(item.secs),0)/3600)+" h",icon:"⏳"},
    {label:"Sessions",value:String(sessions.length),icon:"📚"},
  ];
}
