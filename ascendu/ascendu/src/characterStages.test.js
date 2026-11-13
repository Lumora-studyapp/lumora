import test from 'node:test';
import assert from 'node:assert/strict';
import {characterStageIndex} from './characterStages.js';

test('character previews and study sessions share exact milestone boundaries',()=>{
  for(const [minutes,stage] of [[0,0],[25,0],[45,1],[90,2],[150,3],[180,4],[240,4]]){
    assert.equal(characterStageIndex(minutes*60),stage,`${minutes} minutes`);
  }
  assert.equal(characterStageIndex(180*60,3),2);
});
