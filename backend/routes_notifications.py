from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from firebase_admin import firestore
from pydantic import BaseModel, Field

from firebase_client import db
from main import get_current_user

router = APIRouter(prefix="/notifications", tags=["notifications"])


class NotificationResponse(BaseModel):
    id: str
    message: str = Field(..., min_length=1)
    read: bool = False
    event: Optional[str] = None
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    status: Optional[str] = None
    actor_id: Optional[str] = None
    created_at: Optional[datetime] = None


class MarkAllReadResponse(BaseModel):
    updated: int


def serialize_notification(doc_snapshot) -> NotificationResponse:
    data = doc_snapshot.to_dict() or {}
    return NotificationResponse(
        id=doc_snapshot.id,
        message=data.get("message") or "",
        read=bool(data.get("read", False)),
        event=data.get("event"),
        entity_type=data.get("entity_type"),
        entity_id=data.get("entity_id"),
        status=data.get("status"),
        actor_id=data.get("actor_id"),
        created_at=data.get("created_at"),
    )


@router.get("/my", response_model=list[NotificationResponse])
def list_my_notifications(limit: int = 25, current_user=Depends(get_current_user)):
    uid = current_user["uid"]
    if limit < 1:
        limit = 1
    if limit > 100:
        limit = 100

    collection_ref = db.collection("users").document(uid).collection("notifications")
    snapshots = list(collection_ref.stream())

    def created_at_value(doc):
        value = doc.to_dict().get("created_at")
        if isinstance(value, datetime):
            return value
        return datetime.min

    sorted_docs = sorted(snapshots, key=created_at_value, reverse=True)[:limit]
    return [serialize_notification(doc) for doc in sorted_docs]


@router.patch("/mark-all-read", response_model=MarkAllReadResponse)
def mark_all_notifications_read(current_user=Depends(get_current_user)):
    uid = current_user["uid"]

    collection_ref = db.collection("users").document(uid).collection("notifications")
    unread = list(collection_ref.where("read", "==", False).stream())

    if not unread:
        return MarkAllReadResponse(updated=0)

    batch = db.batch()
    for doc in unread:
        batch.update(doc.reference, {"read": True, "read_at": firestore.SERVER_TIMESTAMP})
    batch.commit()

    return MarkAllReadResponse(updated=len(unread))


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
def mark_notification_read(notification_id: str, current_user=Depends(get_current_user)):
    uid = current_user["uid"]
    doc_ref = db.collection("users").document(uid).collection("notifications").document(notification_id)
    snapshot = doc_ref.get()
    if not snapshot.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")

    doc_ref.update({"read": True, "read_at": firestore.SERVER_TIMESTAMP})
    updated_snapshot = doc_ref.get()
    return serialize_notification(updated_snapshot)

