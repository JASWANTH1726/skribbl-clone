# Skribbl.io Clone - Real-Time Multiplayer Drawing & Guessing Game

An end-to-end full-stack clone of **skribbl.io**, built with **React**, **TypeScript**, **HTML5 Canvas**, **Node.js**, **Express**, and **Socket.IO**.

---

## 🌐 Live Deployment
* **Live Application URL**: [https://skribbl-clone-1c9b.onrender.com](https://skribbl-clone-1c9b.onrender.com)
* **Status**: Live on Render as a unified web service. The frontend, REST health endpoint, and Socket.IO server share the same origin.

---

## 🚀 Architecture Overview

### 1. Object-Oriented Backend (`/server`)
State, gameplay, and security are managed strictly on the server:
* **`Player`**: Encapsulates socket identity, player profile (name, avatar), score, ready status, and drawing flags.
* **`Room`**: Manages room configuration (rounds, draw time, word count, 0–5 hints, custom words), player roster, host privileges, and stroke history. The server validates settings before accepting them; custom words are normalized, limited to 200 entries and 1,000 characters total, and must be unique, non-empty words of 2–30 letters/numbers with optional spaces or hyphens.
* **`Game`**: State machine managing turn queue, round progression (`lobby` → `word_select` → `drawing` → `round_end` → `game_over`), masked word generation (`_ _ a _ _`), hints, and dynamic scoring.
* **`WordManager`**: Curated dictionary across categories (animals, vehicles, objects, food, nature) with support for host-submitted sanitized custom words.
* **`RoomManager`**: Singleton registry handling room creation, 6-character room codes, socket indexing, and automatic room garbage collection.

### 2. Normalized Real-Time HTML5 Canvas (`/client`)
* Pure HTML5 Canvas API (lightweight, zero bloated dependencies).
* **Coordinate Normalization**: All pointer coordinates are mapped to relative ratios (`0.0 - 1.0`), ensuring exact stroke alignment across screens of different resolutions and aspect ratios.
* **Drawing Tools**: Paintbrush, eraser, 20-color Skribbl palette, 4 brush thickness sizes, undo last stroke, and clear canvas (drawer only).

### 3. Server-Authoritative Game Loop & Anti-Cheat
* **Word Selection**: The drawer selects from 1–5 word choices with a 15s timer (auto-pick fallback).
* **Synchronized Countdown**: Drawing timer is ticked server-side and broadcast to avoid client drift.
* **Progressive Hints**: Automatically reveals masked letters at 50% and 25% remaining time (or completely disabled if host configures 0 hints).
* **Anti-Cheating Guess Filter**: Correct guesses are withheld from chat to keep the game fair, displaying `Player X guessed the word!` while awarding points once per round based on speed.

---

## 🛠️ Tech Stack & Prerequisites

### Prerequisites
* **Node.js**: `v20.x` or `v22.x` or `v24.x`
* **npm**: `v10.x` or `v11.x`
* **Git**: `v2.x`

### Stack
* **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide React
* **Backend**: Node.js, Express, Socket.IO 4.7, TypeScript
* **Shared**: Typed event contracts (`ClientToServerEvents`, `ServerToClientEvents`) and domain interfaces
* **Testing**: Native Node test runner (`node:test`) and custom multiplayer socket E2E runner

---

## 📦 Project Structure

```
skribbl-clone/
├── render.yaml         # Render Blueprint deployment definition
├── package.json        # Root npm workspaces configuration
├── shared/             # TypeScript event contracts & interfaces
│   └── src/
│       ├── types.ts    # PlayerData, RoomSettings, GameState, DrawStroke
│       └── events.ts   # Typed Socket.IO event maps
├── server/             # Express & Socket.IO server
│   └── src/
│       ├── models/     # Player, Room, Game, WordManager, RoomManager
│       ├── sockets/    # Real-time event handlers
│       ├── data/       # Categorized word database
│       └── test-e2e.ts # 10-step multi-player verification suite
└── client/             # React + Vite application
    └── src/
        ├── components/ # Canvas, ChatBox, Modals (WordSelect, RoundEnd, GameOver)
        ├── context/    # SocketContext with latency monitoring
        └── views/      # HomeView, LobbyView, GameView
```

---

## 💻 Local Development Instructions

### 1. Installation
Clone the repository and install all workspace dependencies from the root directory:
```bash
git clone <your-repo-url>
cd skribbl-clone
npm install
```

### 2. Development Mode
Run the backend and frontend development servers concurrently in separate terminals:

**Terminal 1 (Backend Server on http://localhost:4000):**
```bash
npm run dev:server
```

**Terminal 2 (Frontend Client on http://localhost:5173):**
```bash
npm run dev:client
```

Open `http://localhost:5173` in two independent browser windows to play!

---

## 🧪 Testing Commands

### 1. Run Backend Domain Model Unit Tests
Tests model invariants, hint disabling, score calculations, and custom word sanitization:
```bash
npm test
```

### 2. Run Multiplayer End-to-End Integration Tests
Simulates two independent socket clients through room creation, joining, drawing sync, guessing, single-score enforcement, round transitions, and leaderboard verification:
```bash
npm run test:e2e
```

---

## 🏗️ Production Build Instructions

To build all packages for production:
```bash
npm run build
```
This command compiles:
1. `@skribbl/shared` (TypeScript definitions in `shared/dist`)
2. `@skribbl/server` (Node.js/Express compiled to `server/dist`)
3. `@skribbl/client` (Vite static bundle in `client/dist`)

To test the production build locally:
```bash
npm start
```
The server will start on `http://localhost:4000` and directly serve the production React app.

---

## 🚀 Render Deployment

The Render Blueprint in `render.yaml` creates one Node web service. The service builds the React client, then Express serves the built client and Socket.IO API from the same HTTPS origin. This preserves the existing architecture and avoids separate frontend/backend domain and CORS configuration.

1. Push the project to the connected GitHub repository.
2. Sign in to the [Render Dashboard](https://dashboard.render.com/), choose **New +** → **Blueprint**, and connect the repository containing this `render.yaml`.
3. Review the Blueprint and approve creation of the `skribbl-clone` web service.
4. Wait for the initial deployment to finish, then open the service's `onrender.com` URL. Render health-checks `/api/health`.
5. Confirm the page loads and Socket.IO connects before sharing the URL. The Render free plan may spin down when inactive, causing a delay on the first visit after inactivity.

Alternatively, create a Node **Web Service** manually with the repository root as the root directory, build command `npm install --include=dev && npm run build`, and start command `npm start`. Development dependencies must be installed during the build because TypeScript compiles the server before the service starts.

Deployments are triggered by pushes to the connected branch. Keep the frontend and backend in the same service unless you intentionally configure a separate frontend origin and backend CORS allowlist.

---

## ⚙️ Environment Variables

The application is pre-configured to work out of the box with zero required environment variables. The following optional variables are supported:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `4000` | Port for the unified Express and Socket.IO server. Render supplies this automatically. |
| `NODE_ENV` | `development` | Set to `production` in production environments. The Blueprint sets this automatically. |
| `CLIENT_ORIGINS` | *Empty* | Optional comma-separated exact origin allowlist for a separately hosted frontend (for example `https://game.example`). Do not include paths or use `*`. Same-origin deployment does not require this. |
| `VITE_SERVER_URL` | Current page origin | Optional build-time override for the Socket.IO server when the frontend is hosted separately. Set it in the build environment to the backend's HTTPS URL; do not use localhost in production. |

For separate frontend hosting, configure `CLIENT_ORIGINS` on the backend to the exact HTTPS frontend origin and set `VITE_SERVER_URL` when building the client. These variables are not needed for the unified Render Blueprint. Never put secrets in `VITE_*` variables because they are embedded in public frontend assets.

### Health and real-time behavior

`GET /api/health` returns service status and active room count. HTTP and Socket.IO CORS use the same exact-origin allowlist. WebSocket upgrades and polling are served by the same Express service. Game rooms and scores are held in memory, so use one backend instance; multiple instances would require shared game state and a Socket.IO adapter.
