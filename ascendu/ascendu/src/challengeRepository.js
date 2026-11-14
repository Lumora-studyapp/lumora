import {getStudyWeek} from './studyWeek.js';
import {cleanSessions,summarize} from './statsModel.js';
import {weekChoices,challengeState,validChoice} from './challengeModel.js';

export function createChallengeRepository({doc,getDoc,runTransaction,auth,db,clock=Date.now}) {
async function loadChallenges(user,friends,now=clock()) {
  const week=getStudyWeek(now);
  const own=await getDoc(doc(db,'prefs',user));
  const choices=weekChoices(own.data(),week.key);
  const peers=await Promise.all(friends.map(async friend=>{
    const snap=await getDoc(doc(db,'prefs',friend.username));
    const theirs=weekChoices(snap.data(),week.key)[user];
    let secs=0;
    if(challengeState(choices[friend.username],theirs)==='active'){
      const history=await getDoc(doc(db,'history',friend.username));
      secs=summarize(cleanSessions(history.data()?.sessions,now),week.start,now+1).secs;
    }
    return {...friend,choice:theirs,secs};
  }));
  return {choices,peers,weekKey:week.key};
}
async function saveChallenge(user,friend,choice,expectedWeek){
  if(!auth.currentUser||!validChoice(choice))throw new Error('Please sign in and choose a valid challenge.');
  const week=getStudyWeek(clock());
  const uid=auth.currentUser.uid;
  if(week.key!==expectedWeek)throw new Error('A new study week has started. Refresh before joining.');
  await runTransaction(db,async tx=>{
    if(getStudyWeek(clock()).key!==expectedWeek)throw new Error("A new study week has started. Refresh before joining.");
    const ref=doc(db,'prefs',user);
    const [connection,snap,peer]=await Promise.all([tx.get(doc(db,'friend_connections',friend.id)),tx.get(ref),tx.get(doc(db,'prefs',friend.username))]);
    const data=connection.data();
    if(data?.status!=='accepted'||!data.userUids?.includes(uid)||!data.userUids?.includes(friend.uid))throw new Error('This challenge requires an accepted friend connection.');
    if(choice.status==='accepted'){
      const offered=weekChoices(peer.data(),week.key)[user];
      if(offered?.status!=='invited'||offered.id!==choice.id||offered.mode!==choice.mode||offered.goalHours!==choice.goalHours)throw new Error('That invitation changed. Refresh and try again.');
    }
    const choices={...weekChoices(snap.data(),week.key),[friend.username]:choice};
    // Replace the whole week map, so last week's invitations cannot survive a
    // nested merge and silently re-enrol friends in a new week.
    const patch={ownerUid:uid,studyChallengeWeek:{weekKey:week.key,choices}};
    if(snap.exists())tx.update(ref,patch);else tx.set(ref,patch);
  });
}

return {load:loadChallenges,save:saveChallenge};
}
