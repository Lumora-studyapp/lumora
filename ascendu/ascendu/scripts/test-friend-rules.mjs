// Run with a local Firestore emulator on port 8187. Never targets production.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initializeApp,deleteApp} from 'firebase/app';
import {getFirestore,connectFirestoreEmulator,collection,query,where,getDocs,getDoc,doc,setDoc,updateDoc,deleteDoc} from 'firebase/firestore';
const project='demo-lumora-friends',host='http://127.0.0.1:8187';
const rules=await readFile(new URL('../firestore.rules',import.meta.url),'utf8');
const response=await fetch(`${host}/emulator/v1/projects/${project}:securityRules`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({rules:{files:[{name:'firestore.rules',content:rules}]}})});
assert.equal(response.ok,true,await response.text());
const apps=[];
function client(uid){const app=initializeApp({projectId:project},uid||'anonymous');apps.push(app);const db=getFirestore(app);connectFirestoreEmulator(db,'127.0.0.1',8187,uid?{mockUserToken:{sub:uid,user_id:uid}}:{});return db;}
const alice=client('alice'),bob=client('bob'),eve=client('eve'),anon=client('');
async function seed(path,fields){const result=await fetch(`${host}/v1/projects/${project}/databases/(default)/documents/${path}`,{method:'PATCH',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({fields})});assert.equal(result.ok,true,await result.text());}
const denied=p=>assert.rejects(p,e=>e.code==='permission-denied');
const own=db=>getDocs(query(collection(db,'friend_connections'),where('userUids','array-contains',db===alice?'alice':db===bob?'bob':'eve')));
try{
 await fetch(`${host}/emulator/v1/projects/${project}/databases/(default)/documents`,{method:'DELETE'});
 assert.equal((await own(alice)).size,0,'empty friends query succeeds');
 await seed('usernames/alice',{uid:{stringValue:'alice'}});await seed('usernames/bob',{uid:{stringValue:'bob'}});
 const connection={requesterUid:'alice',requesterUsername:'alice',recipientUid:'bob',recipientUsername:'bob',userUids:['alice','bob'],status:'pending',createdAt:1,updatedAt:1};
 await setDoc(doc(alice,'friend_connections/alice__bob'),connection);
 assert.equal((await own(alice)).size,1);assert.equal((await own(bob)).size,1);assert.equal((await own(eve)).size,0);
 await denied(getDocs(collection(alice,'friend_connections')));
 await denied(getDocs(query(collection(eve,'friend_connections'),where('userUids','array-contains','alice'))));
 await denied(getDocs(query(collection(anon,'friend_connections'),where('userUids','array-contains','alice'))));
 await denied(getDoc(doc(eve,'friend_connections/alice__bob')));
 await denied(updateDoc(doc(alice,'friend_connections/alice__bob'),{status:'accepted',acceptedAt:2,updatedAt:2}));
 await updateDoc(doc(bob,'friend_connections/alice__bob'),{status:'accepted',acceptedAt:2,updatedAt:2});
 assert.equal((await own(alice)).docs[0].data().status,'accepted');
 await denied(deleteDoc(doc(eve,'friend_connections/alice__bob')));
 await deleteDoc(doc(alice,'friend_connections/alice__bob'));
 assert.equal((await own(bob)).size,0);
 console.log('PASS: empty/participant queries, request creation/acceptance/removal; outsider, anonymous, unfiltered reads and unauthorized writes denied.');
}finally{await Promise.all(apps.map(deleteApp));}
