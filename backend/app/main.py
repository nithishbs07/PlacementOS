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

@app.get("/")
def read_root():
    return {"message": "Placement Scheduler API is running"}
