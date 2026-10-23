# Skribbl.io Clone - Real-Time Multiplayer Drawing & Guessing Game

An end-to-end full-stack clone of **skribbl.io**, built with **React**, **TypeScript**, **HTML5 Canvas**, **Node.js**, **Express**, and **Socket.IO**.

---

## 🌐 Live Deployment
* **Live Application URL**: `[DEPLOYMENT_PENDING: Add your Render live URL here after deployment, e.g. https://skribbl-clone-xxxx.onrender.com]`
* **Status**: Ready for production deployment on Render.

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

## 🚀 Step-by-Step Render Deployment Guide

Follow these exact steps to deploy the application on [Render](https://render.com/):

### Option A: Standard Web Service Setup (Recommended)
1. Push your project code to a GitHub or GitLab repository.
2. Sign in to your **Render Dashboard** and click **New +** → **Web Service**.
3. Connect your repository.
4. Configure the Web Service settings:
   * **Name**: `skribbl-clone` (or your chosen name)
   * **Region**: Oregon (US West) or closest to your location
   * **Branch**: `main`
   * **Root Directory**: Leave blank (root of repository)
   * **Runtime**: `Node`
   * **Build Command**:
     ```bash
     npm install && npm run build
     ```
   * **Start Command**:
     ```bash
     npm start
     ```
   * **Instance Type**: `Free`
5. Click **Create Web Service**.
6. Render will automatically build the client and server, start the unified process, and provide you with a live HTTPS URL (e.g. `https://skribbl-clone-xxxx.onrender.com`).
7. Copy your live URL and paste it into the **Live Application URL** section above.

### Option B: Blueprint Deployment (`render.yaml`)
1. Click **New +** → **Blueprint** on Render.
2. Select your repository. Render will automatically detect the included `render.yaml` file and deploy the service with all settings pre-configured.

---

## ⚙️ Environment Variables

The application is pre-configured to work out of the box with zero required environment variables. The following optional variables are supported:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `4000` | Port for the unified Express and Socket.IO server. (Render sets this automatically). |
| `NODE_ENV` | `development` | Set to `production` in production environments. |
| `VITE_SERVER_URL` | *None* | Optional override for frontend socket target if hosting client and server on separate domains. |
