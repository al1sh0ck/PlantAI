# PlantAI 🌱

AI-powered plant disease detection system developed as a diploma project.

PlantAI is a full-stack application that combines deep learning, computer vision, and web technologies to help users identify plant diseases from leaf images and receive treatment recommendations.

## Features

* Plant disease detection using EfficientNet-B0
* Classification of 15 disease classes across 8 crop species
* JWT authentication and user management
* Prediction history storage
* PostgreSQL database integration
* REST API with FastAPI
* Mobile-friendly frontend
* Dockerized deployment
* Swagger API documentation

## Tech Stack

### Backend

* FastAPI
* SQLAlchemy
* PostgreSQL
* Alembic
* JWT Authentication
* Docker

### Machine Learning

* PyTorch
* TorchVision
* EfficientNet-B0
* NumPy
* Scikit-learn

### Frontend

* HTML5
* CSS3
* Vanilla JavaScript

### Mobile Client

* Android WebView
* Kotlin

## Architecture

```text
User
  │
  ▼
Frontend (HTML/CSS/JS)
  │
  ▼
FastAPI Backend
  │
  ├── JWT Authentication
  ├── Disease Knowledge Base
  ├── Prediction Service
  └── User Management
  │
  ▼
PostgreSQL Database

ML Model (EfficientNet-B0)
```

## Model Performance

Laboratory validation results on PlantVillage dataset:

| Metric                    | Value  |
| ------------------------- | ------ |
| Accuracy                  | 95.1%  |
| Weighted F1 Score         | 94.7%  |
| Average API Response Time | 287 ms |

The model was evaluated under controlled laboratory conditions with standardized lighting and isolated leaf images.

## Installation

Clone repository:

```bash
git clone https://github.com/al1sh0ck/PlantAI.git
cd PlantAI
```

Create environment file:

```bash
cp .env.example .env
```

Build and start containers:

```bash
docker-compose up --build
```

Application will be available at:

```text
http://localhost:8000
```

Swagger documentation:

```text
http://localhost:8000/docs
```

## Running with Ngrok

Expose local backend for Android devices:

```bash
ngrok http 8000
```

After starting Ngrok, copy the generated HTTPS URL and update the API endpoint in the frontend or Android client configuration.

Example:

```text
https://your-id.ngrok-free.app
```

## API Endpoints

### Authentication

* POST /register
* POST /login
* POST /refresh

### Prediction

* POST /predict
* GET /history

### User

* GET /profile
* PUT /profile

## Project Components

### Backend Repository

* FastAPI API
* PostgreSQL
* Authentication
* ML Inference

### Android Client

Mobile application built with Android WebView:

* Camera support
* Gallery upload
* Mobile interface
* Authentication support

## Future Improvements

* Field validation on real agricultural datasets
* Domain adaptation for outdoor environments
* Progressive Web App (PWA)
* Offline prediction support
* Kazakh and Russian localization
* Additional crop species support

## Disclaimer

This system is a research prototype developed for academic purposes.

The model has been validated under laboratory conditions and should not be considered a certified agronomic decision-support system without additional field validation.

## Author

Alisher Bayshiganov
