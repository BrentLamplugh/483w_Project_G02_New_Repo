/**
 * gazdata.js
 * Parses GP3HD eye-tracker CSV exports and persists a lightweight summary
 * (stats + preview rows) so localStorage stays small.
 */

const STORAGE_KEY = 'eye_tracking_gaz_summaries'

// ─── localStorage helpers ────────────────────────────────────────────────────

function getAll() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function persist(all) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function getGazSummary(sessionId) {
  return getAll().find(s => s.session_id === sessionId) || null
}

export function saveGazSummary(summary) {
  const all = getAll().filter(s => s.session_id !== summary.session_id)
  all.push(summary)
  persist(all)
}

export function deleteGazSummary(sessionId) {
  persist(getAll().filter(s => s.session_id !== sessionId))
}

// ─── CSV parser ───────────────────────────────────────────────────────────────

/**
 * Parse a GP3HD (or generic eye-tracker) CSV string.
 * Returns a summary object ready to be stored.
 */
export function parseGP3HDCsv(sessionId, csvText) {
  const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')

  // Find the header row — skip comment / empty lines
  let headerIdx = 0
  while (headerIdx < lines.length && !lines[headerIdx].trim()) headerIdx++
  const headerLine = lines[headerIdx]
  if (!headerLine) throw new Error('CSV appears to be empty.')

  const headers = headerLine.split(',').map(h => h.trim())
  if (headers.length < 2) throw new Error('Not a valid CSV file (check delimiter is comma).')

  // Parse all data rows into objects
  const rows = []
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const cols = line.split(',')
    const row = {}
    headers.forEach((h, idx) => {
      row[h] = cols[idx]?.trim() ?? ''
    })
    rows.push(row)
  }

  if (rows.length === 0) throw new Error('CSV has a header but no data rows.')

  // ── Column detection (GP3HD names + common alternatives) ──────────────────

  const col = (candidates) =>
    candidates.find(c => headers.includes(c)) ?? null

  const TIME_COL   = col(['TIME', 'Time', 'time', 'Timestamp', 'timestamp'])
  const FPOGX_COL  = col(['FPOGX', 'fpogx', 'GazeX', 'gaze_x', 'x'])
  const FPOGY_COL  = col(['FPOGY', 'fpogy', 'GazeY', 'gaze_y', 'y'])
  const FPOGV_COL  = col(['FPOGV', 'fpogv', 'FixationValid', 'fixation_valid'])
  const FPOGD_COL  = col(['FPOGD', 'fpogd', 'FixationDuration', 'fixation_duration'])
  const FPOGID_COL = col(['FPOGID', 'fpogid', 'FixationID', 'fixation_id'])
  const BKID_COL   = col(['BKID', 'bkid', 'BlinkID', 'blink_id'])
  const BKDUR_COL  = col(['BKDUR', 'bkdur', 'BlinkDuration', 'blink_duration'])
  const LPMM_COL   = col(['LPMM', 'lpmm', 'LeftPupilDiameter', 'left_pupil'])
  const RPMM_COL   = col(['RPMM', 'rpmm', 'RightPupilDiameter', 'right_pupil'])

  // ── Compute statistics ─────────────────────────────────────────────────────

  // Recording duration
  let durationSec = null
  if (TIME_COL) {
    const times = rows.map(r => parseFloat(r[TIME_COL])).filter(n => !isNaN(n))
    if (times.length >= 2) {
      durationSec = +(Math.max(...times) - Math.min(...times)).toFixed(3)
    }
  }

  // Sample rate estimate
  let sampleRateHz = null
  if (durationSec && durationSec > 0) {
    sampleRateHz = Math.round(rows.length / durationSec)
  }

  // Fixations — count unique FPOGID values where FPOGV == 1 (or FPOGV == '1')
  let fixationCount = 0
  let avgFixationDuration = null
  if (FPOGID_COL) {
    const seenIds = new Set()
    const durations = []
    rows.forEach(r => {
      const valid = FPOGV_COL ? r[FPOGV_COL] === '1' : true
      if (!valid) return
      const fid = r[FPOGID_COL]
      if (fid && fid !== '0' && fid !== '') {
        seenIds.add(fid)
        if (FPOGD_COL) {
          const d = parseFloat(r[FPOGD_COL])
          if (!isNaN(d) && d > 0) durations.push(d)
        }
      }
    })
    fixationCount = seenIds.size
    if (durations.length > 0) {
      avgFixationDuration = +(durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(4)
    }
  }

  // Blinks — count unique BKID values (> 0)
  let blinkCount = 0
  let avgBlinkDuration = null
  if (BKID_COL) {
    const seenBlinks = new Set()
    const bDurations = []
    rows.forEach(r => {
      const bid = r[BKID_COL]
      if (bid && bid !== '0' && bid !== '') {
        seenBlinks.add(bid)
        if (BKDUR_COL) {
          const bd = parseFloat(r[BKDUR_COL])
          if (!isNaN(bd) && bd > 0) bDurations.push(bd)
        }
      }
    })
    blinkCount = seenBlinks.size
    if (bDurations.length > 0) {
      avgBlinkDuration = +(bDurations.reduce((a, b) => a + b, 0) / bDurations.length).toFixed(4)
    }
  }

  // Pupil diameter (average across valid rows)
  let avgPupilLeft = null
  let avgPupilRight = null
  if (LPMM_COL) {
    const vals = rows.map(r => parseFloat(r[LPMM_COL])).filter(n => !isNaN(n) && n > 0)
    if (vals.length) avgPupilLeft = +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(3)
  }
  if (RPMM_COL) {
    const vals = rows.map(r => parseFloat(r[RPMM_COL])).filter(n => !isNaN(n) && n > 0)
    if (vals.length) avgPupilRight = +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(3)
  }

  // Gaze data: collect (x, y) pairs for heatmap-style preview
  const gazePoints = []
  if (FPOGX_COL && FPOGY_COL) {
    rows.forEach(r => {
      const valid = FPOGV_COL ? r[FPOGV_COL] === '1' : true
      if (!valid) return
      const x = parseFloat(r[FPOGX_COL])
      const y = parseFloat(r[FPOGY_COL])
      if (!isNaN(x) && !isNaN(y)) gazePoints.push([+x.toFixed(4), +y.toFixed(4)])
    })
  }

  // Preview rows — first 8 rows, full columns
  const previewRows = rows.slice(0, 8)

  // Detected GP3HD columns subset for display
  const detectedCols = {
    time: TIME_COL,
    fpogx: FPOGX_COL,
    fpogy: FPOGY_COL,
    fpogv: FPOGV_COL,
    fpogd: FPOGD_COL,
    fpogid: FPOGID_COL,
    bkid: BKID_COL,
    bkdur: BKDUR_COL,
    lpmm: LPMM_COL,
    rpmm: RPMM_COL,
  }

  return {
    session_id: sessionId,
    uploaded_at: new Date().toISOString(),
    row_count: rows.length,
    column_count: headers.length,
    headers,
    detected_cols: detectedCols,
    duration_sec: durationSec,
    sample_rate_hz: sampleRateHz,
    fixation_count: fixationCount,
    avg_fixation_duration_sec: avgFixationDuration,
    blink_count: blinkCount,
    avg_blink_duration_sec: avgBlinkDuration,
    avg_pupil_left_mm: avgPupilLeft,
    avg_pupil_right_mm: avgPupilRight,
    gaze_points: gazePoints.length > 2000 ? gazePoints.filter((_, i) => i % Math.ceil(gazePoints.length / 2000) === 0) : gazePoints,
    preview_rows: previewRows,
  }
}
