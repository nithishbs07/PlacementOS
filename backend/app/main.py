from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import Base, engine

from app.models import domain

# Create tables for initial setup (in production use Alembic)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Placement Scheduler API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.api.router import router

app.include_router(router, prefix="/api")

@app.on_event("startup")
def startup_event():
    from app.core.database import SessionLocal
    from app.models.domain import Company
    from app.services.generator import generate_mock_data
    from app.services.solver import create_schedule
    
    db = SessionLocal()
    try:
        # Idempotent seeding check: if there are no companies, the ephemeral/new DB is empty
        if db.query(Company).count() == 0:
            print("Database is empty. Running production demo seeding...")
            from app.api.router import generate_initial_schedule
            generate_initial_schedule(db)
            print("Production seeding complete.")
    finally:
        db.close()

@app.get("/")
def read_root():
    return {"message": "Placement Scheduler API is running"}
