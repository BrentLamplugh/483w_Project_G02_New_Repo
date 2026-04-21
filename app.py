import csv
import io
from flask import Flask, jsonify, request

app = Flask(__name__)


@app.after_request
def add_cors_headers(resp):
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
    resp.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    return resp


@app.route("/")
def home():
    return "EyeTracker backend running"


def _detect(headers, candidates):
    return next((c for c in candidates if c in headers), None)


def _to_float(val):
    try:
        f = float(val)
        return f
    except Exception:  # noqa: BLE001
        return None


def _compute_stats(rows, time_col, fpogx_col, fpogy_col, fpogv_col,
                   fpogd_col, fpogid_col, bkid_col, bkdur_col, lpmm_col, rpmm_col):
    """Compute all gaze stats and visualizations for a list of rows."""

    # duration and sample rate
    duration_sec = None
    if time_col:
        times = [_to_float(r[time_col]) for r in rows if r.get(time_col)]
        times = [t for t in times if t is not None]
        if len(times) >= 2:
            duration_sec = round(max(times) - min(times), 3)

    sample_rate_hz = None
    if duration_sec and duration_sec > 0:
        sample_rate_hz = int(round(len(rows) / duration_sec))

    # fixations
    fixation_ids = set()
    fixation_durs = []
    if fpogid_col:
        for r in rows:
            valid = True
            if fpogv_col:
                valid = r.get(fpogv_col) == "1"
            if not valid:
                continue
            fid = r.get(fpogid_col)
            if fid and fid not in ("0", ""):
                fixation_ids.add(fid)
                if fpogd_col:
                    d = _to_float(r.get(fpogd_col))
                    if d and d > 0:
                        fixation_durs.append(d)
    fixation_count = len(fixation_ids)
    avg_fixation_duration = round(sum(fixation_durs) / len(fixation_durs), 4) if fixation_durs else None

    # blinks
    blink_ids = set()
    blink_durs = []
    if bkid_col:
        for r in rows:
            bid = r.get(bkid_col)
            if bid and bid not in ("0", ""):
                blink_ids.add(bid)
                if bkdur_col:
                    bd = _to_float(r.get(bkdur_col))
                    if bd and bd > 0:
                        blink_durs.append(bd)
    blink_count = len(blink_ids)
    avg_blink_duration = round(sum(blink_durs) / len(blink_durs), 4) if blink_durs else None

    # pupil
    avg_pupil_left = None
    if lpmm_col:
        vals = [_to_float(r.get(lpmm_col)) for r in rows if r.get(lpmm_col)]
        vals = [v for v in vals if v and v > 0]
        if vals:
            avg_pupil_left = round(sum(vals) / len(vals), 3)
    avg_pupil_right = None
    if rpmm_col:
        vals = [_to_float(r.get(rpmm_col)) for r in rows if r.get(rpmm_col)]
        vals = [v for v in vals if v and v > 0]
        if vals:
            avg_pupil_right = round(sum(vals) / len(vals), 3)

    # gaze points
    gaze_points = []
    if fpogx_col and fpogy_col:
        for r in rows:
            valid = True
            if fpogv_col:
                valid = r.get(fpogv_col) == "1"
            if not valid:
                continue
            x = _to_float(r.get(fpogx_col))
            y = _to_float(r.get(fpogy_col))
            if x is None or y is None:
                continue
            gaze_points.append([round(x, 4), round(y, 4)])
        max_pts = 2000
        if len(gaze_points) > max_pts:
            step = max(1, len(gaze_points) // max_pts)
            gaze_points = gaze_points[::step]

    # heatmap density grid
    heatmap_data = []
    if gaze_points:
        GRID_W, GRID_H = 40, 30
        grid = [[0] * GRID_W for _ in range(GRID_H)]
        max_cell = 0
        for x, y in gaze_points:
            col_i = min(GRID_W - 1, int(x * GRID_W))
            row_i = min(GRID_H - 1, int(y * GRID_H))
            if 0 <= col_i < GRID_W and 0 <= row_i < GRID_H:
                grid[row_i][col_i] += 1
                if grid[row_i][col_i] > max_cell:
                    max_cell = grid[row_i][col_i]
        if max_cell > 0:
            for ri in range(GRID_H):
                for ci in range(GRID_W):
                    if grid[ri][ci] > 0:
                        heatmap_data.append({
                            "x": round((ci + 0.5) / GRID_W, 4),
                            "y": round((ri + 0.5) / GRID_H, 4),
                            "weight": round(grid[ri][ci] / max_cell, 4),
                        })

    # scanpath
    scanpath_data = []
    if gaze_points:
        RADIUS = 0.04
        cluster = [gaze_points[0]]
        raw_stops = []
        for pt in gaze_points[1:]:
            px, py = cluster[-1]
            cx, cy = pt
            dist = ((cx - px) ** 2 + (cy - py) ** 2) ** 0.5
            if dist < RADIUS:
                cluster.append(pt)
            else:
                mx = sum(p[0] for p in cluster) / len(cluster)
                my = sum(p[1] for p in cluster) / len(cluster)
                raw_stops.append({"x": round(mx, 4), "y": round(my, 4), "dwell": len(cluster)})
                cluster = [pt]
        if cluster:
            mx = sum(p[0] for p in cluster) / len(cluster)
            my = sum(p[1] for p in cluster) / len(cluster)
            raw_stops.append({"x": round(mx, 4), "y": round(my, 4), "dwell": len(cluster)})
        if len(raw_stops) > 50:
            step = max(1, len(raw_stops) // 50)
            raw_stops = raw_stops[::step][:50]
        scanpath_data = [{"seq": i + 1, **s} for i, s in enumerate(raw_stops)]

    # fixation map
    fixation_map_data = []
    if fpogid_col and fpogx_col and fpogy_col:
        seen_fids = {}
        for r in rows:
            valid = True
            if fpogv_col:
                valid = r.get(fpogv_col) == "1"
            if not valid:
                continue
            fid = r.get(fpogid_col)
            if not fid or fid in ("0", ""):
                continue
            if fid not in seen_fids:
                fx = _to_float(r.get(fpogx_col))
                fy = _to_float(r.get(fpogy_col))
                fd = _to_float(r.get(fpogd_col)) if fpogd_col else None
                if fx is not None and fy is not None:
                    seen_fids[fid] = {
                        "id": len(seen_fids) + 1,
                        "x": round(fx, 4),
                        "y": round(fy, 4),
                        "duration": round(fd, 4) if fd else None,
                    }
        fixation_map_data = list(seen_fids.values())

    # plain-English summary
    summary_lines = []
    if fixation_count is not None:
        if fixation_count < 20:
            summary_lines.append(
                f"The participant made {fixation_count} fixations — a low count suggesting rapid scanning behaviour."
            )
        elif fixation_count < 80:
            summary_lines.append(
                f"The participant made {fixation_count} fixations, indicating moderate engagement with the stimulus."
            )
        else:
            summary_lines.append(
                f"The participant made {fixation_count} fixations, suggesting thorough and detailed processing of the stimulus."
            )

    if avg_fixation_duration is not None:
        if avg_fixation_duration < 0.15:
            summary_lines.append(
                "Short average fixation durations suggest rapid, automatic recognition of content."
            )
        elif avg_fixation_duration < 0.3:
            summary_lines.append(
                f"Average fixation duration ({avg_fixation_duration}s) falls within the typical reading range."
            )
        else:
            summary_lines.append(
                f"Longer-than-average fixation durations ({avg_fixation_duration}s) suggest this content required more effort to process."
            )

    if gaze_points:
        cx = sum(p[0] for p in gaze_points) / len(gaze_points)
        cy = sum(p[1] for p in gaze_points) / len(gaze_points)
        h_label = "left side" if cx < 0.4 else "right side" if cx > 0.6 else "centre"
        v_label = "top" if cy < 0.4 else "bottom" if cy > 0.6 else "middle"
        summary_lines.append(
            f"The participant focused mostly on the {v_label} {h_label} of the image."
        )

        quadrants = {"top-left": 0, "top-right": 0, "bottom-left": 0, "bottom-right": 0}
        for x, y in gaze_points:
            h = "left" if x < 0.5 else "right"
            v = "top" if y < 0.5 else "bottom"
            quadrants[f"{v}-{h}"] += 1
        top_quad = max(quadrants, key=quadrants.get)
        top_pct = round(quadrants[top_quad] / len(gaze_points) * 100)
        if top_pct >= 35:
            summary_lines.append(
                f"Most fixations occurred in the {top_quad} quadrant ({top_pct}% of all gaze points)."
            )

    if blink_count is not None and duration_sec and duration_sec > 0:
        bpm = blink_count / (duration_sec / 60)
        if bpm > 20:
            summary_lines.append(
                f"An elevated blink rate ({blink_count} blinks) may indicate fatigue or cognitive load."
            )
        elif blink_count > 0:
            summary_lines.append(
                f"Blink count ({blink_count}) appears within a normal range for the session duration."
            )

    if avg_pupil_left and avg_pupil_right:
        avg_pupil = round((avg_pupil_left + avg_pupil_right) / 2, 2)
        if avg_pupil > 5.0:
            summary_lines.append(
                f"Average pupil diameter ({avg_pupil}mm) suggests elevated arousal or cognitive load."
            )
        else:
            summary_lines.append(
                f"Pupil diameter ({avg_pupil}mm average) is within a normal resting range."
            )

    if scanpath_data:
        n_stops = len(scanpath_data)
        if n_stops > 20:
            summary_lines.append(
                "The scanpath shows extensive back-and-forth movement, indicating re-reading or processing difficulty."
            )
        elif n_stops > 10:
            summary_lines.append(
                "The scanpath shows a moderately complex reading pattern with some re-visits to prior regions."
            )
        else:
            summary_lines.append(
                "The scanpath is compact and relatively linear, suggesting efficient top-down processing."
            )

    return {
        "row_count": len(rows),
        "duration_sec": duration_sec,
        "sample_rate_hz": sample_rate_hz,
        "fixation_count": fixation_count,
        "avg_fixation_duration_sec": avg_fixation_duration,
        "blink_count": blink_count,
        "avg_blink_duration_sec": avg_blink_duration,
        "avg_pupil_left_mm": avg_pupil_left,
        "avg_pupil_right_mm": avg_pupil_right,
        "gaze_points": gaze_points,
        "heatmap": heatmap_data,
        "scanpath": scanpath_data,
        "fixation_map": fixation_map_data,
        "summary": summary_lines,
    }


@app.route("/upload", methods=["POST", "OPTIONS"])
def upload():
    if request.method == "OPTIONS":
        return ("", 204)

    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    raw = request.files["file"].read()
    text = raw.decode("utf-8", errors="ignore")
    reader = csv.reader(io.StringIO(text))

    rows = []
    headers = []
    for row in reader:
        if not headers:
            if any(cell.strip() for cell in row):
                headers = [h.strip() for h in row]
            continue
        if not any(cell.strip() for cell in row):
            continue
        rows.append({headers[i]: row[i].strip() if i < len(row) else "" for i in range(len(headers))})

    if not headers:
        return jsonify({"error": "CSV appears empty or has no header"}), 400
    if not rows:
        return jsonify({"error": "CSV has a header but no data rows"}), 400

    # Detect gaze columns
    time_col   = _detect(headers, ["TIME", "Time", "time", "Timestamp", "timestamp"])
    fpogx_col  = _detect(headers, ["FPOGX", "fpogx", "GazeX", "gaze_x", "x"])
    fpogy_col  = _detect(headers, ["FPOGY", "fpogy", "GazeY", "gaze_y", "y"])
    fpogv_col  = _detect(headers, ["FPOGV", "fpogv", "FixationValid", "fixation_valid"])
    fpogd_col  = _detect(headers, ["FPOGD", "fpogd", "FixationDuration", "fixation_duration"])
    fpogid_col = _detect(headers, ["FPOGID", "fpogid", "FixationID", "fixation_id"])
    bkid_col   = _detect(headers, ["BKID", "bkid", "BlinkID", "blink_id"])
    bkdur_col  = _detect(headers, ["BKDUR", "bkdur", "BlinkDuration", "blink_duration"])
    lpmm_col   = _detect(headers, ["LPMM", "lpmm", "LeftPupilDiameter", "left_pupil"])
    rpmm_col   = _detect(headers, ["RPMM", "rpmm", "RightPupilDiameter", "right_pupil"])

    # Detect media/stimulus column (GP3HD exports MEDIA_NAME or MEDIA_ID per row)
    media_name_col = _detect(headers, ["MEDIA_NAME", "media_name", "StimulusName", "stimulus_name", "Stimulus", "stimulus"])
    media_id_col   = _detect(headers, ["MEDIA_ID",   "media_id",   "StimulusID",   "stimulus_id"])
    # Prefer name over ID; either is fine for grouping
    media_col = media_name_col or media_id_col

    detected_cols = {
        "time": time_col, "fpogx": fpogx_col, "fpogy": fpogy_col,
        "fpogv": fpogv_col, "fpogd": fpogd_col, "fpogid": fpogid_col,
        "bkid": bkid_col, "bkdur": bkdur_col,
        "lpmm": lpmm_col, "rpmm": rpmm_col,
        "media": media_col,
    }

    col_args = (time_col, fpogx_col, fpogy_col, fpogv_col,
                fpogd_col, fpogid_col, bkid_col, bkdur_col, lpmm_col, rpmm_col)

    # Global stats (whole CSV, for backward compat and sessions with no media column)
    global_stats = _compute_stats(rows, *col_args)

    # Per-stimulus stats — only when media column is present
    media_names = []
    per_stimulus_data = {}
    if media_col:
        # Preserve insertion order so sequence matches GP3HD presentation order
        seen = {}
        for r in rows:
            name = r.get(media_col, "").strip()
            if name and name not in seen:
                seen[name] = []
            if name:
                seen[name].append(r)
        media_names = list(seen.keys())
        for name, media_rows in seen.items():
            per_stimulus_data[name] = _compute_stats(media_rows, *col_args)

    preview_rows = rows[:8]

    return jsonify({
        **global_stats,
        "column_count": len(headers),
        "headers": headers,
        "detected_cols": detected_cols,
        "preview_rows": preview_rows,
        "media_names": media_names,
        "per_stimulus_data": per_stimulus_data,
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
