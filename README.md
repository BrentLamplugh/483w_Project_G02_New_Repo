# GP3HD EyeTracker MVP

Local-first prototype to manage sessions, present stimuli (images/code), import GP3HD CSV exports, and preview parsed stats. Frontend (Vite/React) talks to a minimal Flask backend on `http://127.0.0.1:5000`.

## What works
- Phase 1: session creation/listing with auto IDs and metadata (stored in browser localStorage).
- Phase 2: stimulus upload/viewer (images or code). Dedicated viewer page plus inline preview on the session page.
- Phase 3: CSV upload to backend; CSV is parsed and stats/preview rows are shown in the session page.
- Basic gaze stats returned: rows, duration, sample rate (approx), fixation/blink counts, pupil averages, detected columns, sampled gaze points, preview rows.

Not yet implemented: Phase 4+ (heatmap, scanpath, AOI metrics, layman summary); backend returns placeholders for those.

## Project layout
```
eyetracker frontend/    # React + Vite app
eyetracker_backend/     # scratch notes (not used in runtime)
app.py                  # Flask API (CSV upload/parse)
package-lock.json       # legacy stub
```

## Prerequisites
- Node 18+ and npm
- Python 3.10+ with `pip`

## Run the backend (Flask)
```powershell
cd C:\Users\charl\Downloads\483w_Project_G02\483w_Project_G02_New_Repo
python -m pip install flask
python app.py
```
Backend serves at `http://127.0.0.1:5000` (CORS enabled for the Vite dev server). Keep this terminal open.

## Run the frontend (Vite/React)
```powershell
cd "C:\Users\charl\Downloads\483w_Project_G02\483w_Project_G02_New_Repo\eyetracker frontend"
npm install
npm run dev
```
Open the printed URL (typically `http://localhost:5173`).

## Usage flow
1. Dashboard → create a new session.
2. Session page: click **Open Viewer** to add/view stimuli (image or code). An inline preview of the latest stimulus also appears on the session page.
3. Export CSV from GP3HD software, then upload it in the session page. Parsed stats and preview rows show below the upload section.

## Data storage (current MVP)
- Sessions, stimuli, and parsed CSV summaries are stored in browser `localStorage` — per-browser and not shared.
- Clearing `localStorage` removes all data. Future phases should persist to a real database/API.

## API
- `POST /upload` — multipart form field `file` (.csv). Returns JSON with stats, detected columns, gaze point sample, and preview rows.

## Known gaps / next steps
- Implement heatmap/scanpath/AOI calculations and return them from the backend.
- Persist sessions/stimuli/summaries to a database instead of `localStorage`.
- Add full-screen participant display mode and stimulus open/close logging.
- Align gaze data to specific stimuli (needs stimulus metadata + timestamps).

