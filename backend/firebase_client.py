import firebase_admin
from firebase_admin import credentials, firestore, auth
import os


SERVICE_ACCOUNT_PATH = os.getenv("FIREBASE_SERVICE_ACCOUNT", "bdtrex-development-firebase-adminsdk.json")

if not firebase_admin._apps:
    cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
    firebase_admin.initialize_app(cred)

db = firestore.client()
