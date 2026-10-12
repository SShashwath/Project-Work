import os
from typing import Dict, List, Optional
import geopandas as gpd
import numpy as np
from shapely.geometry import Point

from app.config import GEOJSON_FILE

_CACHED_GDF: Optional[gpd.GeoDataFrame] = None


def get_tamil_nadu_districts() -> gpd.GeoDataFrame:
    """Load and cache the Tamil Nadu districts GeoJSON."""
    global _CACHED_GDF
    if _CACHED_GDF is None:
        if not os.path.exists(GEOJSON_FILE):
            raise FileNotFoundError(f"GeoJSON file not found at: {GEOJSON_FILE}")
        _CACHED_GDF = gpd.read_file(str(GEOJSON_FILE))
    return _CACHED_GDF


def list_district_names() -> List[Dict[str, any]]:
    """Return a list of all district names and their bounding boxes."""
    gdf = get_tamil_nadu_districts()
    districts = []
    col_name = "dtname" if "dtname" in gdf.columns else gdf.columns[0]
    
    for _, row in gdf.iterrows():
        bounds = list(row.geometry.bounds)
        districts.append({
            "dtname": str(row[col_name]),
            "bounds": [round(b, 4) for b in bounds]
        })
    return sorted(districts, key=lambda d: d["dtname"])


def get_district_boundary(district_name: str) -> gpd.GeoDataFrame:
    """Retrieve the boundary polygon for a specific district (case-insensitive)."""
    gdf = get_tamil_nadu_districts()
    col_name = "dtname" if "dtname" in gdf.columns else gdf.columns[0]
    
    matches = gdf[gdf[col_name].str.lower() == district_name.strip().lower()]
    if matches.empty:
        available = gdf[col_name].tolist()
        raise ValueError(f"District '{district_name}' not found. Available districts: {available}")
    return matches


def generate_plot_grid(district_name: str = "Coimbatore", spacing: float = 0.01) -> gpd.GeoDataFrame:
    """
    Generate a uniform coordinate grid (lon, lat points) clipped to the district boundary.
    Spacing ~0.01 deg (~1 km).
    """
    study_area = get_district_boundary(district_name)
    bounds = study_area.total_bounds  # minx, miny, maxx, maxy
    
    xs = np.arange(bounds[0], bounds[2], spacing)
    ys = np.arange(bounds[1], bounds[3], spacing)
    
    grid_points = [Point(x, y) for x in xs for y in ys]
    grid_gdf = gpd.GeoDataFrame(geometry=grid_points, crs=study_area.crs)
    
    # Clip points to the actual district boundary polygon
    plot_grid = gpd.clip(grid_gdf, study_area)
    return plot_grid
