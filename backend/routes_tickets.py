from datetime import date, datetime, time
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from firebase_admin import auth as firebase_auth
from firebase_admin import firestore
from pydantic import BaseModel, Field

from firebase_client import db
from main import get_current_user
from notifications_service import create_user_notification, notify_roles

router = APIRouter(prefix="/tickets", tags=["tickets"])


class TicketBase(BaseModel):
    destination: str
    departure_point: str
    departure_date: date
    departure_time: str
    purpose_of_travel: str
    trip_type: str
    hotel_accommodation: bool
    hotel_name: Optional[str] = None
    hotel_location: Optional[str] = None
    transportation_mode: str
    transportation_other: Optional[str] = None
    special_requests: Optional[str] = None
    superior_approval_note: Optional[str] = None
    additional_notes: Optional[str] = None


class TicketCreate(TicketBase):
    full_name: str
    dept_job_position: Optional[str] = None
    phone_number: str
    email: str
    national_id: str


class TicketUserCreate(TicketBase):
    pass


class TicketResponse(TicketCreate):
    id: str
    user_id: Optional[str] = None
    status: str = Field(default="pending")
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class TicketStatusUpdate(BaseModel):
    status: Literal["approved", "rejected"]


def serialize_ticket(doc_snapshot) -> TicketResponse:
    data = doc_snapshot.to_dict() or {}
    return TicketResponse(
        id=doc_snapshot.id,
        user_id=data.get("user_id"),
        full_name=data.get("full_name"),
        dept_job_position=data.get("dept_job_position"),
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
        hotel_name=data.get("hotel_name"),
        hotel_location=data.get("hotel_location"),
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

    data = doc.to_dict() or {}
    role = data.get("role")
    if role != "user":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return data


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


@router.get("/history", response_model=list[TicketResponse])
def list_ticket_history(current_user=Depends(get_current_user)):
    uid = current_user["uid"]
    ensure_role(uid, ("office_coordinator", "superadmin"))

    snapshots = list(db.collection("tickets").stream())

    def created_at_value(doc):
        value = doc.to_dict().get("created_at")
        if isinstance(value, datetime):
            return value
        return datetime.min

    history_docs = []
    for doc in snapshots:
        data = doc.to_dict() or {}
        if data.get("status", "pending") != "pending":
            history_docs.append(doc)

    sorted_docs = sorted(history_docs, key=created_at_value, reverse=True)
    return [serialize_ticket(doc) for doc in sorted_docs]


@router.post("", response_model=TicketResponse)
def create_ticket(payload: TicketUserCreate, current_user=Depends(get_current_user)):
    uid = current_user["uid"]
    user_profile = ensure_user_role(uid)

    full_name = user_profile.get("name") or user_profile.get("full_name")
    dept_job_position = user_profile.get("dept_job_position") or user_profile.get("department") or user_profile.get("job_position")
    phone_number = user_profile.get("phone") or user_profile.get("phone_number")
    national_id = user_profile.get("nik") or user_profile.get("national_id")
    email = user_profile.get("email") or current_user.get("email")

    missing_fields = []
    if not full_name:
        missing_fields.append("name")
    if not phone_number:
        missing_fields.append("phone")
    if not national_id:
        missing_fields.append("nik")
    if not email:
        missing_fields.append("email")

    if missing_fields:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User profile incomplete. Missing: {', '.join(missing_fields)}",
        )

    departure_date_value = payload.departure_date
    if isinstance(departure_date_value, date) and not isinstance(departure_date_value, datetime):
        departure_date_value = datetime.combine(departure_date_value, time.min)

    data = {
        **payload.model_dump(),
        "departure_date": departure_date_value,
        "full_name": str(full_name),
        "dept_job_position": dept_job_position,
        "phone_number": str(phone_number),
        "email": str(email),
        "national_id": str(national_id),
        "user_id": uid,
        "status": "pending",
        "created_at": firestore.SERVER_TIMESTAMP,
        "updated_at": firestore.SERVER_TIMESTAMP,
    }

    doc_ref = db.collection("tickets").document()
    doc_ref.set(data)

    create_user_notification(
        uid,
        "Your travel request was submitted successfully. Status is pending and waiting for office coordinator approval.",
        event="submitted",
        entity_type="ticket",
        entity_id=doc_ref.id,
        status="pending",
        actor_id=uid,
    )

    notify_roles(
        ("office_coordinator", "superadmin"),
        "New travel request submitted. Status is pending and awaiting review.",
        event="incoming_request",
        entity_type="ticket",
        entity_id=doc_ref.id,
        status="pending",
        actor_id=uid,
    )

    snapshot = doc_ref.get()
    return serialize_ticket(snapshot)


