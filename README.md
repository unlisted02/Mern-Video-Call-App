# MERN Video Call App

1‑on‑1 interview/practice platform featuring real‑time video, chat, and a VS Code‑like coding experience. Auth is powered by Clerk; video and chat by Stream; data stored in MongoDB. Optional background jobs use Inngest.

## Architecture
- **frontend/**: React 19 + Vite 7, Tailwind, Stream Video/Chat SDKs, Clerk React.
- **backend/**: Node.js + Express, Mongoose, Clerk Express, Stream Node SDK, Inngest.
- **Database**: MongoDB (Atlas or local).

## Features
- Authentication with Clerk
- Create/join 1‑on‑1 video rooms (Stream Video SDK)
- Real‑time chat (Stream Chat)
- Coding panel (Monaco editor)
- Session management and recent sessions

## Requirements
- Node.js 18+ (Node 20 LTS recommended)
- npm 9+
- MongoDB (Atlas or local Community Server)
- Accounts/keys: Clerk, Stream, (optional) Inngest

## Environment Variables
Create these files with your values.

Backend: `backend/.env`
```
PORT=3000
NODE_ENV=development

DB_URL=your_mongodb_connection_url

INNGEST_EVENT_KEY=your_inngest_event_key
INNGEST_SIGNING_KEY=your_inngest_signing_key

STREAM_API_KEY=your_stream_api_key
STREAM_API_SECRET=your_stream_api_secret

CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key

CLIENT_URL=http://localhost:5173
```

Frontend: `frontend/.env`
```
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
VITE_API_URL=http://localhost:3000/api
VITE_STREAM_API_KEY=your_stream_api_key
```

⚠️ Never commit `.env` files.

## Getting Keys
- **Clerk (Auth)**: https://clerk.com → Create app → Dashboard → API Keys.
  - Publishable Key → `VITE_CLERK_PUBLISHABLE_KEY` (frontend) and `CLERK_PUBLISHABLE_KEY` (backend)
  - Secret Key → `CLERK_SECRET_KEY` (backend only)
  - Set URLs: Home/Redirects `http://localhost:5173` (local dev)

- **Stream (Video/Chat)**: https://getstream.io → Create App → Keys & Tokens.
  - API Key → `VITE_STREAM_API_KEY` (frontend) and `STREAM_API_KEY` (backend)
  - API Secret → `STREAM_API_SECRET` (backend only)

- **Inngest (optional)**: https://www.inngest.com → Project → Settings → API Keys.
  - `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` (backend only)
  - For local, you can skip webhooks and seed users manually (see Troubleshooting) or set up a tunnel for webhooks.

- **MongoDB**:
  - Atlas: copy Driver connection string into `DB_URL`.
  - Local: `DB_URL=mongodb://127.0.0.1:27017/mern_video_call` and ensure mongod is running.

## Local Development
1) Backend
```
cd backend
npm install
npm run dev
```
Health check: http://localhost:3000/health

2) Frontend
```
cd frontend
npm install
npm run dev
```
Open: http://localhost:5173

## API Routes (backend)
- `GET /health` – health probe
- `POST /api/sessions` – create a session (auth required)
- `GET /api/sessions/active` – list active sessions (auth required)
- `GET /api/sessions/my-recent` – list recent sessions (auth required)
- `GET /api/sessions/:id` – get session by id (auth required)
- `POST /api/sessions/:id/join` – join an active session (auth required)
- `POST /api/sessions/:id/end` – end a session (host only)
- `GET /api/chat/token` – get Stream chat token (auth required)

## Troubleshooting
- **MongoDB connection EACCES/ECONNREFUSED**
  - Ensure mongod is running (Windows Service or manual start) and firewall allows it.
  - Try `DB_URL=mongodb://localhost:27017/mern_video_call` if 127.0.0.1 fails.

- **User not found (POST /api/sessions → 404)**
  - Cause: DB has no user document for the signed‑in Clerk user. In production this is handled by Clerk → Inngest webhook (`clerk/user.created`).
  - Quick fix (local): seed the user manually in your DB:
    ```
    use mern_video_call
    db.users.insertOne({
      clerkId: "<YOUR_CLERK_USER_ID>",
      email: "you@example.com",
      name: "Your Name",
      profileImage: ""
    })
    ```
  - Alternative: implement auto‑create on first request in `protectRoute` or configure webhooks with a public tunnel.

- **npm cache / corrupted node_modules**
  - Run in backend: `rmdir node_modules -Recurse -Force; del package-lock.json; npm cache clean --force; npm install`
  - Prefer Node 20 LTS.

- **CORS/Auth issues**
  - Backend uses `CLIENT_URL` for CORS. Ensure it matches `http://localhost:5173`.
  - Verify Clerk URLs/domains allow localhost and your publishable/secret keys are correct.

- **Recordings**
  - Not enabled by default. To store/retrieve recordings, enable Stream cloud recordings and add a webhook + schema fields (see below).

## Recording (optional enhancement)
- Enable Stream cloud recordings in Stream Dashboard.
- Add a webhook endpoint (e.g., `/api/stream/webhook`) to capture `asset.ready` events.
- Extend `Session` schema with fields like `recordingAssetId`, `recordingUrl`, `recordingStatus`.
- Save asset info by matching event `callId` to the session.

## Deployment Notes
- Set `NODE_ENV=production` and build the frontend (`frontend/npm run build`).
- The backend serves `frontend/dist` when in production mode.
- Set production `CLIENT_URL` to your site domain and update Clerk/Stream app URLs.

---
Frontend README: `frontend/README.md` contains UI‑specific instructions and env vars.
