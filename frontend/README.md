# Video Call Frontend

A React + Vite frontend for a 1‑on‑1 interview and practice platform with real‑time video, chat, and a VS Code‑like coding experience.

## Overview
This frontend connects to the Node/Express backend and Stream/Clerk services to provide:
- Authentication (Clerk)
- 1‑on‑1 video sessions (Stream Video SDK)
- Real‑time chat (Stream Chat)
- Coding panel with Monaco editor
- Session management, recent sessions, and dashboards

## Features
- Secure auth flow with Clerk
- Create/join end‑to‑end encrypted video rooms
- Mute/unmute, camera toggle, screen share
- Real‑time messaging inside each session
- Responsive layout and modern UI (Tailwind + DaisyUI)

## Tech Stack
- React 19, Vite 7, React Router
- Tailwind CSS 4, DaisyUI
- @stream-io/video-react-sdk, stream-chat, stream-chat-react
- @clerk/clerk-react
- @tanstack/react-query

## Prerequisites
- Node.js 18+ (Node 20 LTS recommended)
- Backend running at http://localhost:3000 (see project root README)
- Accounts/keys:
  - Clerk Publishable Key
  - Stream API Key

## Environment Variables
Create a `.env` file in `frontend/` with:

```
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
VITE_API_URL=http://localhost:3000/api
VITE_STREAM_API_KEY=your_stream_api_key
```

Notes:
- Only use publishable/public keys in the frontend. Secrets belong in the backend.
- Restart `npm run dev` after changing env vars.

## Setup & Scripts
Install dependencies:
```
npm install
```

Start dev server:
```
npm run dev
```
Vite will print a local URL (default: http://localhost:5173).

Build for production:
```
npm run build
```

Preview production build locally:
```
npm run preview
```

Lint:
```
npm run lint
```

## Project Structure (frontend)
```
frontend/
  src/
    components/     # UI components and panels
    pages/          # Route-level pages
    hooks/          # React hooks (query, auth, etc.)
    lib/            # API clients, utils
    styles/         # Tailwind setup if applicable
  index.html
  vite.config.js
  eslint.config.js
```

## Troubleshooting
- Blank screen or auth errors: verify `VITE_CLERK_PUBLISHABLE_KEY` and the Clerk app URLs (localhost allowed).
- 401/403 from API: ensure you’re signed in and backend `CLERK_SECRET_KEY` is correct.
- Network errors: confirm `VITE_API_URL` points to the running backend (default: http://localhost:3000/api).
- Video/Chat issues: verify `VITE_STREAM_API_KEY` (frontend) and Stream keys/secrets (backend).

---
For backend configuration, environment variables, and service keys (Clerk, Stream, Inngest, MongoDB), see the root README.
