import base64
import csv
import io
import re
import zipfile
from decimal import Decimal, InvalidOperation
from typing import Literal, Optional
from xml.etree import ElementTree as ET

from fastapi import APIRouter, Depends, HTTPException, Response, status
from firebase_admin import auth as firebase_auth
from firebase_admin import firestore
from pydantic import BaseModel, Field, ValidationError

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


class UserImportRequest(BaseModel):
    filename: str = Field(..., min_length=1)
    file_base64: str = Field(..., min_length=1)


class UserImportError(BaseModel):
    row: int
    email: Optional[str] = None
    message: str


class UserImportResponse(BaseModel):
    created: int
    failed: int
    errors: list[UserImportError]


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


def normalize_header(value: str) -> str:
    text = str(value or "").strip().lower()
    text = re.sub(r"[^a-z0-9]+", "_", text)
    return text.strip("_")


HEADER_TO_FIELD: dict[str, str] = {
    "name": "name",
    "user_name": "name",
    "full_name": "name",
    "nama": "name",
    "dept_job_position": "dept_job_position",
    "dept_job": "dept_job_position",
    "department": "dept_job_position",
    "job_position": "dept_job_position",
    "position": "dept_job_position",
    "role": "role",
    "nik": "nik",
    "national_id": "nik",
    "nationalid": "nik",
    "phone": "phone",
    "phone_number": "phone",
    "phone_no": "phone",
    "no_hp": "phone",
    "telp": "phone",
    "email": "email",
    "email_address": "email",
    "password": "password",
    "pass": "password",
}


REQUIRED_IMPORT_FIELDS = ("name", "dept_job_position", "nik", "phone", "email", "password")


def normalize_cell_value(value: str) -> str:
    if value is None:
        return ""
    text = str(value).strip()

    if re.match(r"^-?\d+\.0$", text):
        text = text[:-2]

    if "e" in text.lower():
        try:
            numeric = Decimal(text)
            if numeric == numeric.to_integral_value():
                return format(numeric.to_integral_value(), "f")
            return format(numeric.normalize(), "f")
        except InvalidOperation:
            return text

    return text


def format_validation_error(exc: ValidationError) -> str:
    parts: list[str] = []
    for err in exc.errors():
        loc = err.get("loc") or []
        loc_text = ".".join(str(item) for item in loc)
        msg = err.get("msg") or "Invalid value"
        parts.append(f"{loc_text}: {msg}" if loc_text else msg)
    return "; ".join(parts) if parts else "Invalid payload"


def xlsx_column_index(cell_ref: str) -> Optional[int]:
    if not cell_ref:
        return None
    letters = "".join(ch for ch in cell_ref if ch.isalpha())
    if not letters:
        return None
    idx = 0
    for ch in letters.upper():
        idx = idx * 26 + (ord(ch) - ord("A") + 1)
    return idx - 1


def xlsx_shared_strings(zf: zipfile.ZipFile) -> list[str]:
    try:
        raw = zf.read("xl/sharedStrings.xml")
    except KeyError:
        return []

    ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    root = ET.fromstring(raw)
    strings: list[str] = []
    for si in root.findall("m:si", ns):
        parts = []
        for t in si.findall(".//m:t", ns):
            parts.append(t.text or "")
        strings.append("".join(parts))
    return strings


def xlsx_first_sheet_path(zf: zipfile.ZipFile) -> str:
    ns_main = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    ns_rel = {"r": "http://schemas.openxmlformats.org/package/2006/relationships"}
    rid_attr = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"

    try:
        workbook = ET.fromstring(zf.read("xl/workbook.xml"))
        sheets = workbook.find("m:sheets", ns_main)
        sheet = sheets.find("m:sheet", ns_main) if sheets is not None else None
        rel_id = sheet.attrib.get(rid_attr) if sheet is not None else None
        if not rel_id:
            raise KeyError

        rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
        for rel in rels.findall("r:Relationship", ns_rel):
            if rel.attrib.get("Id") == rel_id:
                target = rel.attrib.get("Target") or "worksheets/sheet1.xml"
                target = target.lstrip("/")
                if not target.startswith("xl/"):
                    target = f"xl/{target}"
                return target
    except Exception:
        return "xl/worksheets/sheet1.xml"

    return "xl/worksheets/sheet1.xml"


def xlsx_cell_text(cell: ET.Element, shared_strings: list[str], ns: dict[str, str]) -> str:
    cell_type = cell.attrib.get("t")

    if cell_type == "inlineStr":
        inline = cell.find("m:is", ns)
        if inline is None:
            return ""
        parts = []
        for t in inline.findall(".//m:t", ns):
            parts.append(t.text or "")
        return normalize_cell_value("".join(parts))

    value_elem = cell.find("m:v", ns)
    if value_elem is None or value_elem.text is None:
        return ""

    raw = value_elem.text
    if cell_type == "s":
        try:
            idx = int(raw)
        except ValueError:
            return normalize_cell_value(raw)
        if 0 <= idx < len(shared_strings):
            return normalize_cell_value(shared_strings[idx])
        return ""

    return normalize_cell_value(raw)


