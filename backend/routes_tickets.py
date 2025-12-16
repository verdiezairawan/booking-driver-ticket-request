from datetime import date, datetime, time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from firebase_admin import firestore
from pydantic import BaseModel, Field

from firebase_client import db
from main import get_current_user

router = APIRouter(prefix="/tickets", tags=["tickets"])


class TicketCreate(BaseModel):
    full_name: str
    phone_number: str
    email: str
    national_id: str
    destination: str
    departure_point: str
    departure_date: date
    departure_time: str
    purpose_of_travel: str
    trip_type: str
    hotel_accommodation: bool
    transportation_mode: str
    transportation_other: Optional[str] = None
    special_requests: Optional[str] = None
    superior_approval_note: Optional[str] = None
    additional_notes: Optional[str] = None


class TicketResponse(TicketCreate):
    id: str
    user_id: str
    status: str = Field(default="pending")
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


def serialize_ticket(doc_snapshot) -> TicketResponse:
    data = doc_snapshot.to_dict() or {}
    return TicketResponse(
        id=doc_snapshot.id,
        user_id=data.get("user_id"),
        full_name=data.get("full_name"),
        phone_number=data.get("phone_number"),
        email=data.get("email"),
        national_id=data.get("national_id"),
        destination=data.get("destination"),
        departure_point=data.get("departure_point"),
        departure_date=data.get("departure_date"),
        departure_time=data.get("departure_time"),
        purpose_of_travel=data.get("purpose_of_travel"),
        trip_type=data.get("trip_type"),
        hotel_accommodation=data.get("hotel_accommodation"),
        transportation_mode=data.get("transportation_mode"),
        transportation_other=data.get("transportation_other"),
        special_requests=data.get("special_requests"),
        superior_approval_note=data.get("superior_approval_note"),
        additional_notes=data.get("additional_notes"),
        status=data.get("status", "pending"),
        created_at=data.get("created_at"),
        updated_at=data.get("updated_at"),
    )


def ensure_user_role(uid: str):
    doc = db.collection("users").document(uid).get()
    if not doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found")

    role = doc.to_dict().get("role")
    if role != "user":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


def ensure_role(uid: str, allowed: tuple[str, ...]):
    doc = db.collection("users").document(uid).get()
    if not doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found")
    role = doc.to_dict().get("role")
    if role not in allowed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


@router.get("/pending", response_model=list[TicketResponse])
def list_pending_tickets(current_user=Depends(get_current_user)):
    uid = current_user["uid"]
    ensure_role(uid, ("office_coordinator", "superadmin"))

    query = db.collection("tickets").where("status", "==", "pending")
    snapshots = list(query.stream())

    def created_at_value(doc):
        value = doc.to_dict().get("created_at")
        if isinstance(value, datetime):
            return value
        return datetime.min

    sorted_docs = sorted(snapshots, key=created_at_value, reverse=True)
    return [serialize_ticket(doc) for doc in sorted_docs]


@router.post("", response_model=TicketResponse)
def create_ticket(payload: TicketCreate, current_user=Depends(get_current_user)):
    uid = current_user["uid"]
    ensure_user_role(uid)

    departure_date_value = payload.departure_date
    if isinstance(departure_date_value, date) and not isinstance(departure_date_value, datetime):
        departure_date_value = datetime.combine(departure_date_value, time.min)

    data = {
        **payload.model_dump(),
        "departure_date": departure_date_value,
        "user_id": uid,
        "status": "pending",
        "created_at": firestore.SERVER_TIMESTAMP,
        "updated_at": firestore.SERVER_TIMESTAMP,
    }

    doc_ref = db.collection("tickets").document()
    doc_ref.set(data)
    snapshot = doc_ref.get()
    return serialize_ticket(snapshot)


@router.get("/my", response_model=list[TicketResponse])
def list_my_tickets(current_user=Depends(get_current_user)):
    uid = current_user["uid"]
    ensure_user_role(uid)

    query = db.collection("tickets").where("user_id", "==", uid)
    snapshots = list(query.stream())

    def created_at_value(doc):
        value = doc.to_dict().get("created_at")
        if isinstance(value, datetime):
            return value
        return datetime.min

    snapshots_sorted = sorted(snapshots, key=created_at_value, reverse=True)
    tickets = [serialize_ticket(doc) for doc in snapshots_sorted]
    return tickets


@router.get("/stats")
def ticket_stats(current_user=Depends(get_current_user)):
    uid = current_user["uid"]
    ensure_role(uid, ("office_coordinator", "superadmin"))

    pending = (
        db.collection("tickets")
        .where("status", "==", "pending")
        .stream()
    )
    approved = (
        db.collection("tickets")
        .where("status", "==", "approved")
        .stream()
    )
    rejected = (
        db.collection("tickets")
        .where("status", "==", "rejected")
        .stream()
    )

    return {
        "pending": len(list(pending)),
        "approved": len(list(approved)),
        "rejected": len(list(rejected)),
    }
