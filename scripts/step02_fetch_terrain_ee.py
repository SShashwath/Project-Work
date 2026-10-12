"""
Step 2 — Fetch Terrain Data (SRTM via Earth Engine)
====================================================
Authenticates to Google Earth Engine locally (opens a browser tab),
then samples elevation, slope, and aspect for each plot grid point.

Unlike the Colab notebook (which exports to Drive), this script uses
direct EE batched sampling and saves results locally.

Requires: earthengine-api installed, GEE project access

Saves: data/coimbatore_terrain.csv
"""
import math
import sys
import time
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
GRID_CSV = DATA_DIR / "coimbatore_plot_grid.csv"
OUT_CSV = DATA_DIR / "coimbatore_terrain.csv"
BATCH_SIZE = 100       # EE getInfo() is stable at 100 features per call


def _ee_init(ee):
    """Authenticate and initialise EE with the project."""
    PROJECT = "arctic-study-511414-v3"

    def _try_init():
        try:
            ee.Initialize(project=PROJECT)
            return True
        except Exception:
            return False

    if _try_init():
        return

    print("    ⚠️  EE not authenticated. Opening browser for authentication …")
    ee.Authenticate()
    if not _try_init():
        raise RuntimeError(
            "❌  EE Initialize failed. Ensure the project 'arctic-study-511414-v3' "
            "has Earth Engine registered at: "
            "https://console.cloud.google.com/earth-engine?project=arctic-study-511414-v3"
        )


def run():
    print("[02] Initialising Earth Engine …")
    try:
        import ee
    except ImportError:
        sys.exit("❌  earthengine-api not installed. Run: pip install earthengine-api")

    if not GRID_CSV.exists():
        sys.exit(f"❌  Plot grid CSV not found at {GRID_CSV}. Run step01 first.")

    _ee_init(ee)
    print("    ✅ EE authenticated and initialised.")

    df_grid = pd.read_csv(GRID_CSV)
    total = len(df_grid)
    print(f"[02] Sampling terrain for {total:,} points in batches of {BATCH_SIZE} …")

    # Load SRTM terrain stack
    srtm = ee.Image("USGS/SRTMGL1_003")
    slope_img = ee.Terrain.slope(srtm)
    aspect_img = ee.Terrain.aspect(srtm)
    terrain_stack = (
        srtm.rename("elevation")
        .addBands(slope_img.rename("slope"))
        .addBands(aspect_img.rename("aspect"))
    )

    records = []
    n_batches = math.ceil(total / BATCH_SIZE)

    for batch_idx in range(n_batches):
        start = batch_idx * BATCH_SIZE
        end = min(start + BATCH_SIZE, total)
        batch_df = df_grid.iloc[start:end]

        ee_points = ee.FeatureCollection([
            ee.Feature(
                ee.Geometry.Point([row.lon, row.lat]),
                {"orig_lon": row.lon, "orig_lat": row.lat}  # preserve exact grid coords
            )
            for _, row in batch_df.iterrows()
        ])

        sampled = terrain_stack.sampleRegions(
            collection=ee_points, scale=30, geometries=False
        )

        try:
            info = sampled.getInfo()
        except Exception as exc:
            print(f"    ⚠️  Batch {batch_idx+1}/{n_batches} failed: {exc}. Filling NaN …")
            for _, row in batch_df.iterrows():
                records.append({"lon": row.lon, "lat": row.lat,
                                 "elevation": None, "slope": None, "aspect": None})
            continue

        for feat in info["features"]:
            props = feat.get("properties", {})
            records.append({
                "lon": props.get("orig_lon"),   # exact grid point
                "lat": props.get("orig_lat"),
                "elevation": props.get("elevation"),
                "slope": props.get("slope"),
                "aspect": props.get("aspect"),
            })

        if (batch_idx + 1) % 10 == 0 or (batch_idx + 1) == n_batches:
            pct = (batch_idx + 1) / n_batches * 100
            print(f"    [{pct:5.1f}%] {batch_idx+1}/{n_batches} batches complete …")

        time.sleep(0.1)   # polite rate limiting

    terrain_df = pd.DataFrame(records)
    terrain_df.to_csv(str(OUT_CSV), index=False)
    print(f"    ✅ Sampled {len(terrain_df):,} terrain records.")
    print(f"    💾 Saved → {OUT_CSV}")
    return len(terrain_df)


if __name__ == "__main__":
    n = run()
    print(f"\n[02] Done — {n:,} terrain points saved.")
