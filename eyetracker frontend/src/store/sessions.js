import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
} from 'firebase/firestore'
import { db } from '../firebase'

const COL = 'sessions'

const DEFAULTS = { stimulus_loaded: false, stimuli_count: 0, analysis_viewed: false }

export async function getSessions() {
  const snap = await getDocs(collection(db, COL))
  return snap.docs
    .map(d => ({ ...DEFAULTS, ...d.data() }))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
}

export async function saveSession(session) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Firestore timed out — check your database rules and internet connection')), 8000)
  )
  await Promise.race([
    setDoc(doc(db, COL, session.session_id), { ...DEFAULTS, ...session }),
    timeout,
  ])
}

export async function getSessionById(id) {
  const snap = await getDoc(doc(db, COL, id))
  return snap.exists() ? { ...DEFAULTS, ...snap.data() } : null
}

export async function updateSession(id, updates) {
  const ref = doc(db, COL, id)
  await updateDoc(ref, updates)
  const snap = await getDoc(ref)
  return snap.exists() ? snap.data() : null
}

export async function deleteSession(id) {
  await deleteDoc(doc(db, COL, id))
}

export function generateSessionId() {
  const year = new Date().getFullYear()
  const suffix = Date.now().toString(36).slice(-4).toUpperCase()
  return `S_${year}_${suffix}`
}
