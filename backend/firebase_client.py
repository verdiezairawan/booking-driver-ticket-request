import json
import os

import firebase_admin
from firebase_admin import credentials, firestore


class FirestoreClientProxy:
    def __init__(self) -> None:
        self._client = None

    def set_client(self, client) -> None:
        self._client = client

    def get_client(self):
        if self._client is None:
            raise RuntimeError("Firestore client not initialized. Ensure Firebase Admin is initialized on startup.")
        return self._client

    def __getattr__(self, name: str):
        return getattr(self.get_client(), name)


db = FirestoreClientProxy()


def init_firebase_admin() -> None:
    if firebase_admin._apps:
        if db._client is None:
            db.set_client(firestore.client())
        return

    service_account_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
    service_account_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")

    if service_account_json:
        credential_source = "env_json"
        try:
            service_account_info = json.loads(service_account_json)
        except json.JSONDecodeError as exc:
            raise RuntimeError("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON") from exc

        try:
            cred = credentials.Certificate(service_account_info)
        except Exception as exc:
            raise RuntimeError(
                "FIREBASE_SERVICE_ACCOUNT_JSON does not contain a valid Firebase service account JSON."
            ) from exc
    elif service_account_path:
        credential_source = "env_path"
        if not os.path.exists(service_account_path):
            raise RuntimeError("FIREBASE_SERVICE_ACCOUNT_PATH points to a missing file.")

        try:
            cred = credentials.Certificate(service_account_path)
        except Exception as exc:
            raise RuntimeError("Failed to load Firebase Admin credentials from FIREBASE_SERVICE_ACCOUNT_PATH.") from exc
    else:
        raise RuntimeError(
            "Firebase Admin credentials not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH."
        )

    print(f"Firebase Admin creds source: {credential_source}")
    firebase_admin.initialize_app(cred)
    db.set_client(firestore.client())


def get_db():
    init_firebase_admin()
    return db.get_client()
