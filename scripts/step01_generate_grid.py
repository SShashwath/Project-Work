"""
Step 1 — Generate Coimbatore Plot Grid
======================================
Reads TAMIL NADU_DISTRICTS.geojson, extracts Coimbatore boundary,
and generates a 0.01° spaced coordinate grid clipped to the district.

Saves:
    data/coimbatore_plot_grid.geojson
    data/coimbatore_plot_grid.csv     (lon, lat columns for EE sampling)
"""
import os
import sys
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
from shapely.geometry import Point

# ── Paths ──────────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
GEOJSON = ROOT / "TAMIL NADU_DISTRICTS.geojson"
DATA_DIR.mkdir(parents=True, exist_ok=True)

DISTRICT = "Coimbatore"
SPACING = 0.01          # ~1 km grid


def run():
    print(f"[01] Loading GeoJSON from {GEOJSON} …")
    if not GEOJSON.exists():
        sys.exit(f"❌  GeoJSON not found at {GEOJSON}. Place it in the project root.")

    tn = gpd.read_file(str(GEOJSON))
    col = "dtname" if "dtname" in tn.columns else tn.columns[0]
    
    # Case-insensitive match
    match = tn[tn[col].str.lower() == DISTRICT.lower()]
    if match.empty:
        available = tn[col].tolist()
        sys.exit(f"❌  District '{DISTRICT}' not found. Available: {available}")
    
    study_area = match
    print(f"    ✅ Loaded '{DISTRICT}' boundary. CRS: {study_area.crs}")

    bounds = study_area.total_bounds          # minx, miny, maxx, maxy
    xs = np.arange(bounds[0], bounds[2], SPACING)
    ys = np.arange(bounds[1], bounds[3], SPACING)
    
    print(f"[01] Generating {len(xs)*len(ys):,} candidate grid points …")
    grid_points = [Point(x, y) for x in xs for y in ys]
    grid_gdf = gpd.GeoDataFrame(geometry=grid_points, crs=study_area.crs)
    
    plot_grid = gpd.clip(grid_gdf, study_area)
    print(f"    ✅ {len(plot_grid):,} points after clipping to district boundary")

    # Save GeoJSON
    out_geojson = DATA_DIR / "coimbatore_plot_grid.geojson"
    plot_grid.to_file(str(out_geojson), driver="GeoJSON")
    print(f"    💾 Saved → {out_geojson}")

    # Save CSV for downstream steps
    out_csv = DATA_DIR / "coimbatore_plot_grid.csv"
    pd.DataFrame({
        "lon": [g.x for g in plot_grid.geometry],
        "lat": [g.y for g in plot_grid.geometry],
    }).to_csv(str(out_csv), index=False)
    print(f"    💾 Saved → {out_csv}")
    
    return len(plot_grid)


if __name__ == "__main__":
    n = run()
    print(f"\n[01] Done — {n:,} plot points generated.")
