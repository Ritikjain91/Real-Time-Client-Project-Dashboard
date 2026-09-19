# Velozity WorkOS | Real-Time Client Project Dashboard

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61dafb.svg)](https://react.dev/)
[![Express](https://img.shields.io/badge/Express-4.21-lightgrey.svg)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791.svg)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6.3-2d3748.svg)](https://www.prisma.io/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.8-black.svg)](https://socket.io/)

A full-stack, enterprise-grade client project management dashboard featuring strict server-side Role-Based Access Control (RBAC), real-time WebSocket live activity streams with online presence tracking, URL-synchronized filtering, and automated overdue task detection via scheduled background jobs.

---

## 🌟 Submission Explanation (150–250 Words)

> **The hardest problem solved, how the real-time role-filtered feed was handled, and one thing to do differently:**
>
> The hardest technical challenge was guaranteeing bulletproof data isolation across both asynchronous WebSocket events and synchronous REST queries without redundant database lookups or client-side trust. In a multi-tenant agency workflow, Developers must never intercept Project Manager payloads, and PMs must only observe activity in their own projects.
>
> We solved this by implementing a scoped WebSocket room hierarchy: `room:admin` for global oversight, `room:pm:${pmUserId}` and `room:project:${projectId}` for managers, and `room:dev:${developerId}` for assigned contributors. When a task status transitions, the server atomically creates the database `TaskActivity` record and selectively dispatches events exclusively to the authorized rooms. For offline users reconnecting, the `/api/activity` catch-up endpoint enforces the identical role-scoping logic via database-level `WHERE` clauses, retrieving the last 20 missed events directly from PostgreSQL rather than ephemeral memory.
>
> If designing this differently for a high-concurrency multi-instance deployment, I would replace the in-process `node-cron` scheduler with a Redis-backed BullMQ queue and integrate Socket.io Redis Adapter. While `node-cron` and local socket rooms are optimal and zero-overhead for single-node instances, a distributed Redis pub/sub layer would allow seamless horizontal scaling across auto-scaling container replicas without duplicate job executions or missed cross-node socket broadcasts.

---

## 🏗️ Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                        React 18 + TypeScript Client                    │
│  • Role-adaptive Dashboards (Admin, Project Manager, Developer)        │
│  • Socket.io Client (Presence Pulse, Scoped Feeds, Live Badges)        │
│  • URL Query Parameter Synchronization (?status=&priority=&range=)     │
│  • 1-Click Evaluator Quick-Login Toolbar (Instant Cookie Auth Switch)  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / REST + WSS (Socket.io)
┌───────────────────────────────────▼────────────────────────────────────┐
│                    Express + TypeScript API Server                     │
│  • JWT Auth: 15-min Bearer Access Token + 7-day HttpOnly Cookie Refresh │
│  • Strict Server-Side RBAC Middleware (Project/Task ownership guards)   │
│  • Zod Server-Side Input Validation & Structured Error Responses       │
│  • Real-Time Presence Tracker & Scoped Socket Room Broadcaster         │
│  • node-cron Overdue Task Scanner (Flags past deadlines every minute)  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Prisma ORM
┌───────────────────────────────────▼────────────────────────────────────┐
│                         PostgreSQL 16 Database                         │
│  • Relational schema: Users, Clients, Projects, Tasks, Activities,     │
│    Notifications, RefreshTokens                                        │
│  • B-Tree Indexes on foreign keys, status, dates, and activity logs    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🔐 Role-Based Access Control (RBAC) Specification

Role permissions are strictly enforced at the database and API middleware layers (`server/src/middleware/auth.middleware.ts`). Hiding elements on the client is purely visual convenience—direct REST calls with unauthorized tokens return `403 FORBIDDEN`.

| Capability | Admin | Project Manager (PM) | Developer |
| :--- | :---: | :---: | :---: |
| View All Clients & Projects | ✅ Full Access | ❌ (Own projects only) | ❌ (Assigned tasks only) |
| Create Projects & Assign Clients | ✅ Yes | ✅ (Own projects) | ❌ Forbidden (403) |
| Assign Tasks to Developers | ✅ Yes | ✅ (In own projects) | ❌ Forbidden (403) |
| View Tasks of Other Teams/Users | ✅ Yes | ❌ (Blocked at API) | ❌ (Blocked at API) |
| Update Task Status | ✅ Yes | ✅ (In own projects) | ✅ (Assigned tasks only) |
| Live Activity Feed Scope | Global Agency | Own Projects Only | Assigned Tasks Only |
| Online Presence Live Count | ✅ Yes | ❌ Hidden | ❌ Hidden |

---

## 🛠️ Architectural Decisions & Justifications

### 1. WebSocket Framework: Socket.io vs. Native WebSockets
- **Decision**: `Socket.io`
- **Justification**: The assessment requires granular room-based real-time broadcasts (`room:admin`, `room:project:${id}`, `room:dev:${id}`) and online presence tracking. Socket.io natively provides room multiplexing, handshake JWT authentication middleware, automatic heartbeat presence detection, and exponential-backoff reconnections. Building these primitives over raw WS would introduce boilerplate without architectural benefit.

### 2. Job Queue: node-cron vs. BullMQ
- **Decision**: `node-cron`
- **Justification**: Detecting overdue tasks requires a recurring batch query against active tasks where `dueDate < NOW()` and `status != 'DONE'`. Because this system runs in a standalone container/service, introducing Redis and BullMQ adds unnecessary external infrastructure, operational failure points, and RAM footprint. `node-cron` runs in-process with zero external dependencies, transactional PostgreSQL updates, and graceful termination hooks.

### 3. Token Security & Storage Strategy
- **Decision**: Dual-Token Architecture (Access Token + HttpOnly Refresh Cookie)
- **Justification**:
  - **Access Token**: Short-lived (15 minutes), passed in the `Authorization: Bearer <token>` header, verified in-memory for minimal DB latency.
  - **Refresh Token**: Long-lived (7 days), stored in an `HttpOnly`, `SameSite=Lax`, `Path=/api/auth` cookie. It is inaccessible to malicious browser JavaScript (XSS immune).
  - **Rotation**: Every call to `/api/auth/refresh` revokes the old refresh token hash in PostgreSQL and issues a new pair, mitigating replay attacks.

---

## 🗄️ Database Schema & Indexing Decisions

```
┌──────────────┐         1:N         ┌───────────────┐         1:N         ┌─────────────┐
│    Client    ├────────────────────►│    Project    ├────────────────────►│    Task     │
└──────────────┘                     └───────┬───────┘                     └──────┬──────┘
                                             │                                    │
                                      N:1    │                              1:N   │
┌──────────────┐                             ▼                                    ▼
│ RefreshToken │                     ┌───────────────┐                     ┌─────────────┐
└──────┬───────┘                     │     User      │                     │TaskActivity │
       │ 1:N                         └───────┬───────┘                     └─────────────┘
       └─────────────────────────────────────┘
```

### Strategic Indexing Decisions

| Model | Indexed Columns | Justification |
| :--- | :--- | :--- |
| **`Project`** | `managerId` | PM dashboard queries filter projects by `managerId`. Prevents sequential table scans. |
| **`Project`** | `clientId` | Rapid relational joining when rendering client portfolios and budgets. |
| **`Task`** | `(projectId, status)` | Composite index accelerating the most frequent query: filtering project tasks by status. |
| **`Task`** | `assignedToId` | Developer dashboard immediately pulls tasks assigned to `req.user.userId`. |
| **`Task`** | `(dueDate, status)` | The background `node-cron` scheduler queries `dueDate < NOW() AND status != DONE` every minute. This index makes overdue scanning an index-range scan $O(\log N)$ instead of a table scan $O(N)$. |
| **`TaskActivity`**| `(projectId, createdAt DESC)` | Powers the live activity feed and offline 20-event catchup ordered chronologically. |
| **`Notification`**| `(userId, isRead, createdAt DESC)` | Optimizes unread count computation and notification dropdown ordering. |
| **`RefreshToken`**| `tokenHash` | Hash lookup during token rotation and instant revocation on logout. |

---

## ⚡ Quick Start & Local Setup

### Option A: Turnkey Setup via Docker Compose (Recommended)

Requires Docker Desktop installed and running:

```bash
# 1. Clone repository
git clone https://github.com/your-username/real-time-client-project-dashboard.git
cd real-time-client-project-dashboard

# 2. Launch PostgreSQL, Backend API, and Frontend
docker compose up -d

# 3. Seed database with initial users, projects, and activities
docker compose exec server npx tsx prisma/seed.ts

# 4. Open in browser
# Frontend: http://localhost:5173
# Backend API: http://localhost:5000/health
```

---

### Option B: Local Development (Native Node.js)

#### 1. Prerequisites
- Node.js >= 20.x
- PostgreSQL running locally (e.g. `localhost:5435` or standard `5432`)

#### 2. Configure Backend
```bash
cd server
cp .env.example .env
# Update DATABASE_URL in .env if needed

npm install
npx prisma db push
npx tsx prisma/seed.ts
npm run dev
```

#### 3. Configure Frontend
```bash
# In a separate terminal
cd client
npm install
npm run dev
```
Visit `http://localhost:5173/` in your browser.

---

## 🧪 Automated Testing & Verification

Run the automated integration test suite validating RBAC, token rotation, cross-role access denial, and background overdue scanning:

```bash
cd server
npm run test:api
```

Expected output:
```
=============================================
🧪 RUNNING RBAC & REAL-TIME TEST SUITE
=============================================
1. Authentication & Token Generation:
  ✅ PASS: Admin can authenticate with JWT
  ✅ PASS: PM Sarah can authenticate
  ✅ PASS: PM Marcus can authenticate
  ✅ PASS: Dev Alex can authenticate
  ✅ PASS: Dev Priya can authenticate

2. Refresh Token Rotation:
  ✅ PASS: Refresh token rotates successfully and issues new tokens
  ✅ PASS: Old revoked refresh token is strictly rejected

3. Project Scoping & RBAC Enforcement:
  ✅ PASS: Admin sees all 3 projects
  ✅ PASS: PM Sarah sees ONLY her 2 projects
  ✅ PASS: PM Marcus sees ONLY his 1 project
  ✅ PASS: PM Marcus is forbidden (403) from accessing PM Sarah's project

4. Developer Task Isolation:
  ✅ PASS: Developer Alex sees only tasks assigned to him
  ✅ PASS: Dev Priya cannot access Dev Alex's assigned task (403 Forbidden)

5. Task Status Transition, Activity Logging & Notifications:
  ✅ PASS: Activity log inserted in DB
  ✅ PASS: PM received notification for review

6. Role-Filtered Activity Feed (Offline Catchup):
  ✅ PASS: Admin feed catches up on all global events
  ✅ PASS: Developer feed catches up strictly on their assigned tasks

7. Background Overdue Scanner:
  ✅ PASS: Overdue task scanner executed cleanly

=============================================
TEST RESULTS: 18 PASSED, 0 FAILED
=============================================
```

---

## 👥 Seed Credentials & Evaluator Quick-Login

The UI includes an **Evaluator Quick-Login Bar** at the top, allowing 1-click role transitions between users with active JWT HttpOnly sessions.

| Role | Name | Email | Password | Scope / Permissions |
| :--- | :--- | :--- | :--- | :--- |
| **Admin** | Eleanor Vance | `admin@agency.com` | `Password123!` | Global visibility, all 3 projects, live online presence count |
| **Project Manager** | Sarah Connor | `sarah.pm@agency.com` | `Password123!` | Projects 1 & 2 (Acme, Finovate), assigns tasks, receives review alerts |
| **Project Manager** | Marcus Brody | `marcus.pm@agency.com` | `Password123!` | Project 3 (HealthPulse), cannot view Sarah's projects |
| **Developer** | Priya Sharma | `priya.dev@agency.com` | `Password123!` | Assigned tasks only, status updater, targeted activity feed |
| **Developer** | Alex Rivera | `alex.dev@agency.com` | `Password123!` | Assigned tasks only, cannot see Priya's tasks |
| **Developer** | David Chen | `david.dev@agency.com` | `Password123!` | Assigned tasks only |
| **Developer** | Elena Rostova | `elena.dev@agency.com` | `Password123!` | Assigned tasks only |

---

## ⚠️ Known Limitations & Future Enhancements

1. **Multi-Instance WebSockets**: In a horizontally scaled cluster behind a load balancer, Socket.io requires `@socket.io/redis-adapter` so sockets connected to Node Instance A can broadcast to sockets on Node Instance B.
2. **Distributed Job Locks**: In multi-replica deployments, `node-cron` would fire simultaneously on all pods. Adding Redis-based distributed locks (Redlock) or migrating to BullMQ prevents duplicate overdue task processing.
3. **Audit History Log Archival**: High-frequency status changes generate extensive `TaskActivity` rows. For enterprise volume, an automated cold-storage partition (PostgreSQL table partitioning by month) would maintain sub-millisecond query latency.
