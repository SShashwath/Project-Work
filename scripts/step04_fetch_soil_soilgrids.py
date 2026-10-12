"""
Step 4 — Fetch Soil Data (SoilGrids via rasterio VRT)
======================================================
Downloads phH2O, SOC, clay, and sand values from the ISRIC SoilGrids
250m dataset (public HTTPS VRT files) and samples at each plot point.

Exactly replicates notebook cells 18-19.
Unit conversions applied (÷10) to match notebook:
    phH2O / 10 → actual pH (e.g. 65 → 6.5)
    clay  / 10 → %
    sand  / 10 → %

Requires: rasterio  (pip install rasterio)

Saves: data/coimbatore_soil.csv
"""
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
GRID_CSV = DATA_DIR / "coimbatore_plot_grid.csv"
GEOJSON = ROOT / "TAMIL NADU_DISTRICTS.geojson"
OUT_CSV = DATA_DIR / "coimbatore_soil.csv"

SOIL_PROPS = ["phh2o", "soc", "clay", "sand"]
DEPTH = "0-5cm"
ISRIC_BASE = "https://files.isric.org/soilgrids/latest/data"


def run():
    print("[04] Fetching soil data from SoilGrids …")
    try:
        import rasterio
        from rasterio.transform import rowcol
        from rasterio.windows import from_bounds
        from rasterio.warp import transform as warp_transform, transform_bounds
    except ImportError:
        sys.exit("❌  rasterio not installed. Run: pip install rasterio")

    if not GRID_CSV.exists():
        sys.exit(f"❌  Plot grid CSV not found at {GRID_CSV}. Run step01 first.")

    import geopandas as gpd
    import numpy as np

    df_grid = pd.read_csv(GRID_CSV)

    # Load study area for bounds
    tn = gpd.read_file(str(GEOJSON))
    col = "dtname" if "dtname" in tn.columns else tn.columns[0]
    study_area = tn[tn[col].str.lower() == "coimbatore"]
    bounds = study_area.total_bounds   # minx, miny, maxx, maxy (WGS84)

    soil_data = {}

    for prop in SOIL_PROPS:
        url = f"{ISRIC_BASE}/{prop}/{prop}_{DEPTH}_mean.vrt"
        print(f"    Fetching {prop} from {url} …")
        try:
            with rasterio.open(url) as src:
                proj_bounds = transform_bounds("EPSG:4326", src.crs, *bounds)
                window = from_bounds(*proj_bounds, transform=src.transform)
                data = src.read(1, window=window)
                transform = src.window_transform(window)
                src_crs = src.crs
            soil_data[prop] = (data, transform, src_crs)
            print(f"        ✅ {prop}: shape {data.shape}")
        except Exception as exc:
            print(f"        ❌ {prop}: {exc} — filling with NaN")
            soil_data[prop] = (None, None, None)

    # Sample each prop at all plot points
    print(f"[04] Sampling soil values at {len(df_grid):,} plot points …")
    soil_records = {prop: [] for prop in SOIL_PROPS}

    for _, row in df_grid.iterrows():
        for prop in SOIL_PROPS:
            data, tfm, crs = soil_data[prop]
            if data is None:
                soil_records[prop].append(None)
                continue
            try:
                xs, ys = warp_transform("EPSG:4326", crs, [row.lon], [row.lat])
                r, c = rowcol(tfm, xs[0], ys[0])
                if 0 <= r < data.shape[0] and 0 <= c < data.shape[1]:
                    soil_records[prop].append(float(data[r, c]))
                else:
                    soil_records[prop].append(None)
            except Exception:
                soil_records[prop].append(None)

    soil_df = pd.DataFrame({
        "lon": df_grid.lon.values,
        "lat": df_grid.lat.values,
        **soil_records
    })

    # Apply SoilGrids unit conversions (identical to notebook)
    for col_name, divisor in [("phh2o", 10), ("clay", 10), ("sand", 10)]:
        if col_name in soil_df.columns:
            soil_df[col_name] = soil_df[col_name] / divisor

    soil_df.to_csv(str(OUT_CSV), index=False)
    print(f"    ✅ {len(soil_df):,} soil records.")
    print(f"    💾 Saved → {OUT_CSV}")
    return len(soil_df)


if __name__ == "__main__":
    n = run()
    print(f"\n[04] Done — {n:,} soil points saved.")
