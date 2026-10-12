"""
Step 6 — Compute Suitability Scores & Label Crops
==================================================
Reads coimbatore_master_dataset.csv and:

  a) Computes suitability score (Module 2 — notebook cells 31-38):
         score = normalize(NDVI) * 0.35
               + (1 - normalize(slope)) * 0.25
               + (1 - |pH - 6.5| / 3).clip(0,1) * 0.20
               + normalize(soc) * 0.20
     → adds: suitability_score, suitability_class columns

  b) Runs agronomic fuzzy-logic fit + Hungarian quota assignment (Module 3 setup):
     → adds: rule_crop, best_fit, suit01 columns

  c) Saves the final labeled dataset:
         data/coimbatore_labeled_suitability.csv   ← EXACT notebook output

This is the ONLY output file needed to train the ML model via the API.
"""
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.optimize import linear_sum_assignment

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
MASTER_CSV = DATA_DIR / "coimbatore_master_dataset.csv"
OUT_CSV = DATA_DIR / "coimbatore_labeled_suitability.csv"

# ── Suitability parameters ───────────────────────────────────────────────────
SUIT_GATE = 0.5

# ── Crop knowledge base (exact copy from notebook cell 43) ───────────────────
CROPS = {
    "Rice":      dict(ph=(4.5,5.5,7.5,8.5), clay=(15,25,50,65), sand=(0,5,45,65),   slope=(0,0,2,5),   elev=(0,0,700,1500),  fert=0.7),
    "Sugarcane": dict(ph=(5.0,6.0,8.0,9.0), clay=(10,20,45,60), sand=(5,15,55,75),  slope=(0,0,3,8),   elev=(0,0,900,1400),  fert=0.8),
    "Maize":     dict(ph=(5.0,5.8,7.5,8.5), clay=(8,15,35,50),  sand=(15,30,65,80), slope=(0,0,6,15),  elev=(0,0,1500,2500), fert=0.6),
    "Cotton":    dict(ph=(5.5,6.0,8.0,9.0), clay=(15,25,55,70), sand=(0,10,50,70),  slope=(0,0,4,10),  elev=(0,0,800,1200),  fert=0.5),
    "Groundnut": dict(ph=(5.0,5.8,7.0,8.0), clay=(5,8,25,40),   sand=(35,50,80,90), slope=(0,0,6,12),  elev=(0,0,900,1500),  fert=0.3),
    "Coconut":   dict(ph=(5.0,5.5,8.5,9.0), clay=(5,10,40,55),  sand=(20,35,80,90), slope=(0,0,8,20),  elev=(0,0,800,1100),  fert=0.5),
    "Banana":    dict(ph=(5.5,6.0,7.5,8.5), clay=(10,18,40,55), sand=(10,25,60,75), slope=(0,0,4,10),  elev=(0,0,900,1500),  fert=0.8),
    "Sorghum":   dict(ph=(5.0,5.8,8.2,9.0), clay=(10,18,45,60), sand=(10,20,65,80), slope=(0,0,6,15),  elev=(0,0,1000,1800), fert=0.3),
    "Turmeric":  dict(ph=(4.5,5.5,7.5,8.5), clay=(8,15,35,50),  sand=(20,35,65,80), slope=(0,0,4,10),  elev=(0,0,1200,1600), fert=0.8),
    "Pulses":    dict(ph=(5.5,6.0,7.5,8.5), clay=(10,18,40,55), sand=(15,25,65,80), slope=(0,0,6,12),  elev=(0,0,1000,1500), fert=0.3),
}

TARGET_SHARE = {
    "Coconut": 83887, "Sorghum": 25844, "Banana": 8126,
    "Pulses": 5730, "Groundnut": 5719, "Maize": 4562,
    "Rice": 2355, "Turmeric": 1518, "Sugarcane": 1338, "Cotton": 731,
}

FIT_MIN = 0.20
MIN_CLASS_SAMPLES = 15


def membership(x, rng):
    a, b, c, d = rng
    x = np.asarray(x, dtype=float)
    up   = (x - a) / (b - a) if b > a else np.ones_like(x)
    down = (d - x) / (d - c) if d > c else np.ones_like(x)
    trap = np.clip(np.minimum(np.minimum(up, down), 1.0), 0, 1)
    mid, sigma = (b + c) / 2, max((d - a) / 4, 1e-6)
    closeness = np.exp(-0.5 * ((x - mid) / sigma) ** 2)
    return trap * (0.85 + 0.15 * closeness)


def normalize(col):
    return (col - col.min()) / (col.max() - col.min())


