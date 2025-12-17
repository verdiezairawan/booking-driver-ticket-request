from datetime import datetime
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from firebase_admin import auth as firebase_auth
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


class BookingAssignCreate(BaseModel):
    requester_name: str = Field(..., min_length=1)
    requester_phone: str = Field(..., min_length=1)
    requester_email: str = Field(..., min_length=1)
    driver_email: str = Field(..., min_length=1)
    pickup_location: str = Field(..., min_length=1)
    destination: str = Field(..., min_length=1)
    trip_type: Literal["antar", "jemput", "fulltrip"]
    departure_time: datetime
    passenger_count: int = Field(..., ge=1)


class BookingResponse(BaseModel):
    id: str
    user_id: Optional[str] = None
    driver_id: Optional[str] = None
    requester_name: Optional[str] = None
    requester_phone: Optional[str] = None
    requester_email: Optional[str] = None
    pickup_location: str
    destination: str
    trip_type: Literal["antar", "jemput", "fulltrip"]
    departure_time: datetime
    passenger_count: int
    status: str
    starting_mileage: Optional[int] = None
    ending_mileage: Optional[int] = None
    completion_proof: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class BookingOfficeHistoryResponse(BookingResponse):
    driver_name: Optional[str] = None


class BookingStatusUpdate(BaseModel):
    status: Literal["approved", "rejected", "completed"]
    driver_id: Optional[str] = None


class BookingStart(BaseModel):
    starting_mileage: int = Field(..., ge=0)


class BookingComplete(BaseModel):
    ending_mileage: int = Field(..., ge=0)
    completion_proof: str = Field(..., min_length=1)


