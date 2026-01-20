# Backend (Node/Express)

Express API powering authentication, sessions, and integrations with MongoDB, Clerk, Stream, and optional Inngest.

## Overview
- Framework: Express (ES modules)
- DB: MongoDB via Mongoose
- Auth: Clerk (via `@clerk/express` middleware)
- Video/Chat: Stream (Node SDK)
- Background jobs (optional): Inngest

Entry point: `src/server.js`

## Environment Variables
Create `backend/.env` (see root README for details and how to obtain keys):
```
PORT=3000
NODE_ENV=development

DB_URL=mongodb://127.0.0.1:27017/mern_video_call   # or your Atlas URL

# Migration URLs
LOCAL_DB_URI=mongodb://127.0.0.1:27017/mern_video_call
ATLAS_DB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/mern_video_call?retryWrites=true&w=majority

INNGEST_EVENT_KEY=...
INNGEST_SIGNING_KEY=...

STREAM_API_KEY=...
STREAM_API_SECRET=...

CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...

CLIENT_URL=http://localhost:5173
```

## Run locally
```
npm install
npm run dev
```
Health: http://localhost:3000/health

## Auth model
- `protectRoute` uses Clerk middleware to require auth and then loads the user from MongoDB by `clerkId`.
- In production, user creation is handled by Inngest on Clerk webhooks (`clerk/user.created`).
- In local dev (without webhooks), seed your user manually (see below) before calling protected routes.

## Data models
- `User` (`src/models/User.js`)
  - `name` (String, required)
  - `email` (String, required, unique)
  - `profileImage` (String)
  - `clerkId` (String, required, unique)
- `Session` (`src/models/Session.js`)
  - `problem` (String, required)
  - `difficulty` ("easy"|"medium"|"hard", required)
  - `host` (ObjectId -> User, required)
  - `participant` (ObjectId -> User)
  - `status` ("active"|"completed", default "active")
  - `callId` (String) – Stream call id

## Routes
Base URL: `http://localhost:3000`

- `GET /health`
  - Returns `{ msg: "api is up and running" }`

- `POST /api/sessions` (auth required)
  - Body: `{ problem: string, difficulty: "easy"|"medium"|"hard" }`
  - Creates a session, provisions Stream Video call, creates a Stream chat channel.

- `GET /api/sessions/active` (auth required)
  - Lists recent active sessions, populated with host/participant minimal fields.

- `GET /api/sessions/my-recent` (auth required)
  - Lists recent completed sessions for the authenticated user.

- `GET /api/sessions/:id` (auth required)
  - Fetch a session by id (populated host/participant).

- `POST /api/sessions/:id/join` (auth required)
  - Joins an active session as participant (if not full and not host).

- `POST /api/sessions/:id/end` (host only)
  - Ends the session, deletes Stream call and chat channel, marks session completed.

- `GET /api/chat/token` (auth required)
  - Returns a Stream Chat token for the authenticated user (`{ token, userId, userName, userImage }`).

## Testing with curl/Postman
All protected routes require a Clerk bearer token:
- Sign in via the frontend (http://localhost:5173) and capture the session token, or use Clerk Dev Browser to get a JWT.
- Add header: `Authorization: Bearer <CLERK_JWT>`

Example create session:
```
curl -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <CLERK_JWT>" \
  -d '{"problem":"Two Sum","difficulty":"easy"}'
```

## Local seeding (if user not found)
If `POST /api/sessions` returns 404 "User not found", seed your Clerk user into MongoDB:
```
use mern_video_call

db.users.insertOne({
  clerkId: "<YOUR_CLERK_USER_ID>",
  email: "you@example.com",
  name: "Your Name",
  profileImage: ""
})
```
Ensure you insert into the same DB referenced by `DB_URL`.

## Inngest webhooks (optional)
- The backend registers Inngest functions in `src/lib/inngest.js` to create/delete users on Clerk events.
- To use locally, expose your server via a tunnel (e.g., ngrok) and configure Clerk webhooks to hit `/api/inngest`.

## Troubleshooting
- Mongo connection errors: confirm `mongod` is running (or Atlas credentials/IP allowlist), and `DB_URL` is correct.
- 401 Unauthorized: ensure `Authorization: Bearer <token>` is present and keys are valid.
- 404 User not found: seed the user (above) or implement auto-create on first request.
- CORS: backend uses `CLIENT_URL` for CORS origin. Match your frontend origin.

## Notes on recordings (not enabled by default)
- No recording storage is implemented. To store/retrieve recordings, enable Stream cloud recordings and add a webhook + fields on `Session` to persist asset info.