@router.post("/accommodation", response_model=TicketResponse)
def create_travel_accommodation(payload: TicketCreate, current_user=Depends(get_current_user)):
    uid = current_user["uid"]
    ensure_role(uid, ("office_coordinator", "superadmin"))

    linked_user_id = None
    try:
        user_record = firebase_auth.get_user_by_email(payload.email)
        linked_user_id = user_record.uid
    except Exception:
        linked_user_id = None

    departure_date_value = payload.departure_date
    if isinstance(departure_date_value, date) and not isinstance(departure_date_value, datetime):
        departure_date_value = datetime.combine(departure_date_value, time.min)

    data = {
        **payload.model_dump(),
        "departure_date": departure_date_value,
        "user_id": linked_user_id,
        "status": "pending",
        "created_by": uid,
        "created_at": firestore.SERVER_TIMESTAMP,
        "updated_at": firestore.SERVER_TIMESTAMP,
    }

    doc_ref = db.collection("tickets").document()
    doc_ref.set(data)

    if linked_user_id:
        create_user_notification(
            linked_user_id,
            "A travel request has been created for you by the office coordinator. Status is pending and waiting for approval.",
            event="created_by_office",
            entity_type="ticket",
            entity_id=doc_ref.id,
            status="pending",
            actor_id=uid,
        )

    snapshot = doc_ref.get()
    return serialize_ticket(snapshot)


@router.patch("/{ticket_id}/status", response_model=TicketResponse)
def update_ticket_status(ticket_id: str, payload: TicketStatusUpdate, current_user=Depends(get_current_user)):
    uid = current_user["uid"]
    ensure_role(uid, ("office_coordinator", "superadmin"))

    doc_ref = db.collection("tickets").document(ticket_id)
    snapshot = doc_ref.get()
    if not snapshot.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    ticket_data = snapshot.to_dict() or {}

    doc_ref.update(
        {
            "status": payload.status,
            "processed_by": uid,
            "updated_at": firestore.SERVER_TIMESTAMP,
        }
    )

    user_id = ticket_data.get("user_id")
    if user_id:
        if payload.status == "approved":
            message = "Your travel request has been approved."
        else:
            message = "Your travel request has been rejected."

        create_user_notification(
            user_id,
            message,
            event="status_updated",
            entity_type="ticket",
            entity_id=ticket_id,
            status=payload.status,
            actor_id=uid,
        )

    updated_snapshot = doc_ref.get()
    return serialize_ticket(updated_snapshot)


@router.patch("/{ticket_id}", response_model=TicketResponse)
def update_ticket(ticket_id: str, payload: TicketUserCreate, current_user=Depends(get_current_user)):
    uid = current_user["uid"]
    ensure_user_role(uid)

    doc_ref = db.collection("tickets").document(ticket_id)
    snapshot = doc_ref.get()
    if not snapshot.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    ticket_data = snapshot.to_dict() or {}
    if ticket_data.get("user_id") != uid:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    if ticket_data.get("status", "pending") != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only pending tickets can be edited")

    departure_date_value = payload.departure_date
    if isinstance(departure_date_value, date) and not isinstance(departure_date_value, datetime):
        departure_date_value = datetime.combine(departure_date_value, time.min)

    update_data = {
        **payload.model_dump(),
        "departure_date": departure_date_value,
        "updated_at": firestore.SERVER_TIMESTAMP,
    }

    doc_ref.update(update_data)

    create_user_notification(
        uid,
        "Your travel request was updated successfully. Status is pending and waiting for office coordinator approval.",
        event="updated",
        entity_type="ticket",
        entity_id=ticket_id,
        status="pending",
        actor_id=uid,
    )

    updated_snapshot = doc_ref.get()
    return serialize_ticket(updated_snapshot)


@router.patch("/{ticket_id}/cancel", response_model=TicketResponse)
def cancel_ticket(ticket_id: str, current_user=Depends(get_current_user)):
    uid = current_user["uid"]
    ensure_user_role(uid)

    doc_ref = db.collection("tickets").document(ticket_id)
    snapshot = doc_ref.get()
    if not snapshot.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    ticket_data = snapshot.to_dict() or {}
    if ticket_data.get("user_id") != uid:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    if ticket_data.get("status", "pending") != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only pending tickets can be canceled")

    doc_ref.update(
        {
            "status": "cancelled",
            "cancelled_by": uid,
            "updated_at": firestore.SERVER_TIMESTAMP,
        }
    )

    create_user_notification(
        uid,
        "Your travel request has been cancelled.",
        event="cancelled",
        entity_type="ticket",
        entity_id=ticket_id,
        status="cancelled",
        actor_id=uid,
    )

    updated_snapshot = doc_ref.get()
    return serialize_ticket(updated_snapshot)


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
