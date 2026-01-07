from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from firebase_admin import auth as firebase_auth
from firebase_admin import firestore
from pydantic import BaseModel, Field

from firebase_client import db
from main import get_current_user
from notifications_service import create_user_notification, notify_roles

router = APIRouter(prefix="/bookings", tags=["bookings"])


class BookingCreate(BaseModel):
    pickup_location: str = Field(..., min_length=1)
    destination: str = Field(..., min_length=1)
    trip_type: Literal["antar", "jemput", "fulltrip"]
    departure_time: datetime
    passenger_count: int = Field(..., ge=1)


class BookingAssignCreate(BaseModel):
    requester_name: str = Field(..., min_length=1)
    requester_dept_job_position: Optional[str] = Field(default=None, min_length=1)
    requester_nik: Optional[str] = Field(default=None, min_length=1)
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
    requester_dept_job_position: Optional[str] = None
    requester_nik: Optional[str] = None
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
        requester_dept_job_position=data.get("requester_dept_job_position"),
        requester_nik=data.get("requester_nik"),
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


def get_departure_time_epoch_ms(value: Optional[datetime]) -> Optional[int]:
    if not isinstance(value, datetime):
        return None

    dt = value
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return int(dt.timestamp() * 1000)


def is_driver_busy(driver_id: str, departure_time: Optional[datetime], exclude_booking_id: Optional[str] = None) -> bool:
    if not driver_id or not isinstance(departure_time, datetime):
        return False

    target_epoch = get_departure_time_epoch_ms(departure_time)
    if target_epoch is None:
        return False

    query = db.collection("bookings").where("driver_id", "==", driver_id)
    for doc in query.stream():
        if exclude_booking_id and doc.id == exclude_booking_id:
            continue

        data = doc.to_dict() or {}
        if data.get("status") not in ("approved", "in_progress"):
            continue

        other_epoch = get_departure_time_epoch_ms(data.get("departure_time"))
        if other_epoch == target_epoch:
            return True

    return False


@router.post("", response_model=BookingResponse)
def create_booking(payload: BookingCreate, current_user=Depends(get_current_user)):
    uid = current_user["uid"]
    ensure_role(uid, ("user",))

    requester_name = None
    requester_phone = None
    requester_dept_job_position = None
    requester_nik = None
    doc = db.collection("users").document(uid).get()
    if doc.exists:
        data = doc.to_dict() or {}
        requester_name = data.get("name")
        requester_phone = data.get("phone_number") or data.get("phone")
        requester_dept_job_position = data.get("dept_job_position") or data.get("department") or data.get("job_position")
        requester_nik = data.get("nik") or data.get("national_id")

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
    if requester_dept_job_position:
        data["requester_dept_job_position"] = requester_dept_job_position
    if requester_nik:
        data["requester_nik"] = requester_nik
    doc_ref.set(data)

    create_user_notification(
        uid,
        "Your driver booking request was submitted successfully. Status is pending and waiting for office coordinator approval.",
        event="submitted",
        entity_type="booking",
        entity_id=doc_ref.id,
        status="pending",
        actor_id=uid,
    )

    notify_roles(
        ("office_coordinator", "superadmin"),
        "New driver booking request submitted. Status is pending and awaiting review.",
        event="incoming_request",
        entity_type="booking",
        entity_id=doc_ref.id,
        status="pending",
        actor_id=uid,
    )

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
    if is_driver_busy(driver_uid, payload.departure_time):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Driver is not available at this departure time",
        )

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
        "requester_dept_job_position": payload.requester_dept_job_position,
        "requester_nik": payload.requester_nik,
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

    if linked_user_id:
        create_user_notification(
            linked_user_id,
            "A driver booking has been created for you and has been approved.",
            event="created_by_office",
            entity_type="booking",
            entity_id=doc_ref.id,
            status="approved",
            actor_id=uid,
        )

    create_user_notification(
        driver_uid,
        "You have been assigned a new driver task. Please check Driver Tasks for details.",
        event="assigned",
        entity_type="booking",
        entity_id=doc_ref.id,
        status="approved",
        actor_id=uid,
    )

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


