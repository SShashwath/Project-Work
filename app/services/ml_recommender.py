import json
import os
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, f1_score, top_k_accuracy_score
from sklearn.model_selection import GroupShuffleSplit, train_test_split
from sklearn.preprocessing import LabelEncoder
from xgboost import XGBClassifier

from app.config import (
    CROPS,
    FEATURES,
    FIT_MIN,
    METADATA_PATH,
    MIN_CLASS_SAMPLES,
    MODEL_PATH,
    ENCODER_PATH,
    RANDOM_STATE,
    SUIT_GATE,
    TARGET_SHARE,
)
from app.models.schemas import CropRecommendation, RecommendationResult
from app.services.agronomy import calculate_plot_fit, fit_matrix, quota_assign
from app.services.suitability import evaluate_single_suitability

_CACHED_MODEL = None
_CACHED_LE = None


def load_model_and_encoder() -> Tuple[Optional[Any], Optional[LabelEncoder]]:
    """Load cached ML model and label encoder, or None if not trained yet."""
    global _CACHED_MODEL, _CACHED_LE
    if _CACHED_MODEL is None and os.path.exists(MODEL_PATH) and os.path.exists(ENCODER_PATH):
        try:
            _CACHED_MODEL = joblib.load(MODEL_PATH)
            _CACHED_LE = joblib.load(ENCODER_PATH)
        except Exception as e:
            print(f"Warning: Could not load trained model: {e}")
            _CACHED_MODEL = None
            _CACHED_LE = None
    return _CACHED_MODEL, _CACHED_LE


def get_model_status() -> Dict[str, Any]:
    """Check if model is trained and return metadata."""
    is_trained = os.path.exists(MODEL_PATH) and os.path.exists(ENCODER_PATH)
    metadata = {}
    if os.path.exists(METADATA_PATH):
        try:
            with open(METADATA_PATH, "r") as f:
                metadata = json.load(f)
        except Exception:
            pass
    return {
        "is_trained": is_trained,
        "model_file": str(MODEL_PATH) if is_trained else None,
        "metadata": metadata
    }


def predict_single_plot(
    elevation: float,
    slope: float,
    aspect: float,
    ndvi: float,
    phh2o: float,
    soc: float,
    clay: float,
    sand: float,
    lat: Optional[float] = None,
    lon: Optional[float] = None
) -> RecommendationResult:
    """
    Recommend top crops for a single parcel using ML classifier (with rule-based agronomic fallback).
    Applies the notebook suitability and slope gating rules.
    """
    # 1. Evaluate suitability score
    suit_score, suit_class, _ = evaluate_single_suitability(
        ndvi=ndvi, slope=slope, phh2o=phh2o, soc=soc
    )
    
    # 2. Evaluate agronomic fit scores
    fit_scores = calculate_plot_fit(
        ph=phh2o, clay=clay, sand=sand, slope=slope, elevation=elevation, soc=soc
    )
    best_fit = max(fit_scores.values()) if fit_scores else 0.0

    # 3. Determine suitability & physical constraints
    low_suit = suit_score < SUIT_GATE
    steep = slope > 15.0
    no_fit = best_fit < FIT_MIN

    recommended = not (low_suit or steep or no_fit)

    if low_suit:
        reason = "low suitability (Module 2)"
    elif steep:
        reason = "steep slope (>15 deg) - not cultivable for modelled crops"
    elif no_fit:
        reason = "no crop fits soil/terrain"
    else:
        reason = "recommended"

    # 4. Predict Top 3 crops with ML or Fallback
    model, le = load_model_and_encoder()
    recommendations: List[CropRecommendation] = []

    if model is not None and le is not None:
        # Construct feature vector
        feat_dict = {
            "ph": phh2o,
            "soc": soc,
            "clay": clay,
            "sand": sand,
            "elevation": elevation,
            "slope": slope,
            "aspect": aspect,
            "ndvi": ndvi,
            "suit01": suit_score
        }
        feat_df = pd.DataFrame([feat_dict])[FEATURES]
        probas = model.predict_proba(feat_df)[0]
        order = np.argsort(-probas)[:3]

        for i, idx in enumerate(order):
            crop_name = le.classes_[idx]
            recommendations.append(CropRecommendation(
                rank=i + 1,
                crop=crop_name,
                probability=round(float(probas[idx]), 4),
                agronomic_fit=fit_scores.get(crop_name, None)
            ))
    else:
        # Agronomic fuzzy fit fallback
        sorted_fits = sorted(fit_scores.items(), key=lambda x: x[1], reverse=True)[:3]
        total_fit = sum(f[1] for f in sorted_fits) or 1.0
        for i, (crop_name, f_val) in enumerate(sorted_fits):
            prob = round(float(f_val / total_fit), 4) if total_fit > 0 else 0.0
            recommendations.append(CropRecommendation(
                rank=i + 1,
                crop=crop_name,
                probability=prob,
                agronomic_fit=f_val
            ))

    top_crop = recommendations[0].crop if (recommended and recommendations) else "Not recommended"

    return RecommendationResult(
        recommended=recommended,
        recommended_crop=top_crop,
        not_recommended_reason=reason,
        suitability_score=suit_score,
        suitability_class=suit_class,
        agro_fit_top=best_fit,
        top_recommendations=recommendations
    )


