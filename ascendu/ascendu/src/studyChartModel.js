import {formatStudyDate,shiftStudyDay,startOfStudyDay,shiftStudyWeek} from './studyWeek.js';
import {cleanSessions,monthRange,summarize} from './statsModel.js';

export function studyChartBuckets(history,unit='day',offset=0,now=Date.now()) {
  const count=unit==='day'?7:unit==='week'?8:12;
  const sessions=cleanSessions(history,now);
  return Array.from({length:count},(_,index)=>{
    const back=index-count+1+offset*count;
    let start,end,label,title;
    if(unit==='day'){
      start=shiftStudyDay(startOfStudyDay(now),back);end=shiftStudyDay(start,1);
      label=formatStudyDate(start,{weekday:'short'});
      title=formatStudyDate(start,{weekday:'long',day:'numeric',month:'short',year:'numeric'});
    }else if(unit==='week'){
      const week=shiftStudyWeek(now,back);start=week.start;end=week.endExclusive;
      label=formatStudyDate(start,{day:'numeric',month:'short'});
      title=`${label} – ${formatStudyDate(+end-1,{day:'numeric',month:'short',year:'numeric'})}`;
    }else{
      const month=monthRange(now,back);start=month.start;end=month.end;
      label=formatStudyDate(start,{month:'short'});
      title=formatStudyDate(start,{month:'long',year:'numeric'});
    }
    return {key:String(+start),start:+start,end:+end,label,title,...summarize(sessions,start,Math.min(+end,now+1))};
  });
}

export function chartSubject(id,subjects) {
  const subject=subjects.find(s=>s.id===id);
  return {label:subject?.label||'Archived subject',color:/^#[0-9a-f]{3,8}$/i.test(subject?.color||'')?subject.color:'var(--sg-theme-accent,#9473AD)'};
}
