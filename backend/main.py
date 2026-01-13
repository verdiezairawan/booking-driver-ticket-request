import os

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from firebase_admin import auth as firebase_auth

from firebase_client import db, init_firebase_admin

app = FastAPI()

origins = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer()


@app.on_event("startup")
def startup_event():
    """Initialize Firebase Admin SDK once the app starts."""
    init_firebase_admin()


def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(security),
):
    """Validate the auth token and return the decoded Firebase user payload."""
    token = creds.credentials
    try:
        decoded = firebase_auth.verify_id_token(token, clock_skew_seconds=60)
        return decoded
    except Exception as exc:
        print(f"verify_id_token failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )


from routes_bookings import router as bookings_router
from routes_notifications import router as notifications_router
from routes_tickets import router as tickets_router
from routes_users_admin import router as users_router


@app.get("/health")
def health_check():
    """Basic health check for load balancers/uptime monitors."""
    return {"status": "ok"}


@app.get("/healthz")
def healthz_check():
    """Kubernetes-style health endpoint (alias of /health)."""
    return {"status": "ok"}


@app.get("/users/me")
def get_me(current_user=Depends(get_current_user)):
    """Return the current user's profile summary used by the frontend."""
    uid = current_user["uid"]
    doc = db.collection("users").document(uid).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="User profile not found")

    data = doc.to_dict()
    return {
        "uid": uid,
        "email": current_user.get("email"),
        "name": data.get("name"),
        "role": data.get("role"),
    }


app.include_router(bookings_router)
app.include_router(notifications_router)
app.include_router(tickets_router)
app.include_router(users_router)