@router.get("/unavailable-drivers", response_model=list[str])
def list_unavailable_drivers(departure_time: datetime, current_user=Depends(get_current_user)):
    uid = current_user["uid"]
    ensure_role(uid, ("office_coordinator", "superadmin"))

    target_epoch = get_departure_time_epoch_ms(departure_time)
    if target_epoch is None:
        return []

    snapshots = []
    for status_value in ("approved", "in_progress"):
        snapshots.extend(list(db.collection("bookings").where("status", "==", status_value).stream()))

    unavailable: set[str] = set()
    for doc in snapshots:
        data = doc.to_dict() or {}
        driver_id = data.get("driver_id")
        if not driver_id:
            continue
        other_epoch = get_departure_time_epoch_ms(data.get("departure_time"))
        if other_epoch == target_epoch:
            unavailable.add(driver_id)

    return sorted(unavailable)


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

    booking_data = snapshot.to_dict() or {}

    if payload.status == "approved":
        if not payload.driver_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="driver_id is required for approval")

        data = snapshot.to_dict() or {}
        departure_time = data.get("departure_time")
        if not isinstance(departure_time, datetime):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Booking departure time is invalid")

        if is_driver_busy(payload.driver_id, departure_time, exclude_booking_id=booking_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Driver is not available at this departure time",
            )

    updates = {
        "status": payload.status,
        "updated_at": firestore.SERVER_TIMESTAMP,
    }
    if payload.driver_id is not None:
        updates["driver_id"] = payload.driver_id

    doc_ref.update(updates)

    user_id = booking_data.get("user_id")
    if user_id:
        if payload.status == "approved":
            message = "Your driver booking request has been approved."
        elif payload.status == "rejected":
            message = "Your driver booking request has been rejected."
        else:
            message = f"Your driver booking request status has been updated to {payload.status}."

        create_user_notification(
            user_id,
            message,
            event="status_updated",
            entity_type="booking",
            entity_id=booking_id,
            status=payload.status,
            actor_id=uid,
        )

    if payload.status == "approved" and payload.driver_id:
        create_user_notification(
            payload.driver_id,
            "You have been assigned a new driver task. Please check Driver Tasks for details.",
            event="assigned",
            entity_type="booking",
            entity_id=booking_id,
            status="approved",
            actor_id=uid,
        )

    updated_snapshot = doc_ref.get()
    return serialize_booking(updated_snapshot)


@router.patch("/{booking_id}", response_model=BookingResponse)
def update_booking(booking_id: str, payload: BookingCreate, current_user=Depends(get_current_user)):
    uid = current_user["uid"]
    ensure_role(uid, ("user",))

    doc_ref = db.collection("bookings").document(booking_id)
    snapshot = doc_ref.get()
    if not snapshot.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    data = snapshot.to_dict() or {}
    if data.get("user_id") != uid:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    if data.get("status", "pending") != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only pending bookings can be edited")

    doc_ref.update(
        {
            "pickup_location": payload.pickup_location,
            "destination": payload.destination,
            "trip_type": payload.trip_type,
            "departure_time": payload.departure_time,
            "passenger_count": payload.passenger_count,
            "updated_at": firestore.SERVER_TIMESTAMP,
        }
    )

    create_user_notification(
        uid,
        "Your driver booking request was updated successfully. Status is pending and waiting for office coordinator approval.",
        event="updated",
        entity_type="booking",
        entity_id=booking_id,
        status="pending",
        actor_id=uid,
    )

    updated_snapshot = doc_ref.get()
    return serialize_booking(updated_snapshot)


@router.patch("/{booking_id}/cancel", response_model=BookingResponse)
def cancel_booking(booking_id: str, current_user=Depends(get_current_user)):
    uid = current_user["uid"]
    role = ensure_role(uid, ("user", "office_coordinator", "superadmin"))

    doc_ref = db.collection("bookings").document(booking_id)
    snapshot = doc_ref.get()
    if not snapshot.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    data = snapshot.to_dict() or {}
    booking_status = data.get("status", "pending")

    if role == "user":
        if data.get("user_id") != uid:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

        if booking_status != "pending":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only pending bookings can be canceled")
    else:
        if booking_status != "approved":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only approved bookings can be canceled by office coordinator",
            )

        if data.get("starting_mileage") is not None or data.get("started_at") is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Booking already started and cannot be canceled",
            )

    doc_ref.update(
        {
            "status": "cancelled",
            "cancelled_by": uid,
            "cancelled_at": firestore.SERVER_TIMESTAMP,
            "updated_at": firestore.SERVER_TIMESTAMP,
        }
    )

    target_user_id = data.get("user_id")
    if role == "user":
        message = "Your driver booking request has been cancelled."
        target_user_id = uid
    else:
        message = "Your driver booking has been cancelled by the office coordinator."

    if target_user_id:
        create_user_notification(
            target_user_id,
            message,
            event="cancelled",
            entity_type="booking",
            entity_id=booking_id,
            status="cancelled",
            actor_id=uid,
        )

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
            "status": "in_progress",
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

    if data.get("status") not in ("approved", "in_progress"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Booking is not in a completable state")

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
