"""
ML inference service — EfficientNet-B0 plant disease classifier.
Loaded once at startup, reused for every request.
"""
import json
import logging
import time
from pathlib import Path
from typing import Optional

import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image

from app.core.config import settings

logger = logging.getLogger("plantai.predictor")

TRANSFORM = transforms.Compose([
    transforms.Resize((256, 256)),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])


def _build_model(num_classes: int) -> nn.Module:
    model = models.efficientnet_b0(weights=models.EfficientNet_B0_Weights.IMAGENET1K_V1)
    in_features = model.classifier[1].in_features
    model.classifier = nn.Sequential(
        nn.Dropout(p=0.3, inplace=True),
        nn.Linear(in_features, num_classes),
    )
    return model


class MLPredictor:
    def __init__(self):
        self._model: Optional[nn.Module] = None
        self._device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self._class_names: list = []  # ← Будет загружено из JSON
        self._demo_mode: bool = True

    # ── Properties ──────────────────────────────────────────
    @property
    def is_loaded(self) -> bool:
        return self._model is not None

    @property
    def class_names(self) -> list:
        return self._class_names

    @property
    def device_name(self) -> str:
        return str(self._device)

    @property
    def demo_mode(self) -> bool:
        return self._demo_mode

    # ── Load ────────────────────────────────────────────────
    def load(self):
        # Load class names from JSON (ОБЯЗАТЕЛЬНО!)
        cn_path = Path(settings.CLASS_NAMES_PATH)
        if cn_path.exists():
            with open(cn_path) as f:
                self._class_names = json.load(f)
            logger.info(f"Loaded {len(self._class_names)} class names from {cn_path}")
        else:
            raise FileNotFoundError(f"class_names.json not found at {cn_path}. Run training first!")

        # Build model with correct number of classes
        self._model = _build_model(len(self._class_names))

        # Load trained weights
        weights_path = Path(settings.MODEL_PATH)
        if weights_path.exists():
            self._model.load_state_dict(torch.load(weights_path, map_location=self._device))
            self._demo_mode = False
            logger.info(f"Loaded trained weights from {weights_path}")
        else:
            logger.warning(f"Weights not found at {weights_path} — running in demo mode (random init).")
            # В демо-режиме всё равно нужно нормально инициализировать последний слой
            self._model.classifier[1].weight.data.normal_(0, 0.01)
            self._model.classifier[1].bias.data.zero_()

        self._model.to(self._device)
        self._model.eval()
        logger.info(f"Model ready on {self._device} | {len(self._class_names)} classes")

    # ── Predict ─────────────────────────────────────────────
    def predict(self, image: Image.Image) -> dict:
        if self._model is None:
            raise RuntimeError("Model not loaded")

        t0 = time.time()
        tensor = TRANSFORM(image).unsqueeze(0).to(self._device)

        with torch.no_grad():
            logits = self._model(tensor)
            probs  = torch.softmax(logits, dim=1)
            conf, idx = torch.max(probs, dim=1)

        inference_ms = round((time.time() - t0) * 1000, 1)
        predicted_class = self._class_names[idx.item()]
        confidence      = round(conf.item() * 100, 2)

        all_classes = sorted(
            [
                {
                    "class_name":   self._class_names[i],
                    "display_name": self._class_names[i].replace("_", " ").replace("___", " - "),
                    "confidence":   round(probs[0][i].item() * 100, 2),
                }
                for i in range(len(self._class_names))
            ],
            key=lambda x: x["confidence"],
            reverse=True,
        )[:10]  # Топ-10 чтобы не перегружать фронтенд

        logger.info(f"Prediction: {predicted_class} ({confidence:.1f}%) in {inference_ms}ms")

        return {
            "predicted_class": predicted_class,
            "display_name":    predicted_class.replace("_", " ").replace("___", " - "),
            "confidence":      confidence,
            "all_classes":     all_classes,
            "inference_ms":    inference_ms,
            "demo_mode":       self._demo_mode,
        }


# Singleton
ml_predictor = MLPredictor()