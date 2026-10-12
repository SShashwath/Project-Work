from fastapi import APIRouter, HTTPException, Query
from typing import List

from app.models.schemas import DistrictInfo, GridGenerationRequest, GridGenerationResponse, GridPoint
from app.services.geo_service import (
    list_district_names,
    generate_plot_grid,
    get_district_boundary,
)

router = APIRouter(prefix="/geo", tags=["Geospatial"])


@router.get(
    "/districts",
    response_model=List[DistrictInfo],
    summary="List all Tamil Nadu districts",
    description="Returns all district names and bounding boxes from the loaded GeoJSON file.",
)
async def get_districts():
    try:
        return list_district_names()
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading districts: {e}")


@router.get(
    "/districts/{district_name}/bounds",
    summary="Get bounding box for a specific district",
    description="Returns [minx, miny, maxx, maxy] bounds for the requested district.",
)
async def get_district_bounds(district_name: str):
    try:
        study_area = get_district_boundary(district_name)
        bounds = list(study_area.total_bounds)
        return {
            "district": district_name,
            "bounds": [round(b, 5) for b in bounds],
            "description": "[minLon, minLat, maxLon, maxLat]"
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/generate-grid",
    response_model=GridGenerationResponse,
    summary="Generate a plot grid clipped to a district boundary",
    description=(
        "Creates a regular lon/lat coordinate grid inside the given district polygon. "
        "Default spacing of 0.01° ≈ 1km. Returns all sampled points for further analysis."
    ),
)
async def generate_grid(request: GridGenerationRequest):
    try:
        grid_gdf = generate_plot_grid(district_name=request.district_name, spacing=request.spacing)
        
        points = [
            GridPoint(lon=round(geom.x, 5), lat=round(geom.y, 5))
            for geom in grid_gdf.geometry
        ]

        return GridGenerationResponse(
            district_name=request.district_name,
            total_points=len(points),
            spacing=request.spacing,
            points=points,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Grid generation failed: {e}")
