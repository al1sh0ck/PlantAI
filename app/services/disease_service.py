"""
Disease / knowledge-base service.
Loads from JSON file; generates defaults if not exists.
"""
import json
from pathlib import Path
from typing import Optional

KB_PATH = Path("app/knowledge_base/diseases.json")


class DiseaseService:
    def __init__(self):
        self._kb = self._load()

    def _load(self) -> dict:
        """Load knowledge base from JSON, create from scratch if missing"""
        if KB_PATH.exists():
            with open(KB_PATH) as f:
                return json.load(f)
        return {}  # Пустой — потом заполним из class_names.json

    def _save(self):
        """Save current KB to disk"""
        KB_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(KB_PATH, "w") as f:
            json.dump(self._kb, f, indent=2, ensure_ascii=False)

    def generate_from_class_names(self, class_names: list):
        """
        Автоматически генерирует записи для всех классов,
        если их нет в knowledge base.
        """
        from app.services.predictor import ml_predictor  # lazy import

        class_names = ml_predictor.class_names

        for class_name in class_names:
            if class_name not in self._kb:
                # Генерируем запись по умолчанию
                is_healthy = "healthy" in class_name.lower()
                self._kb[class_name] = {
                    "id": class_name.lower().replace("___", "_").replace(" ", "_"),
                    "name": class_name.replace("___", " - ").replace("_", " "),
                    "severity": "none" if is_healthy else "medium",
                    "description": f"Disease or condition: {class_name}" if not is_healthy else "Healthy plant, no disease detected",
                    "symptoms": ["Check plant for visual symptoms"] if not is_healthy else ["No visible symptoms"],
                    "causes": "Unknown" if not is_healthy else "Good growing conditions",
                    "treatment": {
                        "immediate": ["Monitor plant closely"],
                        "preventive": ["Maintain good growing practices"],
                        "chemical": "Not specified",
                        "organic": "Not specified"
                    }
                }
        self._save()
        print(f"[DiseaseService] Generated {len(class_names)} disease records")

    def list_diseases(self) -> list:
        return list(self._kb.values())

    def get_by_id(self, disease_id: str) -> Optional[dict]:
        for info in self._kb.values():
            if info["id"] == disease_id:
                return info
        return None

    def get_by_class(self, class_name: str) -> dict:
        """Get disease info by class name (folder name from dataset)"""
        if class_name in self._kb:
            return self._kb[class_name]

        # Fallback: ищем healthy или generic
        if "healthy" in class_name.lower():
            return {
                "id": "healthy",
                "name": "Healthy Plant",
                "severity": "none",
                "description": "Plant appears healthy",
                "symptoms": ["No visible symptoms"],
                "causes": "Good growing conditions",
                "treatment": {"immediate": ["Continue good practices"], "preventive": [], "chemical": "", "organic": ""}
            }

        # Generic fallback
        return {
            "id": class_name.lower().replace("___", "_"),
            "name": class_name.replace("___", " - ").replace("_", " "),
            "severity": "unknown",
            "description": f"Information about {class_name}",
            "symptoms": ["Please consult a plant disease specialist"],
            "causes": "Unknown",
            "treatment": {"immediate": ["Isolate plant"], "preventive": [], "chemical": "", "organic": ""}
        }


disease_service = DiseaseService()