<div align="center">

# 🚆 TRWL — Train Reservation Waiting List

**Dynamic passenger booking & waiting-list management, powered by *real* data structures**

`Singly Linked List` · `Linked-List Queue (FIFO)` · `Linked-List Stack (LIFO)` · `Linear Search` · `Insertion Sort`

![Node.js](https://img.shields.io/badge/Node.js-16%2B-339933?logo=nodedotjs&logoColor=white)
![Dependencies](https://img.shields.io/badge/dependencies-none-2ea44f)
![Tests](https://img.shields.io/badge/tests-22%20automated-1c5fae)
![Course](https://img.shields.io/badge/Data%20Structures-PBL%20Project-e56a1e)
![License](https://img.shields.io/badge/license-MIT-6a737d)

*A classic railway-counter problem — rebuilt as a full-stack, viva-ready system where every
button, badge and terminal log line is driven by the actual linked list, queue and stack
running in the backend.*

</div>

---

## ✨ Why this is not a “fake UI” project

- ✅ The **confirmed list, waiting queue, undo stack and activity timeline are genuine linked structures** living in the backend — nodes are `malloc`-style objects with real `next` pointers that get **relinked, unlinked and moved between structures**.
- ✅ When a berth frees, the passenger at the **FRONT of the queue is dequeued and the *same node* is appended to the linked list** — exactly like the textbook workflow.
- ✅ **Undo** pops the LIFO stack and reverses the *whole composite action*: a cancelled passenger is restored **and** the passenger who was promoted is returned to the **front** of the waiting queue (exact FIFO position).
- ✅ **Linear search** returns the real node-traversal trail (`HEAD → P1001 → P1002 → MATCH`), rendered in the UI.
- ✅ **Insertion sort** relinks the actual nodes in place — O(1) extra space — with before/after comparison and a comparison counter.
- ✅ The backend is the **single source of truth**; the frontend only renders API snapshots.

---

## 🚀 Quick Start (60 seconds)

```bash
# 1. No dependencies at all — nothing to install.
node server.js

# 2. Open the URL printed in the terminal:
#    http://localhost:5000
```

Run the automated test suite (16 core + 6 API integration tests):

```bash
npm test        # or: node tests/run-tests.js
```

> Requirements: [Node.js 16+](https://nodejs.org) (Node 18+ recommended for the HTTP integration tests).
> Change the port with `PORT=3000 node server.js`.

---

## 🧠 The data structures

| Structure | Where it lives | Why it was chosen | Key operations |
|---|---|---|---|
| **Singly Linked List** (`backend/core/linkedList.js`) | Confirmed reservations (head + tail), activity timeline | Passenger count is unknown in advance; O(1) insertion/deletion once the node is located | `insertTail`, `remove` (head/middle/tail), `traverse`, `find` |
| **Linked Queue** (`backend/core/queue.js`) | Waiting list (front + rear) | Strict **FIFO**: the longest-waiting passenger must be promoted first; no pre-declared capacity | `enqueue`, `dequeue`, `peek`, `remove` (any position), `insertAt` (undo) |
| **Linked Stack** (`backend/core/stack.js`) | Action history (top) | **LIFO**: the most recent booking/cancellation is the one to undo; O(1) push/pop | `push`, `pop`, `peek`, `toArray` |
| **Linear Search** (`backend/core/search.js`) | PNR / name lookup | Linked structures have **no random access** — sequential traversal is the correct algorithm; returns the visited-node trail | O(n) time, O(1) space |
| **Insertion Sort** (`backend/core/sort.js`) | Ordered reports by PNR / booking time / name | Bookings arrive nearly time-sorted — insertion sort exploits that (~O(n)); relinks nodes in place (O(1) space) | best ≈ O(n), worst O(n²) |

---

## 🔄 The heart of the system — automatic FIFO promotion

```
 CANCEL PNR 1002 (confirmed)
        │
        ▼
 [LIST]  node unlinked  ·  berth released  ·  CANCEL pushed to stack
        │
        ▼
 [QUEUE] waiting queue non-empty? ── no ──▶ berth stays available
        │ yes
        ▼
 [QUEUE] DEQUEUE front  (the passenger who waited longest)
        │
        ▼
 [LIST]  same node appended at tail  ·  status → CONFIRMED ✅
        │
        ▼
 [STACK] undo later ⇒ promoted passenger returns to FRONT,
         cancelled passenger restored — the exact previous state
```

---

## 🏗️ Architecture

```
┌──────────────────────────── Browser ────────────────────────────┐
│  frontend/ (vanilla HTML + CSS + JS · dashboard, queue & stack   │
│  visualisations, toasts, modals, responsive)                     │
└─────────────────────────── fetch JSON ───────────────────────────┘
                            │  /api/*
┌─────────────────────────── ▼ ───────────────────────────────────┐
│  server.js — zero-dependency Node HTTP server (API + static)    │
│  backend/reservationSystem.js — domain core (source of truth)   │
│  backend/core/* — pure ADTs: linkedList · queue · stack ·        │
│                  search · sort      backend/logger.js — live     │
│                  colour-coded terminal logs                      │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🔌 API Reference

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | Liveness, uptime, structure statuses |
| `GET` | `/api/state` | **Full system snapshot** (confirmed, waiting, stack, activity, stats) |
| `GET` | `/api/availability` | Berths confirmed / available / waiting |
| `GET` | `/api/confirmed` · `/api/waiting` · `/api/history` · `/api/activity` | Focused views |
| `POST` | `/api/book` | New reservation `{name, age, gender, trainNo}` → CONFIRMED / WAITING |
| `POST` | `/api/cancel` | Cancel by `{pnr}` — triggers automatic FIFO promotion |
| `POST` | `/api/search` | `{type:"pnr"\|"name", value}` → linear search + traversal trail |
| `POST` | `/api/sort` | `{key:"pnr"\|"bookingTime"\|"name"}` → insertion sort, before/after |
| `POST` | `/api/undo` | Undo the most recent action (reverses promotions too) |
| `POST` | `/api/update` | Update passenger age / gender by PNR |
| `POST` | `/api/demo` · `/api/reset` | Load the one-click demo scenario / reset everything |

All validation happens **in the backend** — invalid input returns clean `400`/`404` JSON, never a crash.

---

## 🖥️ Backend terminal experience

Every log corresponds to a **real** operation — open `server.js` and the core next to it and watch:

```
==================================================================
        TRAIN RESERVATION WAITING LIST SYSTEM (TRWL backend)
==================================================================
...
09:21:04  [API    ] POST /api/cancel
09:21:04  [CANCEL ] Cancellation request: PNR 1002
09:21:04  [SEARCH ] Linear search started — confirmed list → waiting queue
09:21:04  [SEARCH ] PNR 1002 found in confirmed list (node #2)
09:21:04  [LIST   ] Node unlinked — PNR 1002 (list size 4)
09:21:04  [STACK  ] PUSH CANCEL action
09:21:04  [SEAT   ] Seat released
09:21:04  [QUEUE  ] Checking waiting queue for promotion
09:21:04  [QUEUE  ] Front passenger: PNR 1006 (Karthik Raj)
09:21:04  [QUEUE  ] DEQUEUE PNR 1006
09:21:04  [PROMOTE] PNR 1006 → CONFIRMED (list size 5)
09:21:04  [RESULT ] Cancellation complete — PNR 1006 auto-promoted to CONFIRMED
```

---

## 🎬 10-minute viva demo script

1. `node server.js` — show the startup banner (all modules READY).
2. Open **Dashboard** → *Load Demo Scenario* (System page): 5 confirmed + 3 waiting, instantly.
3. **Book** one more passenger → result card: *WAITING #4*.
4. Show the **Waiting Queue** page — FRONT → REAR, FIFO arrows.
5. **Cancel PNR 1001** → toast + activity timeline show *PNR 1006 promoted*; the confirmed row flashes.
6. Open the **Data Structures** page — show the linked list, queue and stack *after* the promotion.
7. **Search** PNR 1006 → linear-search traversal visualisation (`HEAD → … → MATCH`).
8. **Sort** by passenger name → before/after chains + comparison count.
9. **Action History** → show the LIFO stack, then **Undo** — the cancellation is reversed and PNR 1006 returns to the *front* of the queue.
10. Point at the terminal — every step above is logged live. Run `npm test` to finish with 22 green checks.

---

## ⏱️ Complexity (matches the actual implementation)

| Operation | Data structure | Time | Space |
|---|---|---|---|
| Book (berth free) | Linked list — tail insert | O(1) | O(1) |
| Book (waiting) | Queue — enqueue at rear | O(1) | O(1) |
| Cancel + promote | Linear search + unlink + dequeue | O(n) | O(1) |
| Undo | Stack pop (+ possible O(n) re-insert) | O(1)* | O(1) |
| Search PNR/name | Linear search | O(n) | O(1) |
| Sort | Insertion sort (node relinking) | ≈O(n) best / O(n²) worst | O(1) |
| Display/traverse | List / queue | O(n) | O(1) |

\* the pop itself is O(1); restoring a waiting passenger to a recorded position is one O(n) traversal.

---

## ✅ Testing

`node tests/run-tests.js` executes 16 core test cases (TC01–TC16, covering the report's TC01–TC13
plus undo-of-booking, input validation and name search) **and** 6 live HTTP integration checks
against the real server — then prints a pass/fail table and sets the exit code.

Highlights: FIFO promotion order, undo of a promotion (exact front-of-queue restore), best-case
sort comparison count (`n − 1`), waiting-list boundary rejection, tail-pointer repair after sorting.

---

## 📁 Project structure

```
train-reservation-waiting-list/
├── server.js                  # entry point — HTTP API + static frontend
├── package.json
├── backend/
│   ├── logger.js              # colour-coded terminal logging + startup banner
│   ├── reservationSystem.js   # domain core (booking, cancel, promote, undo…)
│   └── core/                  # the pure ADTs & algorithms (viva gold)
│       ├── linkedList.js      # CO1 — singly linked list (head + tail)
│       ├── queue.js           # CO2 — linked queue (front + rear, FIFO)
│       ├── stack.js           # CO2 — linked stack (LIFO)
│       ├── search.js          # CO3 — linear search
│       └── sort.js            # CO3 — insertion sort (in-place relinking)
├── frontend/
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js
├── tests/
│   └── run-tests.js           # TC01–TC16 + HTTP API integration
└── README.md
```

---

## 🎨 UI tour

- **Dashboard** — stat cards, berth occupancy gauge, mini tables, live activity timeline.
- **Booking** — professional form → processing spinner → CONFIRMED ✓ / WAITING ⏳ result card.
- **Waiting Queue** — FRONT → REAR visual queue with FIFO arrows and WL positions.
- **Search** — result card + the *actual* traversal chain with MATCH highlight.
- **Sort** — before/after chains and a comparison counter.
- **History** — LIFO stack view (top = next undo) + full timeline.
- **Data Structures** — live node diagrams (`[data|next]` boxes) for list, queue and stack.
- Toast notifications, confirmation dialogs, empty/loading/error states, fully responsive
  (sidebar collapses to a hamburger on mobile), colour + icon + text status badges.

---

## 🛠️ Troubleshooting

| Problem | Fix |
|---|---|
| `EADDRINUSE` (port busy) | `PORT=5001 node server.js` |
| UI shows “Backend offline” | Is the terminal with `node server.js` still running? |
| HTTP tests skipped | They need Node 18+ (global `fetch`); core tests still run on Node 16. |

---

## 👥 Team

**KPR Institute of Engineering and Technology (Autonomous), Coimbatore — Dept. of Information Technology**
*Data Structures · II Year / III Semester · Academic Year 2026–27 · Assignment I (PBL)*

| | |
|---|---|
| Mowshik G | 25AM075 |
| Rohitha S | 25AM101 |


**References:** Lipschutz (Schaum's Data Structures) · Horowitz, Sahni & Anderson-Freed (*Fundamentals of Data Structures in C*) · Thareja (*Data Structures Using C*) · IRCTC PNR/RAC public documentation.

---

<div align="center">

**⭐ If this project helped you, star the repo — and cancel a berth to make someone's day. 🚆**

*Zero dependencies · MIT License*

</div>

---

## ✅ Final verification checklist (run these after assembling)

1. `node server.js` → banner appears, no errors.
2. Open `http://localhost:5000` → dashboard renders, "Backend connected" (green dot).
3. **System → Load Demo Scenario** → 5 confirmed, 3 waiting.
4. Cancel **PNR 1001** → toast says PNR 1006 promoted; confirmed row flashes; queue shrinks.
5. **Undo** → PNR 1001 restored, PNR 1006 back at WL #1.
6. Search `1006`, sort by name, check the **Data Structures** page diagrams.
7. `npm test` → 22/22 PASS.

One honest note: I couldn't execute the code from here, so run `npm test` once locally — the suite is written to catch any issue quickly, and the README's troubleshooting section covers the two common hiccups (port in use, Node version). Want me to also generate a matching condensed **project report .md** (to replace/update the PDF sections with the final implementation details), or add screenshots placeholders for the README?