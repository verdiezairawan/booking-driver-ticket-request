# booking-driver-ticket-request

## Staging Deploy (Render + Vercel)

### Backend (Render)
- Root Directory: `backend`
- Build Command: `pip install -r requirements.txt`
- Start Command: `python -m uvicorn main:app --host 0.0.0.0 --port $PORT`
- Environment Variables:
  - `FIREBASE_SERVICE_ACCOUNT_JSON`: service account JSON (string)
  - `CORS_ORIGINS`: comma-separated, example `https://<your-vercel-domain>`

### Frontend (Vercel)
- Root Directory: `frontend`
- Environment Variables:
  - `VITE_API_BASE_URL`: `https://<your-render-backend-url>`

### Firebase Auth
- Firebase Console → Authentication → Settings → Authorized domains → add `https://<your-vercel-domain>`
