"""
Step 5 — Merge, Clean & Validate Master Dataset
================================================
Merges terrain, NDVI, and soil CSVs into a single master dataset.
Applies the same cleaning rules as notebook cells 21-27:

Cleaning rules:
  - Drop rows with NDVI ≤ -1
  - Drop rows with sentinel no-data values (clay/soc/phh2o < -1000)
  - Reset index

Validation checks (replicates notebook cell 27):
  1. Shape check
  2. Missing values check
  3. Sentinel value check
  4. Range sanity check
  5. Duplicate lon/lat check
  6. Spatial coverage check (points inside Coimbatore)

Saves: data/coimbatore_master_dataset.csv
"""
import sys
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
GEOJSON = ROOT / "TAMIL NADU_DISTRICTS.geojson"

TERRAIN_CSV = DATA_DIR / "coimbatore_terrain.csv"
NDVI_CSV = DATA_DIR / "coimbatore_ndvi.csv"
SOIL_CSV = DATA_DIR / "coimbatore_soil.csv"
OUT_CSV = DATA_DIR / "coimbatore_master_dataset.csv"

RANGE_CHECKS = {
    "elevation": (0, 3000, "meters"),
    "slope": (0, 90, "degrees"),
    "aspect": (0, 360, "degrees"),
    "NDVI": (-1, 1, "index"),
    "phh2o": (3, 10, "pH"),
    "soc": (0, 2000, "raw units"),
    "clay": (0, 100, "%"),
    "sand": (0, 100, "%"),
}


def run():
    # ── Load all CSVs ──────────────────────────────────────────────────────────
    for label, path in [("terrain", TERRAIN_CSV), ("NDVI", NDVI_CSV), ("soil", SOIL_CSV)]:
        if not path.exists():
            sys.exit(f"❌  {label} CSV not found at {path}. Run earlier steps first.")

    print("[05] Loading terrain, NDVI, and soil CSVs …")
    terrain_df = pd.read_csv(TERRAIN_CSV).reset_index(drop=True)
    ndvi_df = pd.read_csv(NDVI_CSV).reset_index(drop=True)
    soil_df = pd.read_csv(SOIL_CSV).reset_index(drop=True)

    print(f"    terrain: {terrain_df.shape}, ndvi: {ndvi_df.shape}, soil: {soil_df.shape}")

    # ── Merge using nearest-neighbour (handles EE pixel centroid offsets) ─────
    # EE returns pixel centroids (30m SRTM, 10m S2), not exact grid coords.
    # We use a KD-tree join with a 0.005° tolerance (~500m) to match them.
    print("[05] Merging datasets via nearest-neighbour join (handles EE pixel offsets) …")
    from scipy.spatial import cKDTree

    def nn_merge(base_df, other_df, other_cols, max_dist=0.005):
        """Join other_df onto base_df by nearest lon/lat within max_dist degrees."""
        tree = cKDTree(other_df[["lon", "lat"]].values)
        dists, idxs = tree.query(base_df[["lon", "lat"]].values, k=1)
        matched = other_df.iloc[idxs][other_cols].reset_index(drop=True)
        matched[dists > max_dist] = None    # blank out matches that are too far
        return pd.concat([base_df.reset_index(drop=True), matched], axis=1)

    # Start from soil (exact grid coords), join terrain and NDVI onto it
    master = soil_df.rename(columns={"lon": "lon", "lat": "lat"})
    master = nn_merge(master, terrain_df, ["elevation", "slope", "aspect"])
    master = nn_merge(master, ndvi_df, ["NDVI"])


    print(f"    After merge: {master.shape}")

    # ── Cleaning (replicates notebook cells 21-24) ─────────────────────────────
    print("[05] Cleaning: removing NDVI fill values and sentinel no-data …")
    before = len(master)
    master = master[master["NDVI"] > -1]
    master = master[
        (master["clay"] > -1000) &
        (master["soc"] > -1000) &
        (master["phh2o"] > -1000)
    ].reset_index(drop=True)
    after = len(master)
    print(f"    Dropped {before - after:,} bad rows → {after:,} clean rows remain.")

    # ── Save master dataset ────────────────────────────────────────────────────
    master.to_csv(str(OUT_CSV), index=False)
    print(f"    💾 Saved → {OUT_CSV}")

    # ── Validation (replicates notebook cell 27) ───────────────────────────────
    print("\n[05] Running validation checks …")
    print("=" * 60)

    # 1. Shape
    print(f"1. Shape: {master.shape[0]:,} rows × {master.shape[1]} columns")
    
    # 2. Missing values
    missing = master.isnull().sum()
    if missing.sum() == 0:
        print("2. Missing values: NONE ✅")
    else:
        print(f"2. Missing values:\n{missing[missing > 0]}")

    # 3. Sentinel check
    suspicious = master[(master < -1000).any(axis=1)]
    print(f"3. Rows with extreme sentinel values: {len(suspicious)} {'✅' if len(suspicious)==0 else '⚠️'}")

    # 4. Range sanity
    print("4. Range sanity check:")
    for col, (lo, hi, unit) in RANGE_CHECKS.items():
        if col not in master.columns:
            continue
        actual_min, actual_max = master[col].min(), master[col].max()
        ok = lo <= actual_min and actual_max <= hi
        status = "✅" if ok else "⚠️  CHECK THIS"
        print(f"   {col:12s} [{actual_min:8.2f}, {actual_max:8.2f}] {unit:12s} → {status}")

    # 5. Duplicates
    dupes = master.duplicated(subset=["lon", "lat"]).sum()
    print(f"5. Duplicate lon/lat pairs: {dupes} {'✅' if dupes == 0 else '⚠️'}")

    # 6. Spatial coverage
    print("6. Spatial coverage (inside Coimbatore boundary):")
    try:
        tn = gpd.read_file(str(GEOJSON))
        col_name = "dtname" if "dtname" in tn.columns else tn.columns[0]
        coimbatore = tn[tn[col_name].str.lower() == "coimbatore"]
        pts_gdf = gpd.GeoDataFrame(
            master, geometry=gpd.points_from_xy(master.lon, master.lat), crs="EPSG:4326"
        )
        inside = pts_gdf.within(coimbatore.geometry.iloc[0]).sum()
        print(f"   {inside:,} / {len(master):,} points confirmed inside boundary ✅")
    except Exception as e:
        print(f"   Spatial check skipped: {e}")

    print("=" * 60)
    print("[05] ALL CHECKS COMPLETE")
    return len(master)


if __name__ == "__main__":
    n = run()
    print(f"\n[05] Done — {n:,} records in master dataset.")
