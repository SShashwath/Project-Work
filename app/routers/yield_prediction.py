from typing import Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query
import pandas as pd

from app.models.schemas import YieldPredictInput, YieldPredictionResult
from app.services.yield_service import predict_plot_yield, get_crop_benchmarks, load_yield_model
from app.services.ml_recommender import predict_single_plot
from app.config import DATA_DIR

router = APIRouter(prefix="/yield", tags=["Module 4 — Crop Yield Prediction"])
YIELD_PREDS_CSV = DATA_DIR / "coimbatore_yield_predictions.csv"


@router.post(
    "/predict",
    response_model=YieldPredictionResult,
    summary="Forecast crop yield for an agricultural plot (Module 4)",
    description=(
        "Uses the multi-input PyTorch LSTM neural network to predict the crop yield index "
        "and expected yield (kg/ha). Evaluates 12-month temporal Sentinel-2 vegetation dynamics "
        "fused with terrain and soil properties."
    ),
)
async def forecast_yield(plot: YieldPredictInput):
    target_crop = plot.crop
    suit_score = 0.7  # default

    # If crop is not explicitly specified, recommend best viable crop
    if not target_crop:
        rec = predict_single_plot(
            elevation=plot.elevation,
            slope=plot.slope,
            aspect=plot.aspect or 0.0,
            ndvi=plot.ndvi,
            phh2o=plot.phh2o,
            soc=plot.soc,
            clay=plot.clay,
            sand=plot.sand,
            lat=plot.lat,
            lon=plot.lon,
        )
        suit_score = rec.suitability_score
        if rec.recommended and rec.recommended_crop != "Not recommended":
            target_crop = rec.recommended_crop
        elif rec.top_recommendations:
            target_crop = rec.top_recommendations[0].crop
        else:
            target_crop = "Coconut"

    try:
        prediction = predict_plot_yield(
            crop=target_crop,
            elevation=plot.elevation,
            slope=plot.slope,
            phh2o=plot.phh2o,
            soc=plot.soc,
            clay=plot.clay,
            sand=plot.sand,
            suitability_score=suit_score,
            ndvi=plot.ndvi,
        )
        return prediction
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Yield forecasting failed: {e}")


@router.get(
    "/stats",
    summary="Get regional crop yield statistics and benchmarks",
    description="Returns official Coimbatore district benchmark yields and typical operational ranges for 10 crops.",
)
async def get_stats():
    return get_crop_benchmarks()


@router.get(
    "/status",
    summary="Check Module 4 LSTM model status and metadata",
)
async def get_status():
    _, meta = load_yield_model()
    return {
        "status": "ready",
        "model_architecture": "MultiInputYieldLSTM (PyTorch)",
        "temporal_input_shape": [12, 2],
        "crops": meta.get("crops", []),
        "overall_model_mae": meta.get("overall_model_mae"),
        "overall_base_mae": meta.get("overall_base_mae"),
        "total_trained_samples": meta.get("total_trained_samples"),
        "last_year": meta.get("last_year"),
    }


@router.get(
    "/plots",
    summary="Retrieve precomputed plot yield predictions for Coimbatore",
)
async def get_plot_yields(
    crop: Optional[str] = Query(default=None, description="Filter by crop name"),
    limit: int = Query(default=100, ge=1, le=1000, description="Max rows to return"),
    offset: int = Query(default=0, ge=0, description="Offset for pagination"),
):
    if not YIELD_PREDS_CSV.exists():
        raise HTTPException(status_code=404, detail="Yield predictions dataset not found. Run step07 first.")
    
    df = pd.read_csv(YIELD_PREDS_CSV)
    if crop:
        df = df[df["recommended_crop"].str.lower() == crop.lower()]
    
    total = len(df)
    page = df.iloc[offset : offset + limit].to_dict(orient="records")
    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "plots": page,
    }
