from fastapi import APIRouter, HTTPException

from app.models.schemas import PlotInput, SuitabilityEvaluationResult
from app.services.suitability import evaluate_single_suitability

router = APIRouter(prefix="/suitability", tags=["Suitability"])


@router.post(
    "/evaluate",
    response_model=SuitabilityEvaluationResult,
    summary="Evaluate land suitability for a single plot",
    description=(
        "Computes a composite land suitability score (0.0 - 1.0) for an input parcel using "
        "NDVI (35%), Slope (25%), pH (20%), and SOC (20%) weighted factors. "
        "Returns score, class (High / Moderate / Low), and per-component breakdown."
    ),
)
async def evaluate_suitability(plot: PlotInput):
    try:
        score, suit_class, components = evaluate_single_suitability(
            ndvi=plot.ndvi,
            slope=plot.slope,
            phh2o=plot.phh2o,
            soc=plot.soc,
        )
        return SuitabilityEvaluationResult(
            suitability_score=score,
            suitability_class=suit_class,
            components=components,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Suitability evaluation failed: {e}")


@router.post(
    "/batch-evaluate",
    summary="Evaluate suitability for multiple plots",
    description=(
        "Batch version of /suitability/evaluate. "
        "Accepts a list of plot inputs and returns suitability scores for all."
    ),
)
async def batch_evaluate_suitability(plots: list[PlotInput]):
    if not plots:
        raise HTTPException(status_code=400, detail="No plots provided.")
    if len(plots) > 5000:
        raise HTTPException(status_code=400, detail="Maximum 5000 plots per batch request.")

    results = []
    for i, plot in enumerate(plots):
        try:
            score, suit_class, components = evaluate_single_suitability(
                ndvi=plot.ndvi,
                slope=plot.slope,
                phh2o=plot.phh2o,
                soc=plot.soc,
            )
            results.append({
                "index": i,
                "lat": plot.lat,
                "lon": plot.lon,
                "suitability_score": score,
                "suitability_class": suit_class,
                "components": components,
            })
        except Exception as e:
            results.append({"index": i, "error": str(e)})

    return {"total": len(results), "results": results}
