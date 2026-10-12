from fastapi import APIRouter, HTTPException

from app.models.schemas import (
    PlotInput,
    RecommendationResult,
    BatchRecommendationRequest,
    BatchRecommendationResponse,
    CropCatalogItem,
)
from app.services.agronomy import calculate_plot_fit
from app.services.ml_recommender import predict_single_plot
from app.config import CROPS, TARGET_SHARE

router = APIRouter(prefix="/recommend", tags=["Crop Recommendation"])


@router.post(
    "/plot",
    response_model=RecommendationResult,
    summary="Recommend crops for a single agricultural plot",
    description=(
        "Given soil and terrain features for one parcel, returns the recommended crop and top-3 ranked "
        "alternatives with confidence probabilities. Uses the trained ML model (RandomForest/XGBoost) "
        "if available; otherwise falls back to the agronomic fuzzy-logic knowledge base. "
        "Applies Module 2 suitability gating (SUIT_GATE=0.5) and slope/fit constraints."
    ),
)
async def recommend_for_plot(plot: PlotInput):
    try:
        result = predict_single_plot(
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
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Recommendation failed: {e}")


@router.post(
    "/batch",
    response_model=BatchRecommendationResponse,
    summary="Recommend crops for multiple plots",
    description=(
        "Batch crop recommendation for a list of agricultural plots. "
        "Maximum 5000 plots per request. Returns per-plot recommendations and aggregate statistics."
    ),
)
async def batch_recommend(request: BatchRecommendationRequest):
    if not request.plots:
        raise HTTPException(status_code=400, detail="No plots provided.")
    if len(request.plots) > 5000:
        raise HTTPException(status_code=400, detail="Maximum 5000 plots per request.")

    results = []
    for plot in request.plots:
        try:
            result = predict_single_plot(
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
            results.append(result)
        except Exception as e:
            # Return a "not recommended" placeholder on error
            results.append(RecommendationResult(
                recommended=False,
                recommended_crop="Not recommended",
                not_recommended_reason=f"processing error: {e}",
                suitability_score=0.0,
                suitability_class="Low",
                agro_fit_top=0.0,
                top_recommendations=[],
            ))

    recommended_count = sum(1 for r in results if r.recommended)

    return BatchRecommendationResponse(
        total_plots=len(results),
        recommended_count=recommended_count,
        rejected_count=len(results) - recommended_count,
        results=results,
    )


@router.get(
    "/agro-fit",
    summary="Get raw agronomic fit scores for a single plot across all crops",
    description=(
        "Returns raw fuzzy-logic agronomic fit scores (0-1) for all 10 crops in the knowledge base, "
        "without any ML inference. Useful for debugging and understanding the knowledge base."
    ),
)
async def get_agro_fit(
    ph: float,
    clay: float,
    sand: float,
    slope: float,
    elevation: float,
    soc: float = 100.0,
):
    try:
        fit_scores = calculate_plot_fit(
            ph=ph, clay=clay, sand=sand, slope=slope, elevation=elevation, soc=soc
        )
        best_crop = max(fit_scores, key=fit_scores.get)
        return {
            "best_crop": best_crop,
            "best_fit_score": fit_scores[best_crop],
            "all_scores": dict(sorted(fit_scores.items(), key=lambda x: x[1], reverse=True)),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/crops",
    response_model=list[CropCatalogItem],
    summary="List the crop knowledge base",
    description="Returns all 10 crops in the agronomic knowledge base with their soil/terrain parameter ranges.",
)
async def list_crops():
    catalog = []
    for crop_name, params in CROPS.items():
        catalog.append(CropCatalogItem(
            crop=crop_name,
            target_share_ha=TARGET_SHARE.get(crop_name, 0),
            ph_range=list(params["ph"]),
            clay_range=list(params["clay"]),
            sand_range=list(params["sand"]),
            slope_range=list(params["slope"]),
            elevation_range=list(params["elev"]),
            fertility_weight=params["fert"],
        ))
    return sorted(catalog, key=lambda c: c.target_share_ha, reverse=True)
