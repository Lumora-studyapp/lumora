import test from 'node:test';
import assert from 'node:assert/strict';
import feedback from '../functions/feedback.cjs';

class CallableError extends Error{constructor(code,message){super(message);this.code=code;}}
const data=(n=1)=>({category:'improvement',message:'Please add more study sounds.',submissionId:`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`});
function setup(){
  const records=new Map();let now=Date.parse('2026-11-16T23:59:00Z'),mapped=true,queue=Promise.resolve();
  const db={collection:name=>({doc:id=>({key:`${name}/${id}`}),where:()=>({limit:()=>({mapping:true})})}),runTransaction:fn=>{
    const result=queue.then(async()=>{
      const writes=[];
      const output=await fn({get:async ref=>ref.mapping?{empty:!mapped,docs:[{id:'actualuser'}]}:{exists:records.has(ref.key),data:()=>records.get(ref.key)},
        create:(ref,value)=>writes.push([ref.key,value]),set:(ref,value)=>writes.push([ref.key,value])});
      writes.forEach(([key,value])=>records.set(key,value));return output;
    });queue=result.catch(()=>{});return result;
  }};
  const submit=feedback.createSubmitFeedback({db,ErrorType:CallableError,now:()=>now});
  return {records,submit,request:(n=1,uid='user')=>({auth:{uid},data:data(n)}),nextDay:()=>now+=86400000,unmap:()=>mapped=false};
}
test('feedback requires authentication and validates category, message and retry ID',async()=>{
  const s=setup();await assert.rejects(s.submit({data:data()}),{code:'unauthenticated'});
  for(const change of [{category:'other'},{message:' short '},{message:'x'.repeat(2001)},{submissionId:'../other'}]){
    await assert.rejects(s.submit({...s.request(),data:{...data(),...change}}),{code:'invalid-argument'});
  }
  assert.equal(s.records.size,0);
});
test('author comes from auth and account mapping; content is trimmed and private',async()=>{
  const s=setup();await s.submit({...s.request(),data:{...data(),username:'spoofed',message:'  Please add study sounds.  '}});
  const saved=[...s.records.entries()].find(([key])=>key.startsWith('private_feedback/'))[1];
  assert.equal(saved.uid,'user');assert.equal(saved.username,'actualuser');assert.equal(saved.message,'Please add study sounds.');
  assert.equal(saved.status,'new');assert(saved.createdAt instanceof Date);
});
test('simultaneous retries write one submission and consume one quota slot',async()=>{
  const s=setup();await Promise.all(Array.from({length:10},()=>s.submit(s.request())));
  assert.equal(s.records.size,2);assert.equal([...s.records.values()].find(row=>row.day).count,1);
  await assert.rejects(s.submit({...s.request(),data:{...data(),message:'A different request body'}}),{code:'already-exists'});
});
test('daily quota is account-scoped, resets at UTC day changes and allows old receipts',async()=>{
  const s=setup();const result=await Promise.allSettled(Array.from({length:7},(_,n)=>s.submit(s.request(n+1))));
  assert.equal(result.filter(r=>r.status==='fulfilled').length,5);
  assert.equal(result[5].reason.code,'resource-exhausted');
  assert.deepEqual(await s.submit(s.request(1)),{received:true});
  await s.submit(s.request(6,'second-user'));
  s.nextDay();await s.submit(s.request(6));
});
test('an incomplete account cannot submit and does not consume quota',async()=>{
  const s=setup();s.unmap();await assert.rejects(s.submit(s.request()),{code:'failed-precondition'});assert.equal(s.records.size,0);
});
