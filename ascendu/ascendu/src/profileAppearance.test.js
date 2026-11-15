import test from 'node:test';
import assert from 'node:assert/strict';
import {loadProfileAppearance} from './profileAppearance.js';
const denied=()=>Promise.reject({code:'permission-denied'});
test('group member with private profile uses their selected character',async()=>{
 const character={activeSkin:'selected-skin',characterAvatar:{model:'woman'}};
 const result=await loadProfileAppearance({loadProfile:denied,loadCharacter:async()=>character,loadPhoto:()=>{throw Error('must not request private photo')}});
 assert.deepEqual(result,{url:'',character});
});
test('accessible custom photo stays preferred over the character',async()=>{
 const result=await loadProfileAppearance({loadProfile:async()=>({photo:true}),loadCharacter:denied,loadPhoto:async()=>'blob:custom-photo'});
 assert.deepEqual(result,{url:'blob:custom-photo',character:null});
});
test('network and image failures are not mistaken for an uncustomised profile',async()=>{
 await assert.rejects(loadProfileAppearance({loadProfile:async()=>{throw Error('offline')},loadCharacter:async()=>({}),loadPhoto:async()=>''}),/offline/);
 await assert.rejects(loadProfileAppearance({loadProfile:async()=>({photo:true}),loadCharacter:async()=>({}),loadPhoto:async()=>{throw Error('missing image')}}),/missing image/);
});
test('profile and selected character requests start together',async()=>{
 let resolveProfile,started=false;
 const pending=loadProfileAppearance({loadProfile:()=>new Promise(r=>resolveProfile=r),loadCharacter:async()=>{started=true;return {activeSkin:'selected'}},loadPhoto:async()=>''});
 assert.equal(started,true);resolveProfile({photo:false});assert.equal((await pending).character.activeSkin,'selected');
});
