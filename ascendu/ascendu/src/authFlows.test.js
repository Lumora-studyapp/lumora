import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveSignedInAccount} from './authFlows.js';
test('existing provider and email identities resolve the same saved username',async()=>{
  for(const provider of ['google.com','apple.com','password']){
    const user={uid:'same-account',provider};
    assert.deepEqual(await resolveSignedInAccount(user,async uid=>{assert.equal(uid,'same-account');return 'learner';}),{ok:true,created:false,username:'learner'});
  }
});
test('only a confirmed missing username enters setup with the existing identity',async()=>{
  const user={uid:'incomplete-account'};
  const result=await resolveSignedInAccount(user,async()=>null);
  assert.equal(result.needsUsername,true);assert.equal(result.user,user);
});
test('a failed account lookup cannot be treated as a missing username',async()=>{
  const user={uid:'existing-account'};
  const result=await resolveSignedInAccount(user,async()=>{throw Error('permission-denied');});
  assert.equal(result.ok,false);assert.equal(result.needsUsername,undefined);assert.match(result.error,/sign-in succeeded/);assert.equal(user.uid,'existing-account');
});
test('a missing session never triggers a directory lookup',async()=>{
  assert.equal((await resolveSignedInAccount(null,()=>{throw Error('should not run');})).ok,false);
});
