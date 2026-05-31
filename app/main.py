"""
PlantAI - AI-Powered Plant Disease Detection API
FastAPI + PyTorch (EfficientNet-B0) + PostgreSQL + JWT Auth
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path

from app.core.config import settings
from app.core.database import engine, Base
from app.api.routes import auth, predict, diseases, users
from app.services.predictor import ml_predictor
from app.services.disease_service import disease_service  # ← НОВЫЙ ИМПОРТ

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("plantai")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting PlantAI API...")
    Base.metadata.create_all(bind=engine)
    ml_predictor.load()

    # Generate disease knowledge base from class names
    if ml_predictor.class_names:
        disease_service.generate_from_class_names(ml_predictor.class_names)
        logger.info(f"Disease KB ready: {len(disease_service.list_diseases())} entries")

    logger.info("PlantAI ready.")
    yield
    # Shutdown
    logger.info("Shutting down PlantAI API...")


app = FastAPI(
    title="PlantAI API",
    description="AI-powered plant health detection: 38 plant diseases classification",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Routers
app.include_router(auth.router,     prefix="/api/v1/auth",      tags=["Auth"])
app.include_router(users.router,    prefix="/api/v1/users",     tags=["Users"])
app.include_router(predict.router,  prefix="/api/v1",           tags=["Predict"])
app.include_router(diseases.router, prefix="/api/v1",           tags=["Diseases"])


@app.get("/api/v1/health", tags=["System"])
async def health_check():
    return {
        "status": "ok",
        "model_loaded": ml_predictor.is_loaded,
        "device": ml_predictor.device_name,
        "classes": len(ml_predictor.class_names),  # ← ИСПРАВЛЕНО: показывает количество
        "version": "2.0.0",
    }


# Serve frontend
static_path = Path("frontend")
if static_path.exists():
    app.mount("/static", StaticFiles(directory="frontend"), name="static")

    @app.get("/")
    async def serve_frontend():
        return FileResponse("frontend/index.html")