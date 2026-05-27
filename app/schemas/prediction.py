from pydantic import BaseModel
from typing import List, Optional, Any
from datetime import datetime


class ClassProb(BaseModel):
    class_name:   str
    display_name: str
    confidence:   float


class PredictionResult(BaseModel):
    predicted_class: str
    display_name:    str
    confidence:      float
    severity:        str
    all_classes:     List[ClassProb]


class PredictionMeta(BaseModel):
    inference_ms: float
    image_size:   str
    device:       str
    model:        str
    demo_mode:    bool


class PredictResponse(BaseModel):
    prediction:   PredictionResult
    disease_info: Any
    meta:         PredictionMeta


class PredictionHistory(BaseModel):
    id:              int
    predicted_class: str
    display_name:    str
    confidence:      float
    severity:        str
    inference_ms:    Optional[float]
    created_at:      datetime

    class Config:
        from_attributes = True
