from __future__ import annotations

from typing import Optional

from firebase_admin import firestore

from firebase_client import db


def create_user_notification(
    user_id: Optional[str],
    message: str,
    *,
    event: str,
    entity_type: str,
    entity_id: str,
    status: Optional[str] = None,
    actor_id: Optional[str] = None,
) -> Optional[str]:
    """Create a notification entry under a user document and return the new notification id."""
    if not user_id:
        return None

    doc_ref = (
        db.collection("users")
        .document(str(user_id))
        .collection("notifications")
        .document()
    )
    doc_ref.set(
        {
            "message": message,
            "read": False,
            "event": event,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "status": status,
            "actor_id": actor_id,
            "created_at": firestore.SERVER_TIMESTAMP,
        }
    )
    return doc_ref.id


def notify_roles(
    roles: tuple[str, ...],
    message: str,
    *,
    event: str,
    entity_type: str,
    entity_id: str,
    status: Optional[str] = None,
    actor_id: Optional[str] = None,
) -> int:
    """Broadcast a notification to every user whose role is in the given list."""
    delivered = 0
    for role in roles:
        snapshots = db.collection("users").where("role", "==", role).stream()
        for user_doc in snapshots:
            created_id = create_user_notification(
                user_doc.id,
                message,
                event=event,
                entity_type=entity_type,
                entity_id=entity_id,
                status=status,
                actor_id=actor_id,
            )
            if created_id:
                delivered += 1
    return delivered
