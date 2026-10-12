import numpy as np
import pandas as pd
from typing import Dict, Tuple, Union

from app.config import REFERENCE_BOUNDS, SUIT_GATE


def evaluate_single_suitability(
    ndvi: float,
    slope: float,
    phh2o: float,
    soc: float
) -> Tuple[float, str, Dict[str, float]]:
    """
    Calculate composite land suitability score for a single plot using normalized criteria:
    - NDVI (vegetation vigor): 35%
    - Slope (flatter is better): 25%
    - pH (moderate ~6.5 is optimal): 20%
    - SOC (soil organic carbon): 20%
    """
    # Normalize NDVI (typically 0.0 - 0.9 for agricultural land)
    ndvi_norm = float(np.clip((ndvi - REFERENCE_BOUNDS["NDVI"]["min"]) / 
                              (REFERENCE_BOUNDS["NDVI"]["max"] - REFERENCE_BOUNDS["NDVI"]["min"]), 0.0, 1.0))

    # Normalize slope (0 to 45 deg, flatter = better)
    slope_norm = float(np.clip(slope / 45.0, 0.0, 1.0))
    slope_score = 1.0 - slope_norm

    # pH score (optimal around 6.5, tolerance +-3.0)
    ph_score = float(np.clip(1.0 - abs(phh2o - REFERENCE_BOUNDS["phh2o"]["optimum"]) / 
                             REFERENCE_BOUNDS["phh2o"]["tolerance"], 0.0, 1.0))

    # SOC score
    soc_norm = float(np.clip(soc / REFERENCE_BOUNDS["soc"]["max"], 0.0, 1.0))

    score = (
        0.35 * ndvi_norm +
        0.25 * slope_score +
        0.20 * ph_score +
        0.20 * soc_norm
    )
    score = round(float(np.clip(score, 0.0, 1.0)), 4)

    if score >= 0.65:
        suit_class = "High"
    elif score >= SUIT_GATE:
        suit_class = "Moderate"
    else:
        suit_class = "Low"

    components = {
        "ndvi_component": round(0.35 * ndvi_norm, 4),
        "slope_component": round(0.25 * slope_score, 4),
        "ph_component": round(0.20 * ph_score, 4),
        "soc_component": round(0.20 * soc_norm, 4),
    }

    return score, suit_class, components


def evaluate_dataframe_suitability(df: pd.DataFrame) -> pd.DataFrame:
    """
    Calculate suitability score for a pandas dataframe batch.
    Matches the exact notebook formula:
    score = normalize(df['NDVI']) * 0.35 + (1 - normalize(df['slope'])) * 0.25 + 
            (1 - abs(df['phh2o'] - 6.5) / 3).clip(0, 1) * 0.20 + normalize(df['soc']) * 0.20
    """
    def normalize_col(col):
        c_min, c_max = col.min(), col.max()
        if c_max == c_min:
            return pd.Series(0.5, index=col.index)
        return (col - c_min) / (c_max - c_min)

    ndvi_col = df['NDVI'] if 'NDVI' in df.columns else df['ndvi']
    slope_col = df['slope'] if 'slope' in df.columns else df['Slope']
    ph_col = df['phh2o'] if 'phh2o' in df.columns else df['ph']
    soc_col = df['soc'] if 'soc' in df.columns else df['SOC']

    score = (
        normalize_col(ndvi_col) * 0.35 +
        (1 - normalize_col(slope_col)) * 0.25 +
        (1 - (ph_col - 6.5).abs() / 3.0).clip(0, 1) * 0.20 +
        normalize_col(soc_col) * 0.20
    )
    
    df = df.copy()
    df['suitability_score'] = score.round(4)
    
    # Quantile binning if diverse samples, otherwise absolute thresholds
    try:
        df['suitability_class'] = pd.qcut(score, q=3, labels=['Low', 'Moderate', 'High'])
    except ValueError:
        df['suitability_class'] = np.where(score >= 0.65, 'High', np.where(score >= SUIT_GATE, 'Moderate', 'Low'))

    return df
