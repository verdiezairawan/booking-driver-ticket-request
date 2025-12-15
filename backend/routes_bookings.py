from datetime import datetime
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from firebase_admin import firestore
from pydantic import BaseModel, Field

from firebase_client import db
from main import get_current_user

router = APIRouter(prefix="/bookings", tags=["bookings"])


class BookingCreate(BaseModel):
    pickup_location: str = Field(..., min_length=1)
    destination: str = Field(..., min_length=1)
    trip_type: Literal["antar", "jemput", "fulltrip"]
    departure_time: datetime
    passenger_count: int = Field(..., ge=1)


class BookingResponse(BaseModel):
    id: str
    user_id: str
    driver_id: Optional[str] = None
    pickup_location: str
    destination: str
    trip_type: Literal["antar", "jemput", "fulltrip"]
    departure_time: datetime
    passenger_count: int
    status: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class BookingStatusUpdate(BaseModel):
    status: Literal["approved", "rejected", "completed"]
    driver_id: Optional[str] = None


def serialize_booking(doc_snapshot) -> BookingResponse:
    data = doc_snapshot.to_dict() or {}
    return BookingResponse(
        id=doc_snapshot.id,
        user_id=data.get("user_id"),
        driver_id=data.get("driver_id"),
        pickup_location=data.get("pickup_location"),
        destination=data.get("destination"),
        trip_type=data.get("trip_type"),
        departure_time=data.get("departure_time"),
        passenger_count=data.get("passenger_count"),
        status=data.get("status"),
        created_at=data.get("created_at"),
        updated_at=data.get("updated_at"),
    )


def ensure_role(uid: str, allowed: tuple[str, ...]):
    doc = db.collection("users").document(uid).get()
    if not doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found")
    role = (doc.to_dict() or {}).get("role")
    if role not in allowed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return role


@router.post("", response_model=BookingResponse)
def create_booking(payload: BookingCreate, current_user=Depends(get_current_user)):
    uid = current_user["uid"]
    ensure_role(uid, ("user",))

    doc_ref = db.collection("bookings").document()
    data = {
        "user_id": uid,
        "driver_id": None,
        "pickup_location": payload.pickup_location,
        "destination": payload.destination,
        "trip_type": payload.trip_type,
        "departure_time": payload.departure_time,
        "passenger_count": payload.passenger_count,
        "status": "pending",
        "created_at": firestore.SERVER_TIMESTAMP,
        "updated_at": firestore.SERVER_TIMESTAMP,
    }
    doc_ref.set(data)
    snapshot = doc_ref.get()
    return serialize_booking(snapshot)


@router.get("/my", response_model=list[BookingResponse])
def list_my_bookings(current_user=Depends(get_current_user)):
    uid = current_user["uid"]
    ensure_role(uid, ("user",))

    query = db.collection("bookings").where("user_id", "==", uid)
    snapshots = list(query.stream())

    def created_at_value(doc):
        value = doc.to_dict().get("created_at")
        if isinstance(value, datetime):
            return value
        return datetime.min

    sorted_docs = sorted(snapshots, key=created_at_value, reverse=True)
    return [serialize_booking(doc) for doc in sorted_docs]


@router.get("/pending", response_model=list[BookingResponse])
def list_pending_bookings(current_user=Depends(get_current_user)):
    uid = current_user["uid"]
    ensure_role(uid, ("office_coordinator", "superadmin"))

    query = db.collection("bookings").where("status", "==", "pending")
    snapshots = list(query.stream())

    def created_at_value(doc):
        value = doc.to_dict().get("created_at")
        if isinstance(value, datetime):
            return value
        return datetime.min

    sorted_docs = sorted(snapshots, key=created_at_value, reverse=True)
    return [serialize_booking(doc) for doc in sorted_docs]


@router.patch("/{booking_id}/status", response_model=BookingResponse)
def update_booking_status(
    booking_id: str,
    payload: BookingStatusUpdate,
    current_user=Depends(get_current_user),
):
    uid = current_user["uid"]
    ensure_role(uid, ("office_coordinator", "superadmin"))

    doc_ref = db.collection("bookings").document(booking_id)
    snapshot = doc_ref.get()
    if not snapshot.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    updates = {
        "status": payload.status,
        "updated_at": firestore.SERVER_TIMESTAMP,
    }
    if payload.driver_id is not None:
        updates["driver_id"] = payload.driver_id

    doc_ref.update(updates)
    updated_snapshot = doc_ref.get()
    return serialize_booking(updated_snapshot)


@router.get("/assigned", response_model=list[BookingResponse])
def list_assigned_bookings(current_user=Depends(get_current_user)):
    uid = current_user["uid"]
    ensure_role(uid, ("driver",))

    query = db.collection("bookings").where("driver_id", "==", uid)
    return [serialize_booking(doc) for doc in query.stream()]


@router.get("/stats")
def booking_stats(current_user=Depends(get_current_user)):
    uid = current_user["uid"]
    ensure_role(uid, ("office_coordinator", "superadmin"))

    def count_status(status_value: str) -> int:
        query = db.collection("bookings").where("status", "==", status_value).stream()
        return len(list(query))

    return {
        "pending": count_status("pending"),
        "approved": count_status("approved"),
        "rejected": count_status("rejected"),
        "completed": count_status("completed"),
    }
