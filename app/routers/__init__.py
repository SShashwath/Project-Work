from .geo import router as geo_router
from .suitability import router as suitability_router
from .recommend import router as recommend_router
from .train import router as train_router
from .data_pipeline import router as data_pipeline_router
from .yield_prediction import router as yield_router

__all__ = [
    "geo_router",
    "suitability_router",
    "recommend_router",
    "train_router",
    "data_pipeline_router",
    "yield_router",
]

