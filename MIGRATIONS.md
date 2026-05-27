# PlantAI — Database migrations via Alembic
#
# Setup:
#   pip install alembic
#   alembic init alembic
#   # Edit alembic.ini: sqlalchemy.url = your DATABASE_URL
#   # Edit alembic/env.py: import app.models.user, app.models.prediction
#   #                       target_metadata = Base.metadata
#
# Create first migration:
#   alembic revision --autogenerate -m "init"
#
# Run migrations:
#   alembic upgrade head
#
# NOTE: The app auto-creates tables on startup via Base.metadata.create_all()
# so Alembic is only needed for production schema migrations.