def serialize_booking(doc_snapshot) -> BookingResponse:
    data = doc_snapshot.to_dict() or {}
    return BookingResponse(
        id=doc_snapshot.id,
        user_id=data.get("user_id"),
        driver_id=data.get("driver_id"),
        requester_name=data.get("requester_name"),
        requester_phone=data.get("requester_phone"),
        requester_email=data.get("requester_email"),
        pickup_location=data.get("pickup_location"),
        destination=data.get("destination"),
        trip_type=data.get("trip_type"),
        departure_time=data.get("departure_time"),
        passenger_count=data.get("passenger_count"),
        status=data.get("status"),
        starting_mileage=data.get("starting_mileage"),
        ending_mileage=data.get("ending_mileage"),
        completion_proof=data.get("completion_proof"),
        started_at=data.get("started_at"),
        completed_at=data.get("completed_at"),
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

    requester_name = None
    requester_phone = None
    doc = db.collection("users").document(uid).get()
    if doc.exists:
        data = doc.to_dict() or {}
        requester_name = data.get("name")
        requester_phone = data.get("phone_number") or data.get("phone")

    doc_ref = db.collection("bookings").document()
    data = {
        "user_id": uid,
        "driver_id": None,
        "requester_email": current_user.get("email"),
        "pickup_location": payload.pickup_location,
        "destination": payload.destination,
        "trip_type": payload.trip_type,
        "departure_time": payload.departure_time,
        "passenger_count": payload.passenger_count,
        "status": "pending",
        "created_at": firestore.SERVER_TIMESTAMP,
        "updated_at": firestore.SERVER_TIMESTAMP,
    }
    if requester_name:
        data["requester_name"] = requester_name
    if requester_phone:
        data["requester_phone"] = requester_phone
    doc_ref.set(data)
    snapshot = doc_ref.get()
    return serialize_booking(snapshot)


@router.post("/assign", response_model=BookingOfficeHistoryResponse)
def assign_driver(payload: BookingAssignCreate, current_user=Depends(get_current_user)):
    uid = current_user["uid"]
    ensure_role(uid, ("office_coordinator", "superadmin"))

    try:
        driver_record = firebase_auth.get_user_by_email(payload.driver_email)
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Driver not found")

    driver_uid = driver_record.uid
    driver_doc = db.collection("users").document(driver_uid).get()
    if not driver_doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Driver profile not found")

    driver_data = driver_doc.to_dict() or {}
    if driver_data.get("role") != "driver":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Selected user is not a driver")

    driver_name = driver_data.get("name") or driver_record.email

    linked_user_id = None
    try:
        requester_record = firebase_auth.get_user_by_email(payload.requester_email)
        linked_user_id = requester_record.uid
    except Exception:
        linked_user_id = None

    doc_ref = db.collection("bookings").document()
    data = {
        "user_id": linked_user_id,
        "driver_id": driver_uid,
        "driver_name": driver_name,
        "requester_name": payload.requester_name,
        "requester_phone": payload.requester_phone,
        "requester_email": payload.requester_email,
        "pickup_location": payload.pickup_location,
        "destination": payload.destination,
        "trip_type": payload.trip_type,
        "departure_time": payload.departure_time,
        "passenger_count": payload.passenger_count,
        "status": "approved",
        "created_by": uid,
        "created_at": firestore.SERVER_TIMESTAMP,
        "updated_at": firestore.SERVER_TIMESTAMP,
    }
    doc_ref.set(data)
    snapshot = doc_ref.get()
    booking = serialize_booking(snapshot)
    return BookingOfficeHistoryResponse(**booking.model_dump(), driver_name=driver_name)


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


@router.patch("/{booking_id}/start", response_model=BookingResponse)
def start_booking(booking_id: str, payload: BookingStart, current_user=Depends(get_current_user)):
    uid = current_user["uid"]
    ensure_role(uid, ("driver",))

    doc_ref = db.collection("bookings").document(booking_id)
    snapshot = doc_ref.get()
    if not snapshot.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    data = snapshot.to_dict() or {}
    if data.get("driver_id") != uid:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    if data.get("status") != "approved":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Booking is not in an approvable state")

    if data.get("starting_mileage") is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Booking already started")

    doc_ref.update(
        {
            "starting_mileage": payload.starting_mileage,
            "started_at": firestore.SERVER_TIMESTAMP,
            "updated_at": firestore.SERVER_TIMESTAMP,
        }
    )

    updated_snapshot = doc_ref.get()
    return serialize_booking(updated_snapshot)


@router.patch("/{booking_id}/complete", response_model=BookingResponse)
def complete_booking(booking_id: str, payload: BookingComplete, current_user=Depends(get_current_user)):
    uid = current_user["uid"]
    ensure_role(uid, ("driver",))

    doc_ref = db.collection("bookings").document(booking_id)
    snapshot = doc_ref.get()
    if not snapshot.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    data = snapshot.to_dict() or {}
    if data.get("driver_id") != uid:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    if data.get("status") != "approved":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Booking is not in an approvable state")

    starting = data.get("starting_mileage")
    if starting is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Booking must be started first")

    if isinstance(starting, int) and payload.ending_mileage < starting:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ending mileage must be greater than or equal to starting mileage",
        )

    doc_ref.update(
        {
            "ending_mileage": payload.ending_mileage,
            "completion_proof": payload.completion_proof,
            "status": "completed",
            "completed_at": firestore.SERVER_TIMESTAMP,
            "updated_at": firestore.SERVER_TIMESTAMP,
        }
    )

    updated_snapshot = doc_ref.get()
    return serialize_booking(updated_snapshot)


@router.get("/assigned", response_model=list[BookingResponse])
def list_assigned_bookings(current_user=Depends(get_current_user)):
    uid = current_user["uid"]
    ensure_role(uid, ("driver",))

    query = db.collection("bookings").where("driver_id", "==", uid)
    return [serialize_booking(doc) for doc in query.stream()]


@router.get("/history", response_model=list[BookingOfficeHistoryResponse])
def list_booking_history(current_user=Depends(get_current_user)):
    uid = current_user["uid"]
    ensure_role(uid, ("office_coordinator", "superadmin"))

    snapshots = list(db.collection("bookings").stream())

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

    driver_name_cache: dict[str, Optional[str]] = {}

    def resolve_driver_name(driver_id: Optional[str]) -> Optional[str]:
        if not driver_id:
            return None
        if driver_id in driver_name_cache:
            return driver_name_cache[driver_id]

        doc = db.collection("users").document(driver_id).get()
        name = None
        if doc.exists:
            data = doc.to_dict() or {}
            name = data.get("name") or data.get("email")

        driver_name_cache[driver_id] = name
        return name

    results: list[BookingOfficeHistoryResponse] = []
    for doc in sorted_docs:
        booking = serialize_booking(doc)
        data = doc.to_dict() or {}
        driver_name = data.get("driver_name") or resolve_driver_name(booking.driver_id)
        results.append(BookingOfficeHistoryResponse(**booking.model_dump(), driver_name=driver_name))

    return results


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
