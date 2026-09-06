import test from 'node:test';
import assert from 'node:assert/strict';
import {observeStage} from './focusStageTransition.js';
const base={sessionId:'session-a',stage:0,active:true,enabled:true,visible:true};
test('each advancement emits once despite rerenders, pause/resume and rollback',()=>{
  let cursor=observeStage(null,base).cursor;
  const events=[];
  for(const patch of [{stage:1},{stage:1},{stage:1,active:false},{stage:1},{stage:0},{stage:1},{stage:2},{stage:3},{stage:4},{stage:4}]){
    const result=observeStage(cursor,{...base,...patch});cursor=result.cursor;
    if(result.advancement)events.push(result.advancement.to);
  }
  assert.deepEqual(events,[1,2,3,4]);
});
test('restores and new sessions establish a baseline',()=>{
  assert.equal(observeStage(null,{...base,stage:3}).advancement,null);
  assert.equal(observeStage({sessionId:'old',stage:0},{...base,stage:3}).advancement,null);
});
test('suppressed advancements are consumed, never queued for re-enabling',()=>{
  for(const suppression of [{active:false},{enabled:false},{visible:false}]){
    const first=observeStage({sessionId:base.sessionId,stage:0},{...base,stage:1,...suppression});
    assert.equal(first.advancement,null);
    assert.equal(observeStage(first.cursor,{...base,stage:1}).advancement,null);
  }
});
test('a time catch-up emits one transition to the current stage',()=>{
  assert.deepEqual(observeStage({sessionId:base.sessionId,stage:0},{...base,stage:4}).advancement,
    {id:'session-a:4',from:0,to:4});
});