def parse_user_rows_from_xlsx(content: bytes) -> list[tuple[int, dict[str, str]]]:
    zf = zipfile.ZipFile(io.BytesIO(content))
    shared = xlsx_shared_strings(zf)
    sheet_path = xlsx_first_sheet_path(zf)

    try:
        sheet_raw = zf.read(sheet_path)
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid .xlsx file (sheet not found)") from exc

    ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    root = ET.fromstring(sheet_raw)
    sheet_data = root.find("m:sheetData", ns)
    if sheet_data is None:
        return []

    parsed_rows: list[tuple[int, dict[int, str]]] = []
    for row_elem in sheet_data.findall("m:row", ns):
        row_number_raw = row_elem.attrib.get("r") or "0"
        try:
            row_number = int(row_number_raw)
        except ValueError:
            row_number = 0

        cells = row_elem.findall("m:c", ns)
        row_map: dict[int, str] = {}
        for cell in cells:
            ref = cell.attrib.get("r") or ""
            col_idx = xlsx_column_index(ref)
            if col_idx is None:
                continue
            row_map[col_idx] = xlsx_cell_text(cell, shared, ns)

        if any(value.strip() for value in row_map.values()):
            parsed_rows.append((row_number, row_map))

    if not parsed_rows:
        return []

    header_row_number, header_map = parsed_rows[0]
    col_to_field: dict[int, str] = {}
    for col_idx, header_value in header_map.items():
        normalized = normalize_header(header_value)
        field_name = HEADER_TO_FIELD.get(normalized)
        if field_name:
            col_to_field[col_idx] = field_name

    missing = [field for field in REQUIRED_IMPORT_FIELDS if field not in col_to_field.values()]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Missing required columns: {', '.join(missing)}",
        )

    results: list[tuple[int, dict[str, str]]] = []
    for row_number, row_map in parsed_rows[1:]:
        if row_number <= header_row_number:
            continue
        row_payload: dict[str, str] = {}
        for col_idx, field_name in col_to_field.items():
            row_payload[field_name] = row_map.get(col_idx, "")
        results.append((row_number, row_payload))

    return results


def parse_user_rows_from_csv(content: bytes) -> list[tuple[int, dict[str, str]]]:
    text = content.decode("utf-8-sig", errors="replace")
    reader = csv.reader(io.StringIO(text))
    rows = list(reader)
    if not rows:
        return []

    header_values = rows[0]
    col_to_field: dict[int, str] = {}
    for idx, header_value in enumerate(header_values):
        normalized = normalize_header(header_value)
        field_name = HEADER_TO_FIELD.get(normalized)
        if field_name:
            col_to_field[idx] = field_name

    missing = [field for field in REQUIRED_IMPORT_FIELDS if field not in col_to_field.values()]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Missing required columns: {', '.join(missing)}",
        )

    results: list[tuple[int, dict[str, str]]] = []
    for index, row in enumerate(rows[1:], start=2):
        if not any(str(cell).strip() for cell in row):
            continue
        row_payload: dict[str, str] = {}
        for col_idx, field_name in col_to_field.items():
            row_payload[field_name] = normalize_cell_value(row[col_idx]) if col_idx < len(row) else ""
        results.append((index, row_payload))

    return results


def decode_import_file(payload: UserImportRequest) -> tuple[str, bytes]:
    try:
        raw = base64.b64decode(payload.file_base64, validate=True)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid base64 file payload") from exc

    filename = payload.filename.strip()
    if not filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Filename is required")

    return filename, raw


def parse_import_rows(filename: str, content: bytes) -> list[tuple[int, dict[str, str]]]:
    lower = filename.lower()
    if lower.endswith(".xlsx"):
        return parse_user_rows_from_xlsx(content)
    if lower.endswith(".csv"):
        return parse_user_rows_from_csv(content)

    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported file type. Use .xlsx or .csv")


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


@router.post("/import", response_model=UserImportResponse)
def import_users(payload: UserImportRequest, current_user=Depends(get_current_user)):
    uid = current_user["uid"]
    current_role = ensure_role(uid, ("office_coordinator", "superadmin"))

    filename, content = decode_import_file(payload)
    rows = parse_import_rows(filename, content)

    created = 0
    errors: list[UserImportError] = []

    for row_number, row_data in rows:
        normalized = {key: normalize_cell_value(value) for key, value in row_data.items()}
        normalized.setdefault("role", "user")
        normalized["role"] = (normalized.get("role") or "user").strip().lower()

        email = normalized.get("email") or None

        try:
            user_payload = UserCreate(**normalized)
        except ValidationError as exc:
            errors.append(
                UserImportError(
                    row=row_number,
                    email=email,
                    message=format_validation_error(exc),
                )
            )
            continue

        if current_role == "office_coordinator" and user_payload.role not in ("user", "driver"):
            errors.append(
                UserImportError(
                    row=row_number,
                    email=email,
                    message="Office coordinator can only create roles: user, driver",
                )
            )
            continue

        try:
            user_record = firebase_auth.create_user(email=user_payload.email, password=user_payload.password)
        except Exception as exc:
            errors.append(
                UserImportError(
                    row=row_number,
                    email=email,
                    message=f"Failed to create user account: {exc}",
                )
            )
            continue

        doc_ref = db.collection("users").document(user_record.uid)
        try:
            doc_ref.set(
                {
                    "name": user_payload.name,
                    "dept_job_position": user_payload.dept_job_position,
                    "role": user_payload.role,
                    "nik": user_payload.nik,
                    "phone": user_payload.phone,
                    "email": user_payload.email,
                    "disabled": False,
                    "created_at": firestore.SERVER_TIMESTAMP,
                    "updated_at": firestore.SERVER_TIMESTAMP,
                    "created_by": uid,
                }
            )
        except Exception as exc:
            try:
                firebase_auth.delete_user(user_record.uid)
            except Exception:
                pass
            errors.append(
                UserImportError(
                    row=row_number,
                    email=email,
                    message=f"Failed to create user profile: {exc}",
                )
            )
            continue

        created += 1

    return UserImportResponse(created=created, failed=len(errors), errors=errors)


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
