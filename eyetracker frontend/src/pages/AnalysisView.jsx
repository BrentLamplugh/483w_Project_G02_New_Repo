import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getSessionById } from '../store/sessions'
import { getStimuliForSession } from '../store/stimuli'
import { getGazSummary } from '../store/gazdata'
import { format } from 'date-fns'

// ─── Color helpers ────────────────────────────────────────────────────────────

/**
 * Maps a normalized value [0,1] to a heat color.
 * Returns { r, g, b, a } where a is 0-1.
 */
function heatColor(norm) {
  const stops = [
    [0,    [8,   10,  15,  0   ]],
    [0.15, [30,  80,  200, 0.3 ]],
    [0.35, [0,   200, 220, 0.55]],
    [0.55, [57,  217, 138, 0.7 ]],
    [0.75, [251, 191, 36,  0.85]],
    [1.0,  [248, 113, 113, 1.0 ]],
  ]
  for (let i = 1; i < stops.length; i++) {
    const [t0, c0] = stops[i - 1]
    const [t1, c1] = stops[i]
    if (norm <= t1) {
      const f = (norm - t0) / (t1 - t0)
      return {
        r: Math.round(c0[0] + f * (c1[0] - c0[0])),
        g: Math.round(c0[1] + f * (c1[1] - c0[1])),
        b: Math.round(c0[2] + f * (c1[2] - c0[2])),
        a: +(c0[3] + f * (c1[3] - c0[3])).toFixed(3),
      }
    }
  }
  return { r: 248, g: 113, b: 113, a: 1 }
}

// ─── Scanpath / Fixation helpers ──────────────────────────────────────────────

function buildScanpath(gazePoints) {
  if (!gazePoints?.length) return []
  const RADIUS = 0.04
  const stops = []
  let cluster = [gazePoints[0]]

  for (let i = 1; i < gazePoints.length; i++) {
    const [px, py] = cluster[cluster.length - 1]
    const [cx, cy] = gazePoints[i]
    const d = Math.sqrt((cx - px) ** 2 + (cy - py) ** 2)
    if (d < RADIUS) {
      cluster.push(gazePoints[i])
    } else {
      const mx = cluster.reduce((s, p) => s + p[0], 0) / cluster.length
      const my = cluster.reduce((s, p) => s + p[1], 0) / cluster.length
      stops.push({ x: mx, y: my, dwell: cluster.length })
      cluster = [gazePoints[i]]
    }
  }
  if (cluster.length) {
    const mx = cluster.reduce((s, p) => s + p[0], 0) / cluster.length
    const my = cluster.reduce((s, p) => s + p[1], 0) / cluster.length
    stops.push({ x: mx, y: my, dwell: cluster.length })
  }
  if (stops.length > 50) {
    const step = Math.ceil(stops.length / 50)
    return stops.filter((_, i) => i % step === 0).slice(0, 50)
  }
  return stops
}

function buildFixationPoints(gazePoints) {
  if (!gazePoints?.length) return []
  const raw = buildScanpath(gazePoints)
  const maxDwell = Math.max(...raw.map(s => s.dwell), 1)
  return raw.map((s, i) => ({ ...s, id: i + 1, normDwell: s.dwell / maxDwell }))
}

