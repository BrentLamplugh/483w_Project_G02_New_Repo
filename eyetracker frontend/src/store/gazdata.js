import {
  doc, getDoc, setDoc, deleteDoc,
} from 'firebase/firestore'
import { db } from '../firebase'

const COL = 'gaz_summaries'

// Firestore does not support nested arrays (e.g. [[x,y],[x,y]]).
// Convert gaze_points arrays to/from {x,y} objects on save/load.

function convertPoints(points) {
  if (!points?.length) return []
  // Already objects (from Firestore) → convert to arrays
  if (typeof points[0] === 'object' && !Array.isArray(points[0])) {
    return points.map(p => [p.x, p.y])
  }
  // Already arrays → convert to objects
  return points.map(([x, y]) => ({ x, y }))
}

function serializeStimData(data) {
  return { ...data, gaze_points: convertPoints(data.gaze_points ?? []) }
}

function deserializeStimData(data) {
  return { ...data, gaze_points: convertPoints(data.gaze_points ?? []) }
}

// Firestore rejects undefined values and empty-string keys (e.g. from CSV headers).
function sanitize(val) {
  if (val === undefined) return null
  if (val === null || typeof val !== 'object') return val
  if (Array.isArray(val)) return val.map(sanitize)
  return Object.fromEntries(
    Object.entries(val)
      .filter(([k]) => k !== '')
      .map(([k, v]) => [k, sanitize(v)])
  )
}

function serialize(summary) {
  const out = sanitize({ ...summary, gaze_points: convertPoints(summary.gaze_points ?? []) })
  if (summary.per_stimulus) {
    out.per_stimulus = Object.fromEntries(
      Object.entries(summary.per_stimulus).map(([id, d]) => [id, sanitize(serializeStimData(d))])
    )
  }
  return out
}

function deserialize(data) {
  const out = { ...data, gaze_points: convertPoints(data.gaze_points ?? []) }
  if (data.per_stimulus) {
    out.per_stimulus = Object.fromEntries(
      Object.entries(data.per_stimulus).map(([id, d]) => [id, deserializeStimData(d)])
    )
  }
  return out
}

export async function getGazSummary(sessionId) {
  const snap = await getDoc(doc(db, COL, sessionId))
  return snap.exists() ? deserialize(snap.data()) : null
}

export async function saveGazSummary(summary) {
  await setDoc(doc(db, COL, summary.session_id), serialize(summary))
}

export async function deleteGazSummary(sessionId) {
  await deleteDoc(doc(db, COL, sessionId))
}
