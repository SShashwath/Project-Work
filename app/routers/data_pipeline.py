"""
Data Pipeline Router
====================
Exposes all 6 dataset-build steps as FastAPI endpoints,
so the entire pipeline can be triggered and monitored
without ever touching the notebook.
"""
import asyncio
import subprocess
import sys
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, HTTPException
from fastapi.responses import FileResponse

from app.config import BASE_DIR, DATA_DIR

router = APIRouter(prefix="/data", tags=["Data Pipeline"])

STEPS = {
    1: ("Generate Plot Grid",        "scripts/step01_generate_grid.py"),
    2: ("Fetch Terrain (EE)",        "scripts/step02_fetch_terrain_ee.py"),
    3: ("Fetch NDVI (EE)",           "scripts/step03_fetch_ndvi_ee.py"),
    4: ("Fetch Soil (SoilGrids)",    "scripts/step04_fetch_soil_soilgrids.py"),
    5: ("Merge + Clean + Validate",  "scripts/step05_merge_and_validate.py"),
    6: ("Suitability & Label Crops", "scripts/step06_suitability_and_label.py"),
}

_step_status: dict[int, str] = {}   # "pending" | "running" | "done" | "error: ..."


def _run_step(step_num: int):
    """Run a script step as a subprocess (non-blocking for background tasks)."""
    script_path = BASE_DIR / STEPS[step_num][1]
    if not script_path.exists():
        _step_status[step_num] = f"error: script not found at {script_path}"
        return

    _step_status[step_num] = "running"
    try:
        result = subprocess.run(
            [sys.executable, str(script_path)],
            cwd=str(BASE_DIR),
            capture_output=True,
            text=True,
            timeout=3600,   # 1 hour max per step
        )
        if result.returncode == 0:
            _step_status[step_num] = "done"
        else:
            _step_status[step_num] = f"error: {result.stderr[-500:] if result.stderr else 'unknown'}"
    except subprocess.TimeoutExpired:
        _step_status[step_num] = "error: timed out after 1 hour"
    except Exception as e:
        _step_status[step_num] = f"error: {e}"


@router.get(
    "/status",
    summary="Get pipeline and output file status",
    description="Shows which steps have been run and which output files exist.",
)
async def pipeline_status():
    files = {
        "coimbatore_plot_grid.geojson": (DATA_DIR / "coimbatore_plot_grid.geojson").exists(),
        "coimbatore_plot_grid.csv": (DATA_DIR / "coimbatore_plot_grid.csv").exists(),
        "coimbatore_terrain.csv": (DATA_DIR / "coimbatore_terrain.csv").exists(),
        "coimbatore_ndvi.csv": (DATA_DIR / "coimbatore_ndvi.csv").exists(),
        "coimbatore_soil.csv": (DATA_DIR / "coimbatore_soil.csv").exists(),
        "coimbatore_master_dataset.csv": (DATA_DIR / "coimbatore_master_dataset.csv").exists(),
        "coimbatore_labeled_suitability.csv": (DATA_DIR / "coimbatore_labeled_suitability.csv").exists(),
    }
    steps_status = {
        step_num: {
            "name": name,
            "script": script,
            "task_status": _step_status.get(step_num, "not started"),
        }
        for step_num, (name, script) in STEPS.items()
    }

    labeled_path = DATA_DIR / "coimbatore_labeled_suitability.csv"
    return {
        "pipeline_ready": labeled_path.exists(),
        "labeled_csv_path": str(labeled_path) if labeled_path.exists() else None,
        "output_files": files,
        "steps": steps_status,
    }


@router.post(
    "/run-step/{step_num}",
    summary="Run a single pipeline step",
    description=(
        "Triggers one of the 6 data pipeline steps in the background. "
        "Poll /data/status to check completion. Steps must be run in order (1 → 6).\n\n"
        "- **Step 1**: Generate plot grid (no external deps)\n"
        "- **Step 2**: Fetch terrain from Earth Engine (EE auth required)\n"
        "- **Step 3**: Fetch NDVI from Earth Engine\n"
        "- **Step 4**: Fetch soil from SoilGrids (internet + rasterio)\n"
        "- **Step 5**: Merge, clean, validate\n"
        "- **Step 6**: Compute suitability + label crops → labeled CSV\n"
    ),
)
async def run_step(step_num: int, background_tasks: BackgroundTasks):
    if step_num not in STEPS:
        raise HTTPException(status_code=400, detail=f"Step must be 1-6. Got {step_num}.")

    if _step_status.get(step_num) == "running":
        return {"status": "already running", "step": step_num, "name": STEPS[step_num][0]}

    # Prerequisites check (each step requires the previous output)
    prereqs = {
        2: DATA_DIR / "coimbatore_plot_grid.csv",
        3: DATA_DIR / "coimbatore_plot_grid.csv",
        4: DATA_DIR / "coimbatore_plot_grid.csv",
        5: DATA_DIR / "coimbatore_terrain.csv",
        6: DATA_DIR / "coimbatore_master_dataset.csv",
    }
    if step_num in prereqs and not prereqs[step_num].exists():
        raise HTTPException(
            status_code=400,
            detail=f"Prerequisite file missing: {prereqs[step_num].name}. Run earlier steps first."
        )

    _step_status[step_num] = "pending"
    background_tasks.add_task(_run_step, step_num)

    return {
        "status": "started",
        "step": step_num,
        "name": STEPS[step_num][0],
        "message": "Running in background. Poll GET /data/status to check progress.",
    }


@router.post(
    "/run-step/{step_num}/sync",
    summary="Run a single pipeline step synchronously (wait for result)",
    description="Runs a step and waits for it to finish before returning. May time out for long steps.",
)
async def run_step_sync(step_num: int):
    if step_num not in STEPS:
        raise HTTPException(status_code=400, detail=f"Step must be 1-6. Got {step_num}.")

    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _run_step, step_num)

    status = _step_status.get(step_num, "unknown")
    if status.startswith("error"):
        raise HTTPException(status_code=500, detail=status)

    return {
        "status": status,
        "step": step_num,
        "name": STEPS[step_num][0],
    }


@router.get(
    "/download/{filename}",
    summary="Download a generated data file",
    description="Download any generated data file from the data/ directory.",
    response_class=FileResponse,
)
async def download_file(filename: str):
    # Security: only allow known filenames
    allowed = [
        "coimbatore_plot_grid.csv",
        "coimbatore_plot_grid.geojson",
        "coimbatore_terrain.csv",
        "coimbatore_ndvi.csv",
        "coimbatore_soil.csv",
        "coimbatore_master_dataset.csv",
        "coimbatore_labeled_suitability.csv",
    ]
    if filename not in allowed:
        raise HTTPException(status_code=400, detail=f"Unknown file. Allowed: {allowed}")

    path = DATA_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {filename}. Run the pipeline first.")

    return FileResponse(path=str(path), filename=filename, media_type="text/csv")
