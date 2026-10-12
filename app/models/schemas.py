from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class PlotInput(BaseModel):
    """Input features representing a single agricultural land parcel."""
    lat: Optional[float] = Field(default=None, description="Latitude in decimal degrees")
    lon: Optional[float] = Field(default=None, description="Longitude in decimal degrees")
    elevation: float = Field(..., ge=0, le=5000, description="Elevation in meters (SRTM)")
    slope: float = Field(..., ge=0, le=90, description="Slope in degrees")
    aspect: Optional[float] = Field(default=0.0, ge=0, le=360, description="Aspect in degrees (0-360)")
    ndvi: float = Field(..., ge=-1.0, le=1.0, description="Normalized Difference Vegetation Index")
    phh2o: float = Field(..., ge=3.0, le=11.0, description="Soil pH (in H2O)")
    soc: float = Field(..., ge=0.0, le=5000.0, description="Soil Organic Carbon (raw or dg/kg)")
    clay: float = Field(..., ge=0.0, le=100.0, description="Clay content percentage (0-100%)")
    sand: float = Field(..., ge=0.0, le=100.0, description="Sand content percentage (0-100%)")


class SuitabilityEvaluationResult(BaseModel):
    """Module 2: Land and soil suitability score and classification."""
    suitability_score: float = Field(..., description="Normalized composite suitability score (0.0 to 1.0)")
    suitability_class: str = Field(..., description="Suitability class: High, Moderate, or Low")
    components: Dict[str, float] = Field(..., description="Component scores contributing to overall suitability")


class CropRecommendation(BaseModel):
    """Individual ranked crop recommendation."""
    rank: int
    crop: str
    probability: float
    agronomic_fit: Optional[float] = None


class RecommendationResult(BaseModel):
    """Comprehensive recommendation output for a plot."""
    recommended: bool
    recommended_crop: str
    not_recommended_reason: str
    suitability_score: float
    suitability_class: str
    agro_fit_top: float
    top_recommendations: List[CropRecommendation]


class BatchRecommendationRequest(BaseModel):
    """Batch recommendation request containing multiple plots."""
    plots: List[PlotInput]


class BatchRecommendationResponse(BaseModel):
    total_plots: int
    recommended_count: int
    rejected_count: int
    results: List[RecommendationResult]


class DistrictInfo(BaseModel):
    dtname: str
    bounds: List[float]


class GridGenerationRequest(BaseModel):
    district_name: str = Field(default="Coimbatore", description="Tamil Nadu district name")
    spacing: float = Field(default=0.01, ge=0.002, le=0.1, description="Grid spacing in degrees (~0.01 deg is ~1km)")


class GridPoint(BaseModel):
    lon: float
    lat: float


class GridGenerationResponse(BaseModel):
    district_name: str
    total_points: int
    spacing: float
    points: List[GridPoint]


class CropCatalogItem(BaseModel):
    crop: str
    target_share_ha: int
    ph_range: List[float]
    clay_range: List[float]
    sand_range: List[float]
    slope_range: List[float]
    elevation_range: List[float]
    fertility_weight: float


class ModelTrainResponse(BaseModel):
    status: str
    best_model: str
    total_samples: int
    features: List[str]
    classes: List[str]
    metrics: Dict[str, Dict[str, float]]
    message: str
