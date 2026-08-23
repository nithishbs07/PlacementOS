import os
import sys

# Add the backend directory to sys.path so 'app' can be found
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal, engine, Base
from app.services.generator import generate_mock_data

def seed():
    print("Creating tables...")
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # Check if already seeded
        from app.models.domain import Company
        if db.query(Company).count() > 0:
            print("Database already seeded. Skipping.")
            return
            
        print("Generating mock data...")
        generate_mock_data(db)
        print("Done.")
    finally:
        db.close()

if __name__ == "__main__":
    seed()
