from fastapi import APIRouter, HTTPException
from app.services.disease_service import disease_service

router = APIRouter()


@router.get("/diseases")
def list_diseases():
    diseases = disease_service.list_diseases()
    return {"diseases": diseases, "total": len(diseases)}


@router.get("/diseases/{disease_id}")
def get_disease(disease_id: str):
    disease = disease_service.get_by_id(disease_id)
    if not disease:
        raise HTTPException(status_code=404, detail=f"Disease '{disease_id}' not found")
    return disease


@router.get("/crops")
def list_crops():
    """Placeholder: returns supported crop categories."""
    return {
        "crops": [
            {"id": "tomato",   "name": "Tomato",   "icon": "🍅"},
            {"id": "potato",   "name": "Potato",   "icon": "🥔"},
            {"id": "corn",     "name": "Corn",     "icon": "🌽"},
            {"id": "wheat",    "name": "Wheat",    "icon": "🌾"},
            {"id": "rice",     "name": "Rice",     "icon": "🌾"},
            {"id": "soybean",  "name": "Soybean",  "icon": "🫘"},
            {"id": "grape",    "name": "Grape",    "icon": "🍇"},
            {"id": "apple",    "name": "Apple",    "icon": "🍎"},
        ],
        "total": 8,
    }