def run():
    if not MASTER_CSV.exists():
        sys.exit(f"❌  Master dataset not found at {MASTER_CSV}. Run step05 first.")

    print(f"[06] Loading {MASTER_CSV.name} …")
    df = pd.read_csv(MASTER_CSV)
    print(f"     {len(df):,} rows × {df.shape[1]} columns")

    # Normalise column names to lowercase for robustness
    df.columns = [c.strip() for c in df.columns]
    ndvi_col = "NDVI" if "NDVI" in df.columns else "ndvi"
    ph_col   = "phh2o" if "phh2o" in df.columns else "ph"

    # ── MODULE 2: Suitability Score (exact notebook formula) ─────────────────
    print("[06] Computing suitability scores …")
    score = (
        normalize(df[ndvi_col]) * 0.35 +
        (1 - normalize(df["slope"])) * 0.25 +
        (1 - (df[ph_col] - 6.5).abs() / 3.0).clip(0, 1) * 0.20 +
        normalize(df["soc"]) * 0.20
    )
    df["suitability_score"] = score.round(4)

    # Suitability class (quantile-based like notebook)
    try:
        df["suitability_class"] = pd.qcut(score, q=3, labels=["Low", "Moderate", "High"])
    except ValueError:
        df["suitability_class"] = np.where(
            score >= 0.65, "High", np.where(score >= SUIT_GATE, "Moderate", "Low")
        )

    vc = df["suitability_class"].value_counts()
    print(f"     High: {vc.get('High', 0):,}  Moderate: {vc.get('Moderate', 0):,}  Low: {vc.get('Low', 0):,}")

    # ── Prepare working frame for agronomic logic ─────────────────────────────
    print("[06] Building agronomic fit matrix …")

    # Standardise column names to match agronomy service
    work = df.rename(columns={ndvi_col: "ndvi", ph_col: "ph"}).copy()
    work = work.replace(-32768, np.nan)
    work = work.dropna(subset=["ph", "clay", "sand", "elevation", "slope", "suitability_score"])

    # Unit fixes
    if work["ph"].median() > 14:
        work["ph"] = work["ph"] / 10
    for k in ["clay", "sand"]:
        if work[k].median() > 100:
            work[k] = work[k] / 10
    work["ph"] = work["ph"].clip(3.5, 10)

    # Suit → 0..1
    work["suit01"] = work["suitability_score"].clip(0, 1)

    # Fertility index
    lo, hi = work["soc"].quantile([0.10, 0.90])
    work["fert"] = ((work["soc"] - lo) / (hi - lo + 1e-9)).clip(0, 1)

    # ── Fit matrix ────────────────────────────────────────────────────────────
    FIT_dict = {}
    fert_arr = work["fert"].values
    for crop, p in CROPS.items():
        m = np.vstack([
            membership(work["ph"], p["ph"]),
            membership(work["clay"], p["clay"]),
            membership(work["sand"], p["sand"]),
            membership(work["slope"], p["slope"]),
            membership(work["elevation"], p["elev"]),
        ])
        geo = np.exp(np.log(np.clip(m, 1e-3, 1.0)).mean(axis=0))
        geo = np.where((m == 0).any(axis=0), 0.0, geo)
        fert_factor = (1 - p["fert"]) + p["fert"] * (0.5 + 0.5 * fert_arr)
        FIT_dict[crop] = geo * fert_factor

    FIT = pd.DataFrame(FIT_dict, index=work.index)
    work["best_fit"] = FIT.max(axis=1)
    viable = work["best_fit"] >= FIT_MIN

    # ── Quota assignment (Hungarian algorithm) ─────────────────────────────────
    print("[06] Running quota assignment (Hungarian algorithm) …")
    crops = list(FIT.columns)
    tgt = pd.Series(TARGET_SHARE).reindex(crops).fillna(0.1)
    tgt = tgt / tgt.sum()
    n_viable = int(viable.sum())

    quota = np.floor(tgt.values * n_viable).astype(int)
    remainder = n_viable - quota.sum()
    if remainder > 0:
        quota[np.argsort(-tgt.values)[:remainder]] += 1

    slot_crop = np.repeat(np.arange(len(crops)), quota)
    FIT_viable = FIT[viable]
    rows, cols = linear_sum_assignment(-FIT_viable.values[:, slot_crop])
    assigned = np.empty(n_viable, dtype=int)
    assigned[rows] = slot_crop[cols]

    labels = pd.Series(np.array(crops)[assigned], index=FIT_viable.index)
    work["rule_crop"] = FIT.idxmax(axis=1)
    work.loc[viable, "rule_crop"] = labels

    # Safety fallback if quota pushed a plot outside its tolerable range
    crop_idx_map = {c: i for i, c in enumerate(crops)}
    fit_vals = FIT.values[np.arange(len(FIT)), [crop_idx_map[c] for c in work["rule_crop"]]]
    bad_mask = fit_vals <= 0
    if bad_mask.any():
        work.loc[work.index[bad_mask], "rule_crop"] = FIT.idxmax(axis=1)[work.index[bad_mask]]

    # ── Merge back to original df ─────────────────────────────────────────────
    df = df.loc[work.index].copy()
    df["suit01"] = work["suit01"].values
    df["best_fit"] = work["best_fit"].round(4).values
    df["rule_crop"] = work["rule_crop"].values
    df["ndvi"] = work["ndvi"].values  # ensure normalised column name

    # ── Final gating: recommended_crop (replicates notebook cell 46) ──────────
    ok = (df["suit01"] >= SUIT_GATE) & (df["best_fit"] >= FIT_MIN)
    low_suit = df["suit01"] < SUIT_GATE

    # Top-1 recommended crop (where eligible, else "Not recommended")
    df["recommended_crop"] = np.where(ok, df["rule_crop"], "Not recommended")
    df["not_recommended_reason"] = np.where(
        low_suit, "low suitability (Module 2)",
        np.where(
            (~ok) & (work["slope"].values > 15),
            "steep slope (>15 deg) - not cultivable for modelled crops",
            np.where(~ok, "no crop fits soil/terrain", "")
        )
    )

    # ── Save ──────────────────────────────────────────────────────────────────
    df.to_csv(str(OUT_CSV), index=False)
    print(f"\n    ✅ Saved {len(df):,} labeled plots → {OUT_CSV}")

    # ── Summary ───────────────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("LABEL DISTRIBUTION (all plots):")
    print(df["rule_crop"].value_counts().to_string())
    print("\nRECOMMENDATION STATUS:")
    print(df["recommended_crop"].replace("", "recommended").value_counts().to_string())
    print("=" * 60)

    return len(df)


if __name__ == "__main__":
    n = run()
    print(f"\n[06] Done — {n:,} labeled plots saved to coimbatore_labeled_suitability.csv")
    print("     ✅ Ready to train the ML model via: POST /train/run-from-path")
