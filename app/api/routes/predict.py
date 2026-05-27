import io
import logging
from typing import Optional

from fastapi import APIRouter, File, UploadFile, HTTPException, Depends
from PIL import Image
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.prediction import Prediction
from app.schemas.prediction import PredictResponse, PredictionHistory
from app.services.predictor import ml_predictor
from app.services.disease_service import disease_service

logger = logging.getLogger("plantai.predict")
router = APIRouter()

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}


@router.post("/predict", response_model=PredictResponse)
async def predict(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if not ml_predictor.is_loaded:
        raise HTTPException(status_code=503, detail="Model not loaded yet")
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid file type. Allowed: jpeg, png, webp")

    try:
        image_bytes = await file.read()
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot read image: {e}")

    try:
        result = ml_predictor.predict(image)
    except Exception as e:
        logger.error(f"Inference error: {e}")
        raise HTTPException(status_code=500, detail=f"Inference error: {e}")

    disease_info = disease_service.get_by_class(result["predicted_class"])

    # Save to prediction history
    pred_record = Prediction(
        user_id=current_user.id if current_user else None,
        predicted_class=result["predicted_class"],
        display_name=result["display_name"],
        confidence=result["confidence"],
        severity=disease_info.get("severity", "none"),
        all_classes=result["all_classes"],
        image_size=f"{image.width}x{image.height}",
        inference_ms=result["inference_ms"],
        device=ml_predictor.device_name,
        demo_mode=str(result["demo_mode"]),
    )
    db.add(pred_record)
    db.commit()

    return {
        "prediction": {
            "predicted_class": result["predicted_class"],
            "display_name":    result["display_name"],
            "confidence":      result["confidence"],
            "severity":        disease_info.get("severity", "none"),
            "all_classes":     result["all_classes"],
        },
        "disease_info": disease_info,
        "meta": {
            "inference_ms": result["inference_ms"],
            "image_size":   f"{image.width}x{image.height}",
            "device":       ml_predictor.device_name,
            "model":        "EfficientNet-B0",
            "demo_mode":    result["demo_mode"],
        },
    }


@router.get("/predictions", response_model=list[PredictionHistory])
def get_predictions(
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return (
        db.query(Prediction)
        .filter(Prediction.user_id == current_user.id)
        .order_by(Prediction.created_at.desc())
        .limit(limit)
        .all()
    )
