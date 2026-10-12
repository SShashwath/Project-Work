import os
from pathlib import Path

# Base Paths
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
MODEL_DIR = BASE_DIR / "saved_models"
GEOJSON_FILE = BASE_DIR / "TAMIL NADU_DISTRICTS.geojson"

DATA_DIR.mkdir(parents=True, exist_ok=True)
MODEL_DIR.mkdir(parents=True, exist_ok=True)

# Model Artifact Paths
MODEL_PATH = MODEL_DIR / "crop_recommender.joblib"
ENCODER_PATH = MODEL_DIR / "label_encoder.joblib"
METADATA_PATH = MODEL_DIR / "model_metadata.json"

# Tunable Gates & Parameters
SUIT_GATE = 0.50          # suitability (0-1) below this -> "Not recommended"
FIT_MIN = 0.20            # best agronomic fit below this -> "Not recommended"
MIN_CLASS_SAMPLES = 15
RANDOM_STATE = 42
FEATURES = ["ph", "soc", "clay", "sand", "elevation", "slope", "aspect", "ndvi", "suit01"]

# Soil & Land Suitability Reference Ranges (Used for normalization when evaluating single plots)
REFERENCE_BOUNDS = {
    "NDVI": {"min": 0.0, "max": 1.0},
    "slope": {"min": 0.0, "max": 60.0},
    "phh2o": {"optimum": 6.5, "tolerance": 3.0},
    "soc": {"min": 0.0, "max": 1500.0},
}

# Agronomic Knowledge Base: 10 Target Crops
# Trapezoidal parameters (a, b, c, d):
# a = lower limit, b = optimum lower bound, c = optimum upper bound, d = upper limit
CROPS = {
    "Rice": {
        "ph": (4.5, 5.5, 7.5, 8.5),
        "clay": (15, 25, 50, 65),
        "sand": (0, 5, 45, 65),
        "slope": (0, 0, 2, 5),
        "elev": (0, 0, 700, 1500),
        "fert": 0.7,
    },
    "Sugarcane": {
        "ph": (5.0, 6.0, 8.0, 9.0),
        "clay": (10, 20, 45, 60),
        "sand": (5, 15, 55, 75),
        "slope": (0, 0, 3, 8),
        "elev": (0, 0, 900, 1400),
        "fert": 0.8,
    },
    "Maize": {
        "ph": (5.0, 5.8, 7.5, 8.5),
        "clay": (8, 15, 35, 50),
        "sand": (15, 30, 65, 80),
        "slope": (0, 0, 6, 15),
        "elev": (0, 0, 1500, 2500),
        "fert": 0.6,
    },
    "Cotton": {
        "ph": (5.5, 6.0, 8.0, 9.0),
        "clay": (15, 25, 55, 70),
        "sand": (0, 10, 50, 70),
        "slope": (0, 0, 4, 10),
        "elev": (0, 0, 800, 1200),
        "fert": 0.5,
    },
    "Groundnut": {
        "ph": (5.0, 5.8, 7.0, 8.0),
        "clay": (5, 8, 25, 40),
        "sand": (35, 50, 80, 90),
        "slope": (0, 0, 6, 12),
        "elev": (0, 0, 900, 1500),
        "fert": 0.3,
    },
    "Coconut": {
        "ph": (5.0, 5.5, 8.5, 9.0),
        "clay": (5, 10, 40, 55),
        "sand": (20, 35, 80, 90),
        "slope": (0, 0, 8, 20),
        "elev": (0, 0, 800, 1100),
        "fert": 0.5,
    },
    "Banana": {
        "ph": (5.5, 6.0, 7.5, 8.5),
        "clay": (10, 18, 40, 55),
        "sand": (10, 25, 60, 75),
        "slope": (0, 0, 4, 10),
        "elev": (0, 0, 900, 1500),
        "fert": 0.8,
    },
    "Sorghum": {
        "ph": (5.0, 5.8, 8.2, 9.0),
        "clay": (10, 18, 45, 60),
        "sand": (10, 20, 65, 80),
        "slope": (0, 0, 6, 15),
        "elev": (0, 0, 1000, 1800),
        "fert": 0.3,
    },
    "Turmeric": {
        "ph": (4.5, 5.5, 7.5, 8.5),
        "clay": (8, 15, 35, 50),
        "sand": (20, 35, 65, 80),
        "slope": (0, 0, 4, 10),
        "elev": (0, 0, 1200, 1600),
        "fert": 0.8,
    },
    "Pulses": {
        "ph": (5.5, 6.0, 7.5, 8.5),
        "clay": (10, 18, 40, 55),
        "sand": (15, 25, 65, 80),
        "slope": (0, 0, 6, 12),
        "elev": (0, 0, 1000, 1500),
        "fert": 0.3,
    },
}

# Target area distribution in hectares (Coimbatore District Agriculture Plan / TNAU 2017)
TARGET_SHARE = {
    "Coconut": 83887,
    "Sorghum": 25844,
    "Banana": 8126,
    "Pulses": 5730,
    "Groundnut": 5719,
    "Maize": 4562,
    "Rice": 2355,
    "Turmeric": 1518,
    "Sugarcane": 1338,
    "Cotton": 731,
}