def train_recommender_pipeline(
    df: pd.DataFrame,
    preferred_model: str = "RandomForest"
) -> Dict[str, Any]:
    """
    Train crop recommendation models (RandomForest and XGBoost) on a labeled dataset.
    Implements Cells 41-46 from the notebook.
    """
    global _CACHED_MODEL, _CACHED_LE
    
    # 1. Normalize column names
    candidates = {
        "ph": ["ph", "soil_ph", "phh2o"],
        "soc": ["soc", "organic_carbon", "ocd"],
        "clay": ["clay"],
        "sand": ["sand"],
        "elevation": ["elevation", "elev", "dem", "srtm"],
        "slope": ["slope"],
        "aspect": ["aspect"],
        "ndvi": ["ndvi", "NDVI"],
        "lat": ["lat", "latitude"],
        "lon": ["lon", "lng", "longitude", "long"],
        "suit": ["suitability_score", "suit_score", "suitability", "suit"],
    }

    cols_lower = {c.lower(): c for c in df.columns}
    col_map = {}
    for key, c_list in candidates.items():
        matched = None
        for name in c_list:
            if name.lower() in cols_lower:
                matched = cols_lower[name.lower()]
                break
        col_map[key] = matched

    # 2. Extract and clean features
    feat_keys = [k for k in ["ph", "soc", "clay", "sand", "elevation", "slope", "aspect", "ndvi"] if col_map[k]]
    work = df[[col_map[k] for k in feat_keys]].copy()
    work.columns = feat_keys

    for k in ["lat", "lon"]:
        if col_map[k]:
            work[k] = df[col_map[k]]

    if col_map["suit"]:
        work["suit_raw"] = df[col_map["suit"]]
    else:
        # Compute suitability if missing
        work["suit_raw"] = (
            work["ndvi"] * 0.35 +
            (1.0 - np.clip(work["slope"] / 45.0, 0, 1)) * 0.25 +
            (1.0 - (work["ph"] - 6.5).abs() / 3.0).clip(0, 1) * 0.20 +
            np.clip(work["soc"] / 1200.0, 0, 1) * 0.20
        )

    work = work.replace(-32768, np.nan)
    work = work.dropna(subset=["ph", "clay", "sand", "elevation", "slope", "suit_raw"])
    for k in ["soc", "aspect", "ndvi"]:
        if k in work:
            work[k] = work[k].fillna(work[k].median())

    # Unit fixes
    if work["ph"].median() > 14:
        work["ph"] = work["ph"] / 10.0
    for k in ["clay", "sand"]:
        if work[k].median() > 100:
            work[k] = work[k] / 10.0
    work["ph"] = work["ph"].clip(3.5, 10.0)

    # Suitability to 0..1
    s = work["suit_raw"].astype(float)
    if s.nunique() <= 5:
        work["suit01"] = (s - s.min()) / (s.max() - s.min() + 1e-9)
    else:
        work["suit01"] = s / (100.0 if s.max() > 1.5 else 1.0)
    work["suit01"] = work["suit01"].clip(0.0, 1.0)

    # Fertility
    lo, hi = work["soc"].quantile([0.10, 0.90])
    work["fert"] = ((work["soc"] - lo) / (hi - lo + 1e-9)).clip(0.0, 1.0)

    # 3. Agronomic fit and Quota assignment
    FIT = fit_matrix(work)
    work["best_fit"] = FIT.max(axis=1)
    viable = work["best_fit"] >= FIT_MIN

    labels, _ = quota_assign(FIT[viable], TARGET_SHARE)
    work["rule_crop"] = FIT.idxmax(axis=1)
    work.loc[viable, "rule_crop"] = labels

    bad = FIT.values[np.arange(len(FIT)), [list(FIT.columns).index(c) for c in work["rule_crop"]]] <= 0
    work.loc[bad, "rule_crop"] = FIT.idxmax(axis=1)[bad]

    # 4. Filter eligible samples
    eligible = (work["suit01"] >= SUIT_GATE) & (work["best_fit"] >= FIT_MIN)
    counts = work.loc[eligible, "rule_crop"].value_counts()
    keep_crops = counts[counts >= MIN_CLASS_SAMPLES].index.tolist()
    if len(keep_crops) < 2:
        keep_crops = counts.index.tolist()

    train_df = work[eligible & work["rule_crop"].isin(keep_crops)].copy()
    features_present = [c for c in FEATURES if c in train_df.columns]

    X, y = train_df[features_present], train_df["rule_crop"]

    # 5. Spatial Block or Stratified Split
    if {"lat", "lon"} <= set(train_df.columns):
        block = (np.floor(train_df["lat"] / 0.05).astype(int).astype(str) + "_" +
                 np.floor(train_df["lon"] / 0.05).astype(int).astype(str))
        tr, te = next(GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=RANDOM_STATE).split(X, y, groups=block))
    else:
        tr, te = train_test_split(np.arange(len(X)), test_size=0.2, stratify=y, random_state=RANDOM_STATE)

    X_tr, y_tr, X_te, y_te = X.iloc[tr], y.iloc[tr], X.iloc[te], y.iloc[te]
    seen = y_te.isin(y_tr.unique())
    X_te, y_te = X_te[seen], y_te[seen]

    le = LabelEncoder().fit(y_tr)
    y_tr_e, y_te_e = le.transform(y_tr), le.transform(y_te)
    n_cls = len(le.classes_)

    models = {
        "RandomForest": RandomForestClassifier(
            n_estimators=300, min_samples_leaf=3, class_weight="balanced", n_jobs=-1, random_state=RANDOM_STATE
        ),
        "XGBoost": XGBClassifier(
            n_estimators=300, max_depth=6, learning_rate=0.1, subsample=0.9, colsample_bytree=0.9,
            objective="multi:softprob", eval_metric="mlogloss", random_state=RANDOM_STATE, n_jobs=-1
        ),
    }

    metrics = {}
    for name, m in models.items():
        m.fit(X_tr, y_tr_e)
        p = m.predict_proba(X_te)
        pred = p.argmax(axis=1)
        k = min(3, n_cls)
        metrics[name] = {
            "accuracy": round(float(accuracy_score(y_te_e, pred)), 4),
            "macro_f1": round(float(f1_score(y_te_e, pred, average="macro")), 4),
            f"top{k}_accuracy": round(float(top_k_accuracy_score(y_te_e, p, k=k, labels=np.arange(n_cls))), 4)
        }

    # Pick best model
    best_name = max(metrics.keys(), key=lambda k: metrics[k]["macro_f1"])
    if preferred_model in models:
        chosen_name = preferred_model
    else:
        chosen_name = best_name

    final_model = models[chosen_name].__class__(**models[chosen_name].get_params())
    y_all_e = le.transform(y.where(y.isin(le.classes_), le.classes_[0]))
    final_model.fit(X, y_all_e)

    # Save artifacts
    joblib.dump(final_model, MODEL_PATH)
    joblib.dump(le, ENCODER_PATH)

    _CACHED_MODEL = final_model
    _CACHED_LE = le

    metadata = {
        "best_model": chosen_name,
        "classes": list(le.classes_),
        "features": features_present,
        "metrics": metrics,
        "total_samples": len(train_df)
    }

    with open(METADATA_PATH, "w") as f:
        json.dump(metadata, f, indent=2)

    return metadata
