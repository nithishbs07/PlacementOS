from sqlalchemy.orm import Session
from app.models.domain import AuditLog
import json
from datetime import datetime

def log_action(db: Session, action: str, entity: str, entity_id: int = None, schedule_version_id: int = None, actor: str = "SYSTEM", previous_state: dict = None, new_state: dict = None, metadata: dict = None):
    log = AuditLog(
        timestamp=datetime.utcnow(),
        action=action,
        entity=entity,
        entity_id=entity_id,
        schedule_version_id=schedule_version_id,
        actor=actor,
        previous_state=json.dumps(previous_state) if previous_state else None,
        new_state=json.dumps(new_state) if new_state else None,
        metadata_json=json.dumps(metadata) if metadata else None
    )
    db.add(log)
    db.commit()
    return log
