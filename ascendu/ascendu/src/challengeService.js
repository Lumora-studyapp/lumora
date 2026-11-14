import {doc,getDoc,runTransaction} from 'firebase/firestore';
import {auth,db} from './firebase.js';
import {createChallengeRepository} from './challengeRepository.js';
const repository=createChallengeRepository({doc,getDoc,runTransaction,auth,db});
export const loadChallenges=repository.load;
export const saveChallenge=repository.save;
