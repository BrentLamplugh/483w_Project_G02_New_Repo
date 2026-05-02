# GazeScope

GazeScope is a local-first eye-tracking analysis tool for managing research sessions, presenting stimuli, importing GP3HD CSV exports, calculating gaze metrics, and generating visual outputs. The React frontend talks to a Flask backend on `http://127.0.0.1:5000`.

## What works

- Session creation/listing with auto IDs and metadata.
- Stimulus upload and viewing for images or code.
- GP3HD CSV upload and parsing through the Flask backend.
- Automatic column detection for common gaze, fixation, blink, pupil, timestamp, and media/stimulus fields.
- Basic gaze metrics including row count, session duration, approximate sample rate, fixation count, average fixation duration, blink count, average blink duration, and pupil averages.
- Per-stimulus analysis when the CSV includes a media/stimulus column.
- Heatmap visualization showing gaze density over the stimulus.
- Scanpath visualization showing the order of eye movement through fixation stops.
- Fixation view showing fixation points, with larger points representing longer dwell time.
- Basic AOI view using four automatically generated screen quadrants with fixation count and estimated time per quadrant.
- Plain-English summary of gaze behavior.
- PNG export for heatmap, scanpath, fixation, and AOI views.

## Project layout

```text
eyetracker frontend/    # React + Vite app
eyetracker_backend/     # older parsing prototype and future-work notes
app.py                  # Flask API for CSV upload and parsing
package-lock.json       # legacy stub
```

## Prerequisites

- Node 18+ and npm
- Python 3.10+ with `pip`

## Run the backend

```powershell
cd C:\Users\charl\Downloads\483w_Project_G02\483w_Project_G02_New_Repo
python -m pip install -r requirements.txt
python app.py
```

Backend serves at `http://127.0.0.1:5000`. Keep this terminal open while using the frontend.

## Run the frontend

```powershell
cd "C:\Users\charl\Downloads\483w_Project_G02\483w_Project_G02_New_Repo\eyetracker frontend"
npm install
npm run dev
```

Open the printed Vite URL, typically `http://localhost:5173`.

## Usage flow

1. Dashboard: create a new session.
2. Session page: open the viewer to add or view image/code stimuli.
3. Export a CSV from GP3HD software and upload it on the session page.
4. Open the analysis page to view heatmap, scanpath, fixation, AOI, and summary tabs.
5. Export visualization views as PNG files when needed.

## Data storage

- Sessions, stimuli, and parsed CSV summaries are stored in browser `localStorage`.
- Data is per-browser and is not shared across devices.
- Clearing `localStorage` removes saved sessions, stimuli, and analysis summaries.

## API

- `POST /upload` - multipart form field `file` (`.csv`). Returns JSON with metrics, detected columns, preview rows, gaze points, heatmap data, scanpath data, fixation map data, summary text, and per-stimulus results when available.

## Visualization notes

- Heatmaps use gaze-point density to show areas with higher visual attention.
- Scanpaths group gaze points into fixation stops and connect them in sequence.
- Fixation view uses point size to represent relative dwell time.
- AOI view uses four automatic screen quadrants to compare fixation activity across the stimulus.

## Project scope

This version of GazeScope was completed as the semester project analysis tool. Data is stored in a Firebase database, and AOI analysis is limited to automatic quadrant-based regions rather than custom researcher-drawn areas.
