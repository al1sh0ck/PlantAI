from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base


class Prediction(Base):
    __tablename__ = "predictions"

    id              = Column(Integer, primary_key=True, index=True)
    user_id         = Column(Integer, ForeignKey("users.id"), nullable=True)
    predicted_class = Column(String, nullable=False)
    display_name    = Column(String, nullable=False)
    confidence      = Column(Float, nullable=False)
    severity        = Column(String, nullable=False)
    all_classes     = Column(JSON, nullable=True)   # top-3 probabilities
    image_size      = Column(String, nullable=True)
    inference_ms    = Column(Float, nullable=True)
    device          = Column(String, nullable=True)
    demo_mode       = Column(String, default="false")
    created_at      = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="predictions")
