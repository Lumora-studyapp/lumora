import {httpsCallable} from 'firebase/functions';
import {collection,doc,getDocs,limit,orderBy,query,serverTimestamp,startAfter,updateDoc,where} from 'firebase/firestore';
import {db,functions} from './firebase.js';

export async function sendFeedback(payload){
  const result=await httpsCallable(functions,'submitFeedback')(payload);
  if(result.data?.received!==true)throw new Error('Feedback was not confirmed. Please retry.');
}
export const feedbackAdminApi={
  async load(category,cursor){
    const constraints=[...(category==='all'?[]:[where('category','==',category)]),orderBy('createdAt','desc'),...(cursor?[startAfter(cursor)]:[]),limit(50)];
    const result=await getDocs(query(collection(db,'private_feedback'),...constraints));
    return {rows:result.docs.map(item=>({id:item.id,...item.data()})),cursor:result.docs.at(-1),more:result.size===50};
  },
  update(id,status){return updateDoc(doc(db,'private_feedback',id),{status,updatedAt:serverTimestamp()});},
};
export function feedbackError(error){
  const code=String(error?.code||'').replace(/^functions\//,'');
  if(code==='resource-exhausted')return 'You have sent five messages today. Please try again tomorrow (UTC).';
  if(code==='unauthenticated')return 'Please sign in again before sending feedback.';
  if(code==='permission-denied')return 'You do not have permission to access feedback.';
  return 'We could not complete that request. Your message has been kept; please try again.';
}