function buildDefaultAOIs(gazePoints) {
  if (!gazePoints?.length) return []
  const regions = [
    { id: 1, name: 'Top-Left',     x: 0,   y: 0,   w: 0.5, h: 0.5 },
    { id: 2, name: 'Top-Right',    x: 0.5, y: 0,   w: 0.5, h: 0.5 },
    { id: 3, name: 'Bottom-Left',  x: 0,   y: 0.5, w: 0.5, h: 0.5 },
    { id: 4, name: 'Bottom-Right', x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
  ]
  const ACCENT_COLORS = ['#39d98a', '#60a5fa', '#fbbf24', '#f87171']
  return regions.map((r, i) => {
    const hits = gazePoints.filter(([x, y]) =>
      x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h
    )
    return {
      ...r,
      fixationCount: hits.length,
      totalTime: +(hits.length * 0.033).toFixed(2),
      color: ACCENT_COLORS[i],
    }
  })
}

// ─── Plain-English Summary ────────────────────────────────────────────────────

function generateSummary(gazSummary, aois, scanpath) {
  if (!gazSummary) return []
  const lines = []

  const fc = gazSummary.fixation_count
  if (fc != null) {
    if (fc < 20) lines.push(`The participant made ${fc} fixations — a relatively low number, suggesting quick scanning behaviour.`)
    else if (fc < 80) lines.push(`The participant made ${fc} fixations across the stimulus, indicating moderate engagement.`)
    else lines.push(`The participant made ${fc} fixations, indicating thorough and detailed reading of the stimulus.`)
  }

  const afd = gazSummary.avg_fixation_duration_sec
  if (afd != null) {
    if (afd < 0.15) lines.push('Short average fixation durations suggest rapid, automatic recognition of content.')
    else if (afd < 0.3) lines.push(`Average fixation duration of ${afd}s is within the typical reading range.`)
    else lines.push(`Longer-than-average fixation durations (${afd}s) suggest this content required more effort to process.`)
  }

  if (aois?.length) {
    const sorted = [...aois].sort((a, b) => b.fixationCount - a.fixationCount)
    const top = sorted[0]
    const total = sorted.reduce((s, a) => s + a.fixationCount, 0)
    if (top && total > 0) {
      const pct = Math.round((top.fixationCount / total) * 100)
      lines.push(`Attention was concentrated in the ${top.name} region, accounting for ${pct}% of all fixations.`)
      if (sorted.length > 1 && sorted[1].fixationCount > 0) {
        lines.push(`The ${sorted[1].name} region received the second-most attention with ${sorted[1].fixationCount} fixations.`)
      }
    }
  }

  if (scanpath?.length) {
    if (scanpath.length > 20) lines.push('The scanpath shows extensive back-and-forth movement, indicating re-reading or confusion.')
    else if (scanpath.length > 10) lines.push('The scanpath shows a moderately complex reading pattern with some re-visits.')
    else lines.push('The scanpath is compact and linear, suggesting efficient, top-down processing.')

    const cx = scanpath.reduce((s, p) => s + p.x, 0) / scanpath.length
    const cy = scanpath.reduce((s, p) => s + p.y, 0) / scanpath.length
    const hLabel = cx < 0.4 ? 'left side' : cx > 0.6 ? 'right side' : 'centre'
    const vLabel = cy < 0.4 ? 'top' : cy > 0.6 ? 'bottom' : 'middle'
    lines.push(`The participant focused mostly on the ${vLabel} ${hLabel} of the image.`)
  }

  const bc = gazSummary.blink_count
  if (bc != null) {
    const dur = gazSummary.duration_sec || 1
    const bpm = bc / (dur / 60)
    if (bpm > 20) lines.push(`An elevated blink rate (${bc} blinks) may indicate fatigue or high cognitive load.`)
    else if (bc > 0) lines.push(`Blink count (${bc}) appears normal for the session duration.`)
  }

  const pl = gazSummary.avg_pupil_left_mm
  const pr = gazSummary.avg_pupil_right_mm
  if (pl && pr) {
    const avg = +((pl + pr) / 2).toFixed(2)
    if (avg > 5) lines.push(`Average pupil diameter of ${avg}mm suggests elevated arousal or cognitive load.`)
    else lines.push(`Pupil diameter (avg ${avg}mm) is within normal resting range.`)
  }

  if (!lines.length) lines.push('Upload gaze data to generate a summary.')
  return lines
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: `2px solid ${active === t.id ? 'var(--accent)' : 'transparent'}`,
            color: active === t.id ? 'var(--accent)' : 'var(--text-muted)',
            fontFamily: 'var(--mono)',
            fontSize: 12,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            padding: '10px 16px',
            cursor: 'pointer',
            transition: 'all 0.15s',
            marginBottom: -1,
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

function SvgOverlay({ stimulus, children, viewW = 1, viewH = 0.75 }) {
  return (
    <div style={{
      position: 'relative',
      background: '#0b0e14',
      border: '1px solid var(--border)',
      borderRadius: 8,
      overflow: 'hidden',
    }}>
      {stimulus?.type === 'image' ? (
        <img
          src={stimulus.src}
          alt={stimulus.name}
          style={{ width: '100%', display: 'block', opacity: 0.55 }}
        />
      ) : stimulus?.type === 'code' ? (
        <pre style={{
          margin: 0,
          background: '#0b0e14',
          color: '#8895b3',
          fontFamily: 'var(--mono)',
          fontSize: 11,
          lineHeight: 1.5,
          padding: 16,
          opacity: 0.5,
          maxHeight: 420,
          overflow: 'hidden',
        }}>{stimulus.content}</pre>
      ) : (
        <div style={{ height: 340, background: '#0b0e14' }} />
      )}
      <svg
        viewBox={`0 0 ${viewW} ${viewH}`}
        width="100%"
        preserveAspectRatio="xMidYMid meet"
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      >
        {children}
      </svg>
    </div>
  )
}

function NoData({ label }) {
  return (
    <div style={{
      height: 200,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      background: 'var(--surface2)',
      borderRadius: 8,
      border: '1px solid var(--border)',
    }}>
      <span style={{ fontSize: 28, opacity: 0.3 }}>◌</span>
      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{label}</span>
    </div>
  )
}

function StatMini({ label, value }) {
  return (
    <div style={{
      background: 'var(--surface2)',
      border: '1px solid var(--border)',
      borderRadius: 6,
      padding: '10px 12px',
    }}>
      <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 600, fontFamily: 'var(--mono)', color: 'var(--text)' }}>{value}</div>
    </div>
  )
}

