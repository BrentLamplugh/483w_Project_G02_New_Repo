import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc, query, where,
} from 'firebase/firestore'
import { db } from '../firebase'

const COL = 'stimuli'

export async function getStimuliForSession(sessionId) {
  const q = query(collection(db, COL), where('session_id', '==', sessionId))
  const snap = await getDocs(q)
  return snap.docs
    .map(d => d.data())
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
}

export function generateStimulusId(sessionId) {
  return `stim_${sessionId}_${Date.now()}`
}

export async function saveStimulus(stimulus) {
  await setDoc(doc(db, COL, stimulus.stimulus_id), stimulus)
}

export async function deleteStimulus(stimulusId) {
  await deleteDoc(doc(db, COL, stimulusId))
}

export async function deleteStimuliForSession(sessionId) {
  const stims = await getStimuliForSession(sessionId)
  await Promise.all(stims.map(s => deleteDoc(doc(db, COL, s.stimulus_id))))
}
