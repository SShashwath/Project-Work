import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.routers import geo_router, suitability_router, recommend_router, train_router, data_pipeline_router
from app.services.ml_recommender import get_model_status


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    status = get_model_status()
    if status["is_trained"]:
        print("✅ Trained ML model found — loading into memory.")
        from app.services.ml_recommender import load_model_and_encoder
        load_model_and_encoder()
    else:
        print("⚠️  No trained model found. Using agronomic fuzzy-logic fallback.")
        print("   → Upload a CSV via POST /train/run or /train/run-from-path to train the model.")
    yield


app = FastAPI(
    title="🌾 AgriSense — Land Suitability & Crop Recommendation API",
    description=(
        "FastAPI backend for the Agricultural Land Suitability and Crop Recommendation system. "
        "Implements the three-module pipeline from the Coimbatore district project notebook:\n\n"
        "- **Module 1**: Spatial data ingestion (GeoJSON districts, plot grid generation)\n"
        "- **Module 2**: Land suitability scoring (NDVI, slope, pH, SOC weighted composite)\n"
        "- **Module 3**: Crop recommendation (XGBoost/RandomForest with agronomic knowledge base fallback)\n\n"
        "Use `POST /train/run` to train the ML model on your labeled dataset, "
        "then `POST /recommend/plot` for inference."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS — allow all origins (tighten for production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(geo_router)
app.include_router(suitability_router)
app.include_router(recommend_router)
app.include_router(train_router)
app.include_router(data_pipeline_router)


@app.get("/", tags=["Root"])
async def root():
    """Health check and API overview."""
    status = get_model_status()
    return {
        "service": "AgriSense API",
        "version": "1.0.0",
        "status": "running",
        "model_trained": status["is_trained"],
        "model_info": status.get("metadata", {}),
        "docs": "/docs",
        "endpoints": {
            "geo": {
                "list_districts": "GET /geo/districts",
                "district_bounds": "GET /geo/districts/{name}/bounds",
                "generate_grid": "POST /geo/generate-grid",
            },
            "suitability": {
                "evaluate": "POST /suitability/evaluate",
                "batch_evaluate": "POST /suitability/batch-evaluate",
            },
            "recommend": {
                "single_plot": "POST /recommend/plot",
                "batch": "POST /recommend/batch",
                "agro_fit_debug": "GET /recommend/agro-fit",
                "crop_catalog": "GET /recommend/crops",
            },
            "data_pipeline": {
                "status": "GET /data/status",
                "run_step_bg": "POST /data/run-step/{1-6}",
                "run_step_sync": "POST /data/run-step/{1-6}/sync",
                "download_file": "GET /data/download/{filename}",
            },
            "training": {
                "status": "GET /train/status",
                "train_upload": "POST /train/run",
                "train_from_path": "POST /train/run-from-path",
            },
        },
    }


@app.get("/health", tags=["Root"])
async def health():
    return {"status": "ok"}