// ── Heatmap ───────────────────────────────────────────────────────────────────
//
// Algorithm:
//   Pass 1 — draw a soft radial-gradient blob for every gaze point onto an
//             off-screen canvas using globalCompositeOperation='lighter'
//             (additive blending).  Dense regions accumulate brighter white.
//   Pass 2 — read the raw pixel intensities, normalise, apply the heat
//             colormap with gamma correction, write to the visible canvas.
//
// This produces a smooth, continuously-blended density field with no visible
// grid cells or block artefacts.
//
function HeatmapView({ gazePoints, stimulus }) {
  const canvasRef = useRef(null)

  // Internal resolution — high enough to stay sharp when scaled by CSS.
  const CANVAS_W = 960
  const CANVAS_H = 720

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !gazePoints?.length) return

    const ctx = canvas.getContext('2d')
    const W = CANVAS_W
    const H = CANVAS_H

    // ── Pass 1: accumulate intensity on an off-screen canvas ─────────────────
    const tmp = document.createElement('canvas')
    tmp.width  = W
    tmp.height = H
    const tctx = tmp.getContext('2d')

    // Black background (zero intensity)
    tctx.fillStyle = '#000'
    tctx.fillRect(0, 0, W, H)

    // Blob radius — ~7% of the shorter edge feels right for typical datasets.
    // Increase for sparser data; decrease for very dense/high-sample-rate data.
    const RADIUS = Math.min(W, H) * 0.07

    // Additive compositing: overlapping blobs accumulate intensity naturally.
    tctx.globalCompositeOperation = 'lighter'

    for (const [x, y] of gazePoints) {
      const px = x * W
      const py = y * H

      // Radial gradient: full-white centre fading to transparent at edge.
      // The 0.25 alpha cap prevents a single point from saturating.
      const grad = tctx.createRadialGradient(px, py, 0, px, py, RADIUS)
      grad.addColorStop(0,    'rgba(255,255,255,0.25)')
      grad.addColorStop(0.45, 'rgba(255,255,255,0.08)')
      grad.addColorStop(1,    'rgba(0,0,0,0)')

      tctx.fillStyle = grad
      tctx.beginPath()
      tctx.arc(px, py, RADIUS, 0, Math.PI * 2)
      tctx.fill()
    }

    // ── Pass 2: read pixels, normalise, apply colormap ────────────────────────
    const raw = tctx.getImageData(0, 0, W, H)
    const src = raw.data  // RGBA — since we drew white, R=G=B, only read R

    // Find peak intensity for normalization
    let maxVal = 0
    for (let i = 0; i < src.length; i += 4) {
      if (src[i] > maxVal) maxVal = src[i]
    }

    if (maxVal === 0) {
      ctx.clearRect(0, 0, W, H)
      return
    }

    const out = ctx.createImageData(W, H)
    const dst = out.data

    for (let i = 0; i < src.length; i += 4) {
      // Gamma < 1 spreads colour into mid-density areas (more perceptual range)
      const norm = Math.pow(src[i] / maxVal, 0.55)

      // Threshold below which we leave the pixel fully transparent —
      // this keeps no-data areas clean rather than showing noise tint.
      if (norm < 0.04) {
        dst[i + 3] = 0
        continue
      }

      const { r, g, b, a } = heatColor(norm)
      dst[i]     = r
      dst[i + 1] = g
      dst[i + 2] = b
      dst[i + 3] = Math.round(a * 255)
    }

    ctx.clearRect(0, 0, W, H)
    ctx.putImageData(out, 0, 0)

  }, [gazePoints])

  if (!gazePoints?.length) return <NoData label="No gaze points to display" />

  return (
    <div>
      {/* Stimulus + heatmap overlay */}
      <div style={{
        position: 'relative',
        borderRadius: 8,
        overflow: 'hidden',
        border: '1px solid var(--border)',
        background: '#080c12',
      }}>
        {/* Background stimulus at slightly higher opacity — the heatmap
            canvas uses normal blending so it sits cleanly on top. */}
        {stimulus?.type === 'image' ? (
          <img
            src={stimulus.src}
            alt={stimulus.name}
            style={{ width: '100%', display: 'block', opacity: 0.72 }}
          />
        ) : stimulus?.type === 'code' ? (
          <pre style={{
            margin: 0,
            background: '#0b0e14',
            color: '#8895b3',
            fontFamily: 'var(--mono)',
            fontSize: 11,
            lineHeight: 1.5,
            padding: 16,
            opacity: 0.6,
            maxHeight: 480,
            overflow: 'hidden',
          }}>
            {stimulus.content}
          </pre>
        ) : (
          <div style={{ paddingBottom: '75%', background: '#0b0e14' }} />
        )}

        {/* Heatmap layer — normal blend, alpha handled per-pixel in Pass 2 */}
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            // 'normal' blending — we already embedded correct alpha in Pass 2.
            // Do NOT use 'screen': it washes out colours on the dark background.
            mixBlendMode: 'normal',
          }}
        />

        {/* Gaze-point count badge */}
        <div style={{
          position: 'absolute',
          bottom: 10,
          right: 12,
          fontSize: 10,
          fontFamily: 'var(--mono)',
          color: 'rgba(255,255,255,0.75)',
          background: 'rgba(8,10,15,0.8)',
          padding: '2px 8px',
          borderRadius: 4,
          backdropFilter: 'blur(4px)',
        }}>
          {gazePoints.length.toLocaleString()} gaze points
        </div>
      </div>

      {/* Colour-scale legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>Low</span>
        <div style={{
          flex: 1,
          height: 10,
          borderRadius: 5,
          border: '1px solid var(--border)',
          background: [
            'linear-gradient(to right,',
            'rgba(30,80,200,0.3) 0%,',
            'rgba(0,200,220,0.55) 25%,',
            'rgba(57,217,138,0.7) 50%,',
            'rgba(251,191,36,0.85) 75%,',
            'rgba(248,113,113,1) 100%)',
          ].join(' '),
        }} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>High</span>
      </div>

      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.6 }}>
        Smooth Gaussian density map from {gazePoints.length.toLocaleString()} gaze points.
        Each point casts a soft radial gradient; overlapping areas accumulate brighter intensity.
        Warm colours (yellow → red) mark regions of highest fixation density.
      </p>
    </div>
  )
}

// ── Scanpath ──────────────────────────────────────────────────────────────────
function ScanpathView({ gazePoints, stimulus }) {
  const stops = useMemo(() => buildScanpath(gazePoints || []), [gazePoints])
  if (!stops.length) return <NoData label="No scanpath data" />

  const maxDwell = Math.max(...stops.map(s => s.dwell), 1)

  return (
    <div>
      <SvgOverlay stimulus={stimulus}>
        {stops.map((stop, i) => {
          if (i === 0) return null
          const prev = stops[i - 1]
          const t = i / stops.length
          return (
            <line
              key={`l${i}`}
              x1={prev.x} y1={prev.y * 0.75}
              x2={stop.x} y2={stop.y * 0.75}
              stroke={`rgba(57,217,138,${0.25 + t * 0.5})`}
              strokeWidth={0.003}
            />
          )
        })}
        {stops.map((stop, i) => {
          const r = 0.012 + (stop.dwell / maxDwell) * 0.018
          const isFirst = i === 0
          const isLast  = i === stops.length - 1
          return (
            <g key={`s${i}`}>
              <circle
                cx={stop.x} cy={stop.y * 0.75}
                r={r}
                fill={isFirst ? '#60a5fa' : isLast ? '#f87171' : 'rgba(57,217,138,0.85)'}
                stroke="#080a0f"
                strokeWidth={0.003}
              />
              <text
                x={stop.x} y={stop.y * 0.75 + 0.005}
                fontSize={0.018}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#080a0f"
                fontWeight="bold"
                fontFamily="monospace"
              >
                {i + 1}
              </text>
            </g>
          )
        })}
      </SvgOverlay>

      <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
        {[
          { color: '#60a5fa', label: 'First fixation' },
          { color: '#39d98a', label: 'Intermediate' },
          { color: '#f87171', label: 'Last fixation' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block' }} />
            {label}
          </div>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>
          {stops.length} stops · circle size = dwell time
        </span>
      </div>
    </div>
  )
}

// ── Fixation View ─────────────────────────────────────────────────────────────
function FixationView({ gazePoints, gazSummary, stimulus }) {
  const fixations = useMemo(() => buildFixationPoints(gazePoints || []), [gazePoints])
  if (!fixations.length) return <NoData label="No fixation data" />

  return (
    <div>
      <SvgOverlay stimulus={stimulus}>
        {fixations.map((f) => {
          const r = 0.008 + f.normDwell * 0.028
          const opacity = 0.45 + f.normDwell * 0.55
          return (
            <g key={f.id}>
              <circle
                cx={f.x} cy={f.y * 0.75}
                r={r}
                fill={`rgba(251,191,36,${opacity})`}
                stroke="rgba(251,191,36,0.4)"
                strokeWidth={0.002}
              />
              {r > 0.018 && (
                <text
                  x={f.x} y={f.y * 0.75 + 0.005}
                  fontSize={0.014}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#080a0f"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  {f.id}
                </text>
              )}
            </g>
          )
        })}
      </SvgOverlay>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 16 }}>
        <StatMini label="Total Fixations"  value={gazSummary?.fixation_count ?? fixations.length} />
        <StatMini label="Avg Duration"     value={gazSummary?.avg_fixation_duration_sec != null ? `${gazSummary.avg_fixation_duration_sec}s` : '—'} />
        <StatMini label="Plotted Stops"    value={fixations.length} />
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>
        Circle size represents relative dwell time. Larger circles indicate longer fixation durations.
      </p>
    </div>
  )
}

// ── AOI View ──────────────────────────────────────────────────────────────────
function AOIView({ gazePoints, stimulus }) {
  const [aois, setAois] = useState(null)

  useEffect(() => {
    setAois(buildDefaultAOIs(gazePoints || []))
  }, [gazePoints])

  if (!aois) return <NoData label="No AOI data" />

  const totalFix = aois.reduce((s, a) => s + a.fixationCount, 0)

  return (
    <div>
      <SvgOverlay stimulus={stimulus} viewW={1} viewH={0.75}>
        {aois.map((aoi) => (
          <g key={aoi.id}>
            <rect
              x={aoi.x} y={aoi.y * 0.75}
              width={aoi.w} height={aoi.h * 0.75}
              fill={`${aoi.color}18`}
              stroke={aoi.color}
              strokeWidth={0.004}
              strokeDasharray="0.015 0.008"
            />
            <text
              x={aoi.x + aoi.w / 2}
              y={aoi.y * 0.75 + (aoi.h * 0.75) / 2}
              fontSize={0.025}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={aoi.color}
              fontFamily="monospace"
              fontWeight="bold"
            >
              AOI {aoi.id}
            </text>
            <text
              x={aoi.x + aoi.w / 2}
              y={aoi.y * 0.75 + (aoi.h * 0.75) / 2 + 0.03}
              fontSize={0.016}
              textAnchor="middle"
              fill={aoi.color}
              fontFamily="monospace"
              opacity={0.75}
            >
              {aoi.fixationCount} fix
            </text>
          </g>
        ))}
      </SvgOverlay>

      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--accent)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
          AOI Metrics
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[...aois].sort((a, b) => b.fixationCount - a.fixationCount).map((aoi) => {
            const pct = totalFix > 0 ? Math.round((aoi.fixationCount / totalFix) * 100) : 0
            return (
              <div key={aoi.id} style={{
                background: 'var(--surface2)',
                border: `1px solid ${aoi.color}40`,
                borderRadius: 8,
                padding: '12px 14px',
                display: 'grid',
                gridTemplateColumns: '1fr auto auto auto',
                alignItems: 'center',
                gap: 16,
              }}>
                <div>
                  <span style={{ color: aoi.color, fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600 }}>
                    AOI {aoi.id}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 12, marginLeft: 10 }}>{aoi.name}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--text)' }}>{aoi.fixationCount}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }}>fix</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--text)' }}>{aoi.totalTime}s</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }}>time</span>
                </div>
                <div style={{ minWidth: 80 }}>
                  <div style={{ height: 4, background: 'var(--surface)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: aoi.color, borderRadius: 2 }} />
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--mono)', marginTop: 3 }}>{pct}%</div>
                </div>
              </div>
            )
          })}
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 12 }}>
          AOIs are auto-generated as screen quadrants. Custom AOI drawing coming in a future update.
        </p>
      </div>
    </div>
  )
}

// ── Summary View ──────────────────────────────────────────────────────────────
function SummaryView({ gazSummary, gazePoints, sessionName }) {
  const aois     = useMemo(() => buildDefaultAOIs(gazePoints || []),   [gazePoints])
  const scanpath = useMemo(() => buildScanpath(gazePoints || []),       [gazePoints])
  const lines    = useMemo(() => generateSummary(gazSummary, aois, scanpath), [gazSummary, aois, scanpath])

  if (!gazSummary) return <NoData label="Upload a CSV first to generate a summary" />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{
        background: 'var(--accent-glow)',
        border: '1px solid var(--accent-dim)',
        borderRadius: 8,
        padding: '14px 16px',
      }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--accent)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
          Plain-English Analysis · {sessionName}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {lines.map((line, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{
                background: 'var(--accent)',
                color: '#080a0f',
                borderRadius: '50%',
                width: 20,
                height: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontWeight: 700,
                flexShrink: 0,
                marginTop: 2,
              }}>{i + 1}</span>
              <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.7, margin: 0 }}>{line}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        {[
          { label: 'Recording Duration', value: gazSummary.duration_sec         != null ? `${gazSummary.duration_sec}s`                 : '—' },
          { label: 'Sample Rate',        value: gazSummary.sample_rate_hz        != null ? `~${gazSummary.sample_rate_hz} Hz`            : '—' },
          { label: 'Total Fixations',    value: gazSummary.fixation_count        ?? '—' },
          { label: 'Avg Fixation',       value: gazSummary.avg_fixation_duration_sec != null ? `${gazSummary.avg_fixation_duration_sec}s` : '—' },
          { label: 'Blinks',             value: gazSummary.blink_count           ?? '—' },
          { label: 'Gaze Points',        value: gazePoints?.length ? gazePoints.length.toLocaleString() : '—' },
        ].map(({ label, value }) => (
          <div key={label} style={{
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '12px 14px',
          }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 18, fontWeight: 600, fontFamily: 'var(--mono)', color: 'var(--text)' }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'heatmap',  label: 'Heatmap'  },
  { id: 'scanpath', label: 'Scanpath' },
  { id: 'fixation', label: 'Fixation' },
  { id: 'aoi',      label: 'AOI'      },
  { id: 'summary',  label: 'Summary'  },
]

export default function AnalysisView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [session,      setSession]      = useState(null)
  const [notFound,     setNotFound]     = useState(false)
  const [gazSummary,   setGazSummary]   = useState(null)
  const [activeTab,    setActiveTab]    = useState('heatmap')
  const [stimuli,      setStimuli]      = useState([])
  const [activeStimIdx, setActiveStimIdx] = useState(0)

  useEffect(() => {
    const s = getSessionById(id)
    if (s) {
      setSession(s)
      setStimuli(getStimuliForSession(id))
      const gaz = getGazSummary(id)
      if (gaz) setGazSummary(gaz)
    } else {
      setNotFound(true)
    }
  }, [id])

  const gazePoints    = gazSummary?.gaze_points ?? []
  const activeStimulus = stimuli[activeStimIdx] ?? null

  if (notFound) return (
    <div className="layout">
      <header className="topbar">
        <div className="topbar-dot" />
        <span className="topbar-title">EyeTrack Research</span>
      </header>
      <main className="page">
        <div className="empty-state">
          <div className="empty-icon">!</div>
          <div className="empty-title">Session not found</div>
          <button className="btn btn-primary" onClick={() => navigate('/')}>Back to Dashboard</button>
        </div>
      </main>
    </div>
  )

  if (!session) return null

  const hasData = gazePoints.length > 0

  return (
    <div className="layout">
      <header className="topbar">
        <div className="topbar-dot" />
        <span className="topbar-title">EyeTrack Research</span>
        <span className="topbar-subtitle">/ {session.session_id} / analysis</span>
      </header>

      <main className="page">
        <button className="back-link" onClick={() => navigate(`/sessions/${id}`)}>
          ← Back to session
        </button>

        <div className="page-header">
          <div>
            <div className="page-eyebrow">Phase 5 · Visualization</div>
            <h1 className="page-title">{session.task_name}</h1>
            <p className="page-subtitle">
              {session.participant_name}
              <span style={{ color: 'var(--text-muted)', margin: '0 8px' }}>|</span>
              {format(new Date(session.date), 'MMMM d, yyyy')}
            </p>
          </div>

          {stimuli.length > 1 && (
            <div style={{ display: 'flex', gap: 6 }}>
              {stimuli.map((s, i) => (
                <button
                  key={s.stimulus_id}
                  className={`btn ${activeStimIdx === i ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ fontSize: 11, padding: '6px 12px' }}
                  onClick={() => setActiveStimIdx(i)}
                >
                  {s.name.length > 18 ? s.name.slice(0, 16) + '…' : s.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {!hasData && (
          <div style={{
            background: 'rgba(251,191,36,0.08)',
            border: '1px solid rgba(251,191,36,0.25)',
            borderRadius: 8,
            padding: '14px 16px',
            fontSize: 13,
            color: 'var(--amber)',
            marginBottom: 24,
          }}>
            ⚠ No gaze data found for this session. Return to the session page and upload a GP3HD CSV to enable visualizations.
          </div>
        )}

        <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />

        <div style={{ animation: 'fadeUp 0.2s ease both' }} key={activeTab}>
          {activeTab === 'heatmap'  && <HeatmapView  gazePoints={gazePoints} stimulus={activeStimulus} />}
          {activeTab === 'scanpath' && <ScanpathView gazePoints={gazePoints} stimulus={activeStimulus} />}
          {activeTab === 'fixation' && <FixationView gazePoints={gazePoints} gazSummary={gazSummary} stimulus={activeStimulus} />}
          {activeTab === 'aoi'      && <AOIView      gazePoints={gazePoints} stimulus={activeStimulus} />}
          {activeTab === 'summary'  && <SummaryView  gazSummary={gazSummary} gazePoints={gazePoints} sessionName={session.task_name} />}
        </div>
      </main>
    </div>
  )
}
