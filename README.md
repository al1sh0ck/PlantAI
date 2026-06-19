# 🌿 PlantAI — Plant Health Detection System

AI-powered plant disease detection backend built with FastAPI + PyTorch (EfficientNet-B0) + PostgreSQL + JWT Auth.

## Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Backend    | FastAPI 0.111                       |
| ML         | PyTorch + EfficientNet-B0           |
| Database   | PostgreSQL + SQLAlchemy + Alembic   |
| Auth       | JWT (python-jose) + bcrypt          |
| Frontend   | Vanilla JS + CSS (no frameworks)    |
| Deploy     | Docker + docker-compose             |

---

## Project Structure

```
plantai/
├── app/
│   ├── main.py                  # FastAPI app entry point
│   ├── api/routes/
│   │   ├── auth.py              # POST /register, /login, /refresh, GET /me
│   │   ├── predict.py           # POST /predict, GET /predictions
│   │   ├── diseases.py          # GET /diseases, /diseases/{id}, /crops
│   │   └── users.py             # GET /users/me, /users/me/stats
│   ├── core/
│   │   ├── config.py            # Settings from .env
│   │   ├── database.py          # SQLAlchemy engine + session
│   │   └── security.py          # JWT + password hashing
│   ├── models/
│   │   ├── user.py              # User ORM model
│   │   └── prediction.py        # Prediction history ORM model
│   ├── schemas/
│   │   ├── auth.py              # Pydantic schemas for auth
│   │   └── prediction.py        # Pydantic schemas for predictions
│   └── services/
│       ├── predictor.py         # ML inference service (singleton)
│       ├── auth_service.py      # Register/login/refresh logic
│       └── disease_service.py   # Disease knowledge base
├── frontend/
│   ├── index.html               # Main HTML
│   ├── style.css                # All styles
│   └── app.js                   # Auth + predict + history logic
├── models/                      # Trained .pth weights go here
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── run.py
```

---

## API Endpoints

### Auth
```
POST /api/v1/auth/register    — Create account
POST /api/v1/auth/login       — Get JWT tokens
POST /api/v1/auth/refresh     — Refresh access token
GET  /api/v1/auth/me          — Get current user
```

### Predict
```
POST /api/v1/predict          — Analyze plant image (auth required)
GET  /api/v1/predictions      — Get your prediction history (auth required)
```

### Diseases
```
GET  /api/v1/diseases         — List all disease classes
GET  /api/v1/diseases/{id}    — Get disease by ID
GET  /api/v1/crops            — List supported crops
```

### System
```
GET  /api/v1/health           — Health check + model status
```

---

## Quick Start (local)

```bash
# 1. Clone and setup env
cp .env.example .env
# Edit .env with your SECRET_KEY and DATABASE_URL

# 2. Install dependencies
pip install -r requirements.txt

# 3. Start PostgreSQL (or use docker)
docker run -d -e POSTGRES_USER=plantai -e POSTGRES_PASSWORD=plantai \
           -e POSTGRES_DB=plantai_db -p 5432:5432 postgres:16-alpine

# 4. Run the app (auto-creates tables on startup)
python run.py

# 5. Open http://localhost:8000
# 6. Swagger docs at http://localhost:8000/docs
```

## Docker Compose

```bash
docker-compose up --build
```

---

## Training

```bash
python train.py --data_dir ./data/PlantHealth --epochs 30 --batch_size 32
# Saves weights to models/plantai_efficientnet_b0.pth
```

## ML Classes

[PlantAI] Classes (15): ['Pepper__bell___Bacterial_spot', 'Pepper__bell___healthy', 'Potato___Early_blight', 'Potato___Late_blight', 'Potato___healthy', 'Tomato_Bacterial_spot', 'Tomato_Early_blight', 'Tomato_Late_blight', 'Tomato_Leaf_Mold', 'Tomato_Septoria_leaf_spot', 'Tomato_Spider_mites_Two_spotted_spider_mite', 'Tomato__Target_Spot', 'Tomato__Tomato_YellowLeaf__Curl_Virus', 'Tomato__Tomato_mosaic_virus', 'Tomato_healthy']

