from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Response, status
from firebase_admin import auth as firebase_auth
from firebase_admin import firestore
from pydantic import BaseModel, Field

from firebase_client import db
from main import get_current_user

router = APIRouter(prefix="/users", tags=["users"])

Role = Literal["user", "driver", "office_coordinator", "superadmin"]


class UserCreate(BaseModel):
    name: str = Field(..., min_length=1)
    dept_job_position: str = Field(..., min_length=1)
    role: Role
    nik: str = Field(..., min_length=1)
    phone: str = Field(..., min_length=1)
    email: str = Field(..., min_length=3)
    password: str = Field(..., min_length=6)


class UserUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1)
    dept_job_position: Optional[str] = Field(default=None, min_length=1)
    role: Optional[Role] = None
    nik: Optional[str] = Field(default=None, min_length=1)
    phone: Optional[str] = Field(default=None, min_length=1)
    email: Optional[str] = Field(default=None, min_length=3)


class UserResponse(BaseModel):
    uid: str
    name: Optional[str] = None
    dept_job_position: Optional[str] = None
    role: Optional[str] = None
    nik: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    disabled: Optional[bool] = None


def ensure_role(uid: str, allowed: tuple[str, ...]):
    doc = db.collection("users").document(uid).get()
    if not doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found")

    role = (doc.to_dict() or {}).get("role")
    if role not in allowed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return role


def serialize_user(doc_snapshot) -> UserResponse:
    data = doc_snapshot.to_dict() or {}
    return UserResponse(
        uid=doc_snapshot.id,
        name=data.get("name"),
        dept_job_position=data.get("dept_job_position") or data.get("department") or data.get("job_position"),
        role=data.get("role"),
        nik=data.get("nik") or data.get("national_id"),
        phone=data.get("phone") or data.get("phone_number"),
        email=data.get("email"),
        disabled=data.get("disabled", False),
    )


@router.get("", response_model=list[UserResponse])
def list_users(current_user=Depends(get_current_user)):
    uid = current_user["uid"]
    ensure_role(uid, ("office_coordinator", "superadmin"))

    snapshots = list(db.collection("users").stream())

    def name_value(doc):
        value = (doc.to_dict() or {}).get("name")
        if isinstance(value, str):
            return value.lower()
        return ""

    sorted_docs = sorted(snapshots, key=name_value)
    return [serialize_user(doc) for doc in sorted_docs]


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, current_user=Depends(get_current_user)):
    uid = current_user["uid"]
    current_role = ensure_role(uid, ("office_coordinator", "superadmin"))

    if current_role == "office_coordinator" and payload.role not in ("user", "driver"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    try:
        user_record = firebase_auth.create_user(email=payload.email, password=payload.password)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to create user account") from exc

    doc_ref = db.collection("users").document(user_record.uid)
    doc_ref.set(
        {
            "name": payload.name,
            "dept_job_position": payload.dept_job_position,
            "role": payload.role,
            "nik": payload.nik,
            "phone": payload.phone,
            "email": payload.email,
            "disabled": False,
            "created_at": firestore.SERVER_TIMESTAMP,
            "updated_at": firestore.SERVER_TIMESTAMP,
            "created_by": uid,
        }
    )

    snapshot = doc_ref.get()
    return serialize_user(snapshot)


@router.patch("/{user_id}", response_model=UserResponse)
def update_user(user_id: str, payload: UserUpdate, current_user=Depends(get_current_user)):
    uid = current_user["uid"]
    current_role = ensure_role(uid, ("office_coordinator", "superadmin"))

    doc_ref = db.collection("users").document(user_id)
    snapshot = doc_ref.get()
    if not snapshot.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found")

    target_data = snapshot.to_dict() or {}
    if target_data.get("role") == "superadmin" and current_role != "superadmin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    updates = payload.model_dump(exclude_none=True)
    if not updates:
        return serialize_user(snapshot)

    if current_role == "office_coordinator" and "role" in updates:
        target_role = target_data.get("role")
        next_role = updates.get("role")

        if next_role not in ("user", "driver"):
            if next_role == target_role:
                updates.pop("role", None)
            else:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        elif target_role not in ("user", "driver") and next_role != target_role:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    if not updates:
        return serialize_user(snapshot)

    if "email" in updates:
        try:
            firebase_auth.update_user(user_id, email=updates["email"])
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to update user email") from exc

    updates["updated_at"] = firestore.SERVER_TIMESTAMP
    updates["updated_by"] = uid
    doc_ref.update(updates)

    updated_snapshot = doc_ref.get()
    return serialize_user(updated_snapshot)


@router.patch("/{user_id}/deactivate", response_model=UserResponse)
def deactivate_user(user_id: str, current_user=Depends(get_current_user)):
    uid = current_user["uid"]
    current_role = ensure_role(uid, ("office_coordinator", "superadmin"))

    if user_id == uid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot deactivate your own account")

    doc_ref = db.collection("users").document(user_id)
    snapshot = doc_ref.get()
    if not snapshot.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found")

    target_data = snapshot.to_dict() or {}
    if target_data.get("role") == "superadmin" and current_role != "superadmin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    try:
        firebase_auth.update_user(user_id, disabled=True)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to deactivate user") from exc

    doc_ref.set(
        {
            "disabled": True,
            "updated_at": firestore.SERVER_TIMESTAMP,
            "updated_by": uid,
        },
        merge=True,
    )

    updated_snapshot = doc_ref.get()
    return serialize_user(updated_snapshot)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: str, current_user=Depends(get_current_user)):
    uid = current_user["uid"]
    ensure_role(uid, ("superadmin",))

    if user_id == uid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete your own account")

    try:
        firebase_auth.delete_user(user_id)
    except firebase_auth.UserNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User account not found") from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to delete user account") from exc

    doc_ref = db.collection("users").document(user_id)
    doc_ref.delete()

    return Response(status_code=status.HTTP_204_NO_CONTENT)
