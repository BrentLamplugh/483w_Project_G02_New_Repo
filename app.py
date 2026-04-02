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

    time_col = _detect(headers, ["TIME", "Time", "time", "Timestamp", "timestamp"])
    fpogx_col = _detect(headers, ["FPOGX", "fpogx", "GazeX", "gaze_x", "x"])
    fpogy_col = _detect(headers, ["FPOGY", "fpogy", "GazeY", "gaze_y", "y"])
    fpogv_col = _detect(headers, ["FPOGV", "fpogv", "FixationValid", "fixation_valid"])
    fpogd_col = _detect(headers, ["FPOGD", "fpogd", "FixationDuration", "fixation_duration"])
    fpogid_col = _detect(headers, ["FPOGID", "fpogid", "FixationID", "fixation_id"])
    bkid_col = _detect(headers, ["BKID", "bkid", "BlinkID", "blink_id"])
    bkdur_col = _detect(headers, ["BKDUR", "bkdur", "BlinkDuration", "blink_duration"])
    lpmm_col = _detect(headers, ["LPMM", "lpmm", "LeftPupilDiameter", "left_pupil"])
    rpmm_col = _detect(headers, ["RPMM", "rpmm", "RightPupilDiameter", "right_pupil"])

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

    preview_rows = rows[:8]

    detected_cols = {
        "time": time_col,
        "fpogx": fpogx_col,
        "fpogy": fpogy_col,
        "fpogv": fpogv_col,
        "fpogd": fpogd_col,
        "fpogid": fpogid_col,
        "bkid": bkid_col,
        "bkdur": bkdur_col,
        "lpmm": lpmm_col,
        "rpmm": rpmm_col,
    }

    return jsonify(
        {
            "row_count": len(rows),
            "column_count": len(headers),
            "headers": headers,
            "detected_cols": detected_cols,
            "duration_sec": duration_sec,
            "sample_rate_hz": sample_rate_hz,
            "fixation_count": fixation_count,
            "avg_fixation_duration_sec": avg_fixation_duration,
            "blink_count": blink_count,
            "avg_blink_duration_sec": avg_blink_duration,
            "avg_pupil_left_mm": avg_pupil_left,
            "avg_pupil_right_mm": avg_pupil_right,
            "gaze_points": gaze_points,
            "preview_rows": preview_rows,
            "heatmap": [],
            "scanpath": [],
            "fixation_map": [],
        }
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
