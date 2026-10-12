"""
Step 3 — Fetch NDVI Data (Sentinel-2 via Earth Engine)
=======================================================
Computes median NDVI for each plot point from Sentinel-2 imagery
for the year 2025, using the same formula as the notebook:
    NDVI = (B8 - B4) / (B8 + B4)

Saves: data/coimbatore_ndvi.csv
"""
import math
import sys
import time
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
GRID_CSV = DATA_DIR / "coimbatore_plot_grid.csv"
OUT_CSV = DATA_DIR / "coimbatore_ndvi.csv"
GEE_PROJECT = "helpful-quanta-505516-m4"
BATCH_SIZE = 100
DATE_START = "2025-01-01"
DATE_END = "2025-12-31"
CLOUD_THRESH = 20       # max cloud percentage


def _ee_init(ee):
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
    print("[03] Initialising Earth Engine for NDVI …")
    try:
        import ee
    except ImportError:
        sys.exit("❌  earthengine-api not installed. Run: pip install earthengine-api")

    if not GRID_CSV.exists():
        sys.exit(f"❌  Plot grid CSV not found at {GRID_CSV}. Run step01 first.")

    _ee_init(ee)
    print("    ✅ EE ready.")

    df_grid = pd.read_csv(GRID_CSV)
    total = len(df_grid)
    print(f"[03] Sampling NDVI for {total:,} points …")

    # Build bounding box for the entire study area (to filter S2 collection efficiently)
    lon_min, lon_max = df_grid.lon.min(), df_grid.lon.max()
    lat_min, lat_max = df_grid.lat.min(), df_grid.lat.max()
    bbox = ee.Geometry.Rectangle([lon_min, lat_min, lon_max, lat_max])

    def add_ndvi(img):
        ndvi = img.normalizedDifference(["B8", "B4"]).rename("NDVI")
        return img.addBands(ndvi)

    s2 = (
        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterBounds(bbox)
        .filterDate(DATE_START, DATE_END)
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", CLOUD_THRESH))
    )
    ndvi_median = s2.map(add_ndvi).select("NDVI").median()

    records = []
    n_batches = math.ceil(total / BATCH_SIZE)

    for batch_idx in range(n_batches):
        start = batch_idx * BATCH_SIZE
        end = min(start + BATCH_SIZE, total)
        batch_df = df_grid.iloc[start:end]

        ee_points = ee.FeatureCollection([
            ee.Feature(
                ee.Geometry.Point([row.lon, row.lat]),
                {"orig_lon": row.lon, "orig_lat": row.lat}
            )
            for _, row in batch_df.iterrows()
        ])

        sampled = ndvi_median.sampleRegions(
            collection=ee_points, scale=10, geometries=False
        )

        try:
            info = sampled.getInfo()
        except Exception as exc:
            print(f"    ⚠️  Batch {batch_idx+1}/{n_batches} failed: {exc}. Filling NaN …")
            for _, row in batch_df.iterrows():
                records.append({"lon": row.lon, "lat": row.lat, "NDVI": None})
            continue

        for feat in info.get("features", []):
            props = feat.get("properties", {})
            records.append({
                "lon": props.get("orig_lon"),   # exact grid point
                "lat": props.get("orig_lat"),
                "NDVI": props.get("NDVI"),
            })

        if (batch_idx + 1) % 10 == 0 or (batch_idx + 1) == n_batches:
            pct = (batch_idx + 1) / n_batches * 100
            print(f"    [{pct:5.1f}%] {batch_idx+1}/{n_batches} batches …")

        time.sleep(0.1)

    ndvi_df = pd.DataFrame(records)

    # Drop fill-values exactly as in notebook
    ndvi_df = ndvi_df[ndvi_df["NDVI"] > -1].reset_index(drop=True)

    ndvi_df.to_csv(str(OUT_CSV), index=False)
    print(f"    ✅ {len(ndvi_df):,} NDVI records (after dropping fill values).")
    print(f"    💾 Saved → {OUT_CSV}")
    return len(ndvi_df)


if __name__ == "__main__":
    n = run()
    print(f"\n[03] Done — {n:,} NDVI points saved.")
