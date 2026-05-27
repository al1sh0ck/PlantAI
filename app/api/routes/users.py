from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.prediction import Prediction
from app.schemas.auth import UserOut

router = APIRouter()


@router.get("/me", response_model=UserOut)
def get_me(current_user=Depends(get_current_user)):
    return current_user


@router.get("/me/stats")
def get_my_stats(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    total = db.query(Prediction).filter(Prediction.user_id == current_user.id).count()
    healthy = db.query(Prediction).filter(
        Prediction.user_id == current_user.id,
        Prediction.predicted_class == "Healthy"
    ).count()
    partial = db.query(Prediction).filter(
        Prediction.user_id == current_user.id,
        Prediction.predicted_class == "Partially_Healthy"
    ).count()
    unhealthy = db.query(Prediction).filter(
        Prediction.user_id == current_user.id,
        Prediction.predicted_class == "Unhealthy"
    ).count()

    return {
        "total_predictions": total,
        "by_class": {
            "Healthy":           healthy,
            "Partially_Healthy": partial,
            "Unhealthy":         unhealthy,
        },
    }
