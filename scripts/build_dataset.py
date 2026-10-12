"""
build_dataset.py — One-Command Full Pipeline Runner
====================================================
Runs all 6 steps in sequence to produce coimbatore_labeled_suitability.csv.

Usage:
    python3 scripts/build_dataset.py

Steps:
    1. Generate plot grid (GeoJSON + CSV)
    2. Fetch terrain from Earth Engine (EE auth required)
    3. Fetch NDVI from Earth Engine
    4. Fetch soil from SoilGrids (internet required)
    5. Merge + clean + validate
    6. Compute suitability + label crops → labeled CSV

After this completes, run the server and train the model:
    python3 run.py
    curl -X POST http://localhost:8001/train/run-from-path \\
         -F "csv_path=$(pwd)/data/coimbatore_labeled_suitability.csv"
"""
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


def banner(step: int, title: str):
    print(f"\n{'='*60}")
    print(f"  STEP {step}: {title}")
    print(f"{'='*60}\n")


def main():
    start_total = time.time()
    print("🌾  AgriSense Dataset Build Pipeline")
    print("     Project: Coimbatore District, Tamil Nadu")
    print("     All outputs → data/\n")

    # Step 1
    banner(1, "Generate Plot Grid")
    from scripts.step01_generate_grid import run as step01
    n1 = step01()

    # Step 2
    banner(2, "Fetch Terrain via Earth Engine")
    print("  ⚠️  This step requires Google Earth Engine authentication.")
    print("      A browser tab will open. Sign in with your GEE-enabled Google account.\n")
    from scripts.step02_fetch_terrain_ee import run as step02
    n2 = step02()

    # Step 3
    banner(3, "Fetch NDVI via Earth Engine")
    from scripts.step03_fetch_ndvi_ee import run as step03
    n3 = step03()

    # Step 4
    banner(4, "Fetch Soil from SoilGrids (internet)")
    print("  ⚠️  Reads VRT files from https://files.isric.org — requires internet.\n")
    from scripts.step04_fetch_soil_soilgrids import run as step04
    n4 = step04()

    # Step 5
    banner(5, "Merge + Clean + Validate")
    from scripts.step05_merge_and_validate import run as step05
    n5 = step05()

    # Step 6
    banner(6, "Compute Suitability & Label Crops")
    from scripts.step06_suitability_and_label import run as step06
    n6 = step06()

    elapsed = time.time() - start_total
    print(f"\n{'='*60}")
    print(f"🎉  PIPELINE COMPLETE in {elapsed/60:.1f} min")
    print(f"    {n6:,} labeled plots → data/coimbatore_labeled_suitability.csv")
    print(f"\nNext steps:")
    print(f"  1. python3 run.py                         # start API server")
    print(f"  2. curl -X POST http://localhost:8001/train/run-from-path \\")
    print(f"       -F 'csv_path=$(pwd)/data/coimbatore_labeled_suitability.csv'")
    print(f"  3. Open http://localhost:8001/docs to explore all endpoints")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
