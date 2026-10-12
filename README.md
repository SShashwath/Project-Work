# 🌾 AgriSense — Agricultural Land Suitability & Crop Recommendation API

Full local FastAPI backend for the Coimbatore District agricultural planning project.  
**The notebook is no longer needed.** All steps — from raw data collection to ML inference — run via this backend.

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [Prerequisites](#prerequisites)
3. [Installation](#installation)
4. [Starting the Server](#starting-the-server)
5. [Full Dataset Build Pipeline](#full-dataset-build-pipeline)
   - [Step 1 — Generate Plot Grid](#step-1--generate-plot-grid)
   - [Step 2 — Fetch Terrain via Earth Engine](#step-2--fetch-terrain-via-earth-engine)
   - [Step 3 — Fetch NDVI via Earth Engine](#step-3--fetch-ndvi-via-earth-engine)
   - [Step 4 — Fetch Soil from SoilGrids](#step-4--fetch-soil-from-soilgrids)
   - [Step 5 — Merge, Clean & Validate](#step-5--merge-clean--validate)
   - [Step 6 — Compute Suitability & Label Crops](#step-6--compute-suitability--label-crops)
6. [Train the ML Model](#train-the-ml-model)
7. [Run Predictions](#run-predictions)
8. [All API Endpoints](#all-api-endpoints)
9. [One-Command Quick Run (for returning users)](#one-command-quick-run)
10. [Troubleshooting](#troubleshooting)

---

## Project Structure

```
Project-Work-/
├── TAMIL NADU_DISTRICTS.geojson     ← Required input (already in repo)
│
├── scripts/                          ← Standalone data pipeline scripts
│   ├── build_dataset.py              ← Run ALL steps in one command
│   ├── step01_generate_grid.py       ← Coimbatore grid generation
│   ├── step02_fetch_terrain_ee.py    ← SRTM terrain via Earth Engine
│   ├── step03_fetch_ndvi_ee.py       ← Sentinel-2 NDVI via Earth Engine
│   ├── step04_fetch_soil_soilgrids.py← Soil data via SoilGrids VRT
│   ├── step05_merge_and_validate.py  ← Merge + clean + validate
│   └── step06_suitability_and_label.py← Suitability scores + crop labels
│
├── app/
│   ├── main.py                       ← FastAPI app entry
│   ├── config.py                     ← Paths, crop knowledge base, constants
│   ├── models/schemas.py             ← Pydantic schemas
│   ├── routers/
│   │   ├── data_pipeline.py          ← /data/* — trigger pipeline steps via API
│   │   ├── geo.py                    ← /geo/* — districts & grid
│   │   ├── suitability.py            ← /suitability/* — land scoring
│   │   ├── recommend.py              ← /recommend/* — crop recommendation
│   │   └── train.py                  ← /train/* — model training
│   └── services/
│       ├── geo_service.py            ← GeoJSON + grid clipping
│       ├── suitability.py            ← NDVI/slope/pH/SOC composite scorer
│       ├── agronomy.py               ← Fuzzy membership + quota assignment
│       └── ml_recommender.py         ← RF + XGBoost train + inference
│
├── data/                             ← Auto-created. All generated CSVs go here
├── saved_models/                     ← Auto-created. Trained model saved here
├── run.py                            ← Server entry point
└── requirements.txt
```

---

## Prerequisites

- **Python 3.10+**
- **Google Earth Engine account** with API access  
  → [Sign up free at earthengine.google.com](https://earthengine.google.com/signup/)  
  → Your GEE project ID: `helpful-quanta-505516-m4`
- **Internet connection** for Steps 2, 3 (Earth Engine) and Step 4 (SoilGrids)

---

## Installation

```bash
# 1. Clone / enter the project directory
cd /Users/shashwath/Documents/Project-Work-

# 2. (Recommended) Create a virtual environment
python3 -m venv .venv
source .venv/bin/activate

# 3. Install all dependencies
pip install -r requirements.txt
```

---

## Starting the Server

```bash
python3 run.py
```

- API runs at: **http://localhost:8001**
- Interactive docs (Swagger UI): **http://localhost:8001/docs**
- The server auto-reloads on any Python file change.

> **Note:** You can start the server before building the dataset — the agronomic fuzzy-logic fallback works immediately without a trained ML model.

---

## Full Dataset Build Pipeline

These steps replicate **every notebook cell** locally. Run them once to produce `coimbatore_labeled_suitability.csv`. You never need to touch the notebook again.

### Option A — One command (all 6 steps)

```bash
python3 scripts/build_dataset.py
```

### Option B — Step by step (recommended first time)

---

### Step 1 — Generate Plot Grid
**What it does:** Loads `TAMIL NADU_DISTRICTS.geojson`, extracts Coimbatore boundary, generates a 0.01° (~1 km) spaced grid, clips it to the district polygon.  
**Output:** `data/coimbatore_plot_grid.geojson`, `data/coimbatore_plot_grid.csv`  
**Notebook cells:** 0, 1, 2, 4

```bash
python3 scripts/step01_generate_grid.py
```

Or via API (no auth required):
```bash
curl -X POST http://localhost:8001/data/run-step/1/sync
```

Expected output: `~3725 points after clipping to district boundary`

---

### Step 2 — Fetch Terrain via Earth Engine
**What it does:** Authenticates to Google Earth Engine, samples SRTM elevation, slope, and aspect at every grid point. Uses direct batched `getInfo()` (100 points/batch) — no Google Drive needed.  
**Output:** `data/coimbatore_terrain.csv`  
**Notebook cells:** 6, 7, 8, 10, 12

```bash
python3 scripts/step02_fetch_terrain_ee.py
```

**First time:** A browser tab will open for Google authentication. Sign in with the account that has EE access. The token is cached for future runs.

> ⏱️ Takes ~5-10 minutes for 3725 points (100 batches × ~3 sec each)

---

### Step 3 — Fetch NDVI via Earth Engine
**What it does:** Computes median NDVI from Sentinel-2 imagery (2025-01-01 to 2025-12-31, cloud % < 20). Samples NDVI at all grid points.  
**Output:** `data/coimbatore_ndvi.csv`  
**Notebook cells:** 14, 15, 16

```bash
python3 scripts/step03_fetch_ndvi_ee.py
```

> ⏱️ Takes ~10-15 minutes (Sentinel-2 processing is heavier than SRTM)

---

### Step 4 — Fetch Soil from SoilGrids
**What it does:** Downloads phH2O, SOC, clay, and sand from ISRIC SoilGrids 250m VRT files (public HTTPS). Applies ÷10 unit conversion to match raw SoilGrids encoding.  
**Output:** `data/coimbatore_soil.csv`  
**Notebook cells:** 18, 19

```bash
python3 scripts/step04_fetch_soil_soilgrids.py
```

Requires: `rasterio` and internet access to `files.isric.org`  
> ⏱️ Takes ~3-5 minutes (streams VRT data from ISRIC)

---

### Step 5 — Merge, Clean & Validate
**What it does:** Joins terrain + NDVI + soil CSVs on lon/lat coordinates. Removes NDVI fill values (≤ -1), drops sentinel no-data rows (< -1000). Runs 6 validation checks.  
**Output:** `data/coimbatore_master_dataset.csv`  
**Notebook cells:** 21, 22, 23, 24, 27

```bash
python3 scripts/step05_merge_and_validate.py
```

Expected validation output:
```
1. Shape: ~3725 rows × 10 columns
2. Missing values: NONE ✅
3. Rows with extreme sentinel values: 0 ✅
4. Range sanity: all columns ✅
5. Duplicate lon/lat pairs: 0 ✅
6. Points confirmed inside Coimbatore: ~3725 ✅
```

---

### Step 6 — Compute Suitability & Label Crops
**What it does:**  
- Computes composite suitability score: `NDVI×0.35 + slope×0.25 + pH×0.20 + SOC×0.20`  
- Classifies plots as High / Moderate / Low suitability  
- Runs fuzzy-logic agronomic fit across 10 crops (trapezoidal membership)  
- Applies Hungarian algorithm for district-wide quota assignment  
- Tags each plot with `rule_crop`, `recommended_crop`, gating reason  

**Output:** `data/coimbatore_labeled_suitability.csv` ← **This is the final ML training input**  
**Notebook cells:** 31-38 (Module 2), 40-48 (Module 3 setup)

```bash
python3 scripts/step06_suitability_and_label.py
```

Expected output:
```
Label distribution:
  Coconut      1234
  Sorghum       890
  Banana        456
  ...
Recommendation status:
  recommended        2891
  low suitability     834
  ...
```

---

## Train the ML Model

Once `coimbatore_labeled_suitability.csv` exists, train the RandomForest + XGBoost models:

**Option A — From local file path (fastest):**
```bash
curl -X POST http://localhost:8001/train/run-from-path \
     -F "csv_path=$(pwd)/data/coimbatore_labeled_suitability.csv" \
     -F "preferred_model=RandomForest"
```

**Option B — Upload CSV file:**
```bash
curl -X POST http://localhost:8001/train/run \
     -F "file=@data/coimbatore_labeled_suitability.csv" \
     -F "preferred_model=RandomForest"
```

**Option C — Swagger UI:** Open http://localhost:8001/docs → `POST /train/run`

Training output includes accuracy, macro F1, top-3 accuracy for both models. The best model is saved to `saved_models/`.

---

## Run Predictions

### Single plot:
```bash
curl -X POST http://localhost:8001/recommend/plot \
     -H "Content-Type: application/json" \
     -d '{
       "elevation": 420,
       "slope": 3.2,
       "aspect": 180,
       "ndvi": 0.55,
       "phh2o": 6.3,
       "soc": 180,
       "clay": 28,
       "sand": 42,
       "lat": 10.95,
       "lon": 77.12
     }'
```

Response:
```json
{
  "recommended": true,
  "recommended_crop": "Pulses",
  "suitability_score": 0.6354,
  "suitability_class": "Moderate",
  "agro_fit_top": 0.867,
  "top_recommendations": [
    {"rank": 1, "crop": "Pulses", "probability": 0.42},
    {"rank": 2, "crop": "Sorghum", "probability": 0.38},
    {"rank": 3, "crop": "Coconut", "probability": 0.20}
  ]
}
```

### Batch (up to 5000 plots):
```bash
curl -X POST http://localhost:8001/recommend/batch \
     -H "Content-Type: application/json" \
     -d '{"plots": [...]}'
```

### Suitability only (no ML model needed):
```bash
curl -X POST http://localhost:8001/suitability/evaluate \
     -H "Content-Type: application/json" \
     -d '{"elevation":420,"slope":3.2,"aspect":180,"ndvi":0.55,"phh2o":6.3,"soc":180,"clay":28,"sand":42}'
```

---

## All API Endpoints

| Group | Method | Endpoint | Description |
|-------|--------|----------|-------------|
| **Root** | GET | `/` | Status + endpoint map |
| **Root** | GET | `/health` | Health check |
| **Data Pipeline** | GET | `/data/status` | Which steps are done, which files exist |
| **Data Pipeline** | POST | `/data/run-step/{1-6}` | Trigger a step in background |
| **Data Pipeline** | POST | `/data/run-step/{1-6}/sync` | Run a step and wait for result |
| **Data Pipeline** | GET | `/data/download/{filename}` | Download any generated CSV |
| **Geo** | GET | `/geo/districts` | All Tamil Nadu district names + bounds |
| **Geo** | GET | `/geo/districts/{name}/bounds` | Bounding box for one district |
| **Geo** | POST | `/geo/generate-grid` | Generate plot grid for any district |
| **Suitability** | POST | `/suitability/evaluate` | Score one plot (NDVI/slope/pH/SOC) |
| **Suitability** | POST | `/suitability/batch-evaluate` | Score up to 5000 plots |
| **Recommend** | POST | `/recommend/plot` | Recommend crops for one plot |
| **Recommend** | POST | `/recommend/batch` | Batch recommendations (up to 5000) |
| **Recommend** | GET | `/recommend/agro-fit` | Raw fuzzy fit scores (debug) |
| **Recommend** | GET | `/recommend/crops` | View 10-crop knowledge base |
| **Training** | GET | `/train/status` | Check if model is trained |
| **Training** | POST | `/train/run` | Upload CSV → train models |
| **Training** | POST | `/train/run-from-path` | Train from local CSV path |

Full interactive docs: **http://localhost:8001/docs**

---

## One-Command Quick Run

For returning users (dataset already built):

```bash
# Terminal 1 — start server
python3 run.py

# Terminal 2 — train model (if saved_models/ is empty)
curl -X POST http://localhost:8001/train/run-from-path \
     -F "csv_path=$(pwd)/data/coimbatore_labeled_suitability.csv"

# Terminal 2 — then predict
curl -X POST http://localhost:8001/recommend/plot \
     -H "Content-Type: application/json" \
     -d '{"elevation":420,"slope":3.2,"aspect":180,"ndvi":0.55,"phh2o":6.3,"soc":180,"clay":28,"sand":42,"lat":10.95,"lon":77.12}'
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `ModuleNotFoundError: No module named 'ee'` | `pip install earthengine-api` |
| `ModuleNotFoundError: No module named 'rasterio'` | `pip install rasterio` |
| EE authentication fails | Run `earthengine authenticate` in terminal, then retry |
| EE quota error (batch step 2/3) | Reduce `BATCH_SIZE` in the script from 100 to 50 |
| SoilGrids VRT timeout (step 4) | Retry — ISRIC servers can be slow; the script handles failures gracefully |
| Step 5 merge gives 0 rows | Check that steps 2, 3, 4 all completed and wrote their CSVs |
| Training fails `Fewer than 2 crops` | Ensure step 6 completed and the labeled CSV has `suitability_class` column |
| Port 8001 already in use | Change `port=8001` in `run.py` to any free port |

---

## Notes

- **No Earth Engine needed for inference** — EE is only used during data collection (steps 2 & 3)
- **Fuzzy fallback always available** — `POST /recommend/plot` works instantly even without a trained model
- The 10-crop agronomic knowledge base + quota assignment is the **exact same logic** as the notebook
- Model artifacts are saved in `saved_models/` — commit this folder to share a pre-trained model with teammates