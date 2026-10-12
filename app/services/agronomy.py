from typing import Any, Dict, List, Tuple, Union
import numpy as np
import pandas as pd
from scipy.optimize import linear_sum_assignment

from app.config import CROPS, TARGET_SHARE


def membership(x: Any, rng: Tuple[float, float, float, float]) -> np.ndarray:
    """
    Trapezoidal membership function with a smooth Gaussian tie-breaker around optimum center.
    a: lower tolerance limit
    b: optimum lower bound
    c: optimum upper bound
    d: upper tolerance limit
    """
    a, b, c, d = rng
    x = np.asarray(x, dtype=float)
    
    # Rising slope
    if b > a:
        up = (x - a) / (b - a)
    else:
        up = np.ones_like(x)

    # Falling slope
    if d > c:
        down = (d - x) / (d - c)
    else:
        down = np.ones_like(x)

    # Trapezoid (0 outside limits, 1 inside optimum)
    trap = np.clip(np.minimum(np.minimum(up, down), 1.0), 0.0, 1.0)
    
    # Tie-breaker closeness to center
    mid = (b + c) / 2.0
    sigma = max((d - a) / 4.0, 1e-6)
    closeness = np.exp(-0.5 * ((x - mid) / sigma) ** 2)
    
    return trap * (0.85 + 0.15 * closeness)


def calculate_plot_fit(
    ph: float,
    clay: float,
    sand: float,
    slope: float,
    elevation: float,
    soc: float,
) -> Dict[str, float]:
    """Calculate agronomic suitability score (0-1) for a single plot across all 10 crops."""
    # Estimate fertility factor from SOC
    fert_factor_val = float(np.clip(soc / 1200.0, 0.0, 1.0))

    results = {}
    for crop, p in CROPS.items():
        m_ph = membership(ph, p["ph"])
        m_clay = membership(clay, p["clay"])
        m_sand = membership(sand, p["sand"])
        m_slope = membership(slope, p["slope"])
        m_elev = membership(elevation, p["elev"])

        m_stack = np.array([m_ph, m_clay, m_sand, m_slope, m_elev])
        
        # If any essential condition is outside tolerable range (0), geo fit is 0
        if (m_stack == 0).any():
            results[crop] = 0.0
            continue

        geo = np.exp(np.log(np.clip(m_stack, 1e-3, 1.0)).mean())
        crop_fert = p["fert"]
        fert_scale = (1.0 - crop_fert) + crop_fert * (0.5 + 0.5 * fert_factor_val)
        
        results[crop] = round(float(geo * fert_scale), 4)

    return results


def fit_matrix(frame: pd.DataFrame) -> pd.DataFrame:
    """Compute agronomic fit matrix for a batch dataframe across all 10 crops."""
    out = {}
    
    # Compute fertility index from SOC
    if "fert" in frame.columns:
        fert_series = frame["fert"].values
    elif "soc" in frame.columns:
        lo, hi = frame["soc"].quantile([0.10, 0.90])
        fert_series = ((frame["soc"] - lo) / (hi - lo + 1e-9)).clip(0, 1).values
    else:
        fert_series = np.full(len(frame), 0.5)

    for crop, p in CROPS.items():
        m = np.vstack([
            membership(frame["ph"], p["ph"]),
            membership(frame["clay"], p["clay"]),
            membership(frame["sand"], p["sand"]),
            membership(frame["slope"], p["slope"]),
            membership(frame["elevation"], p["elev"])
        ])
        geo = np.exp(np.log(np.clip(m, 1e-3, 1.0)).mean(axis=0))
        geo = np.where((m == 0).any(axis=0), 0.0, geo)
        
        fert_factor = (1.0 - p["fert"]) + p["fert"] * (0.5 + 0.5 * fert_series)
        out[crop] = geo * fert_factor

    return pd.DataFrame(out, index=frame.index)


def quota_assign(FIT: pd.DataFrame, target: Dict[str, float] = None) -> Tuple[pd.Series, pd.Series]:
    """
    Give each crop its district area-share of plots, choosing the plots where that crop fits best.
    Uses Hungarian algorithm (linear sum assignment).
    """
    if target is None:
        target = TARGET_SHARE

    crops = list(FIT.columns)
    tgt = pd.Series(target).reindex(crops).fillna(0.1)
    tgt = tgt / tgt.sum()
    n = len(FIT)
    
    quota = np.floor(tgt.values * n).astype(int)
    # Distribute remainder
    remainder = n - quota.sum()
    if remainder > 0:
        quota[np.argsort(-tgt.values)[:remainder]] += 1

    slot_crop = np.repeat(np.arange(len(crops)), quota)
    rows, cols = linear_sum_assignment(-FIT.values[:, slot_crop])
    assigned = np.empty(n, dtype=int)
    assigned[rows] = slot_crop[cols]
    
    return pd.Series(np.array(crops)[assigned], index=FIT.index), tgt
