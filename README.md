# QuestForge 🎲

QuestForge is a secure, server-validated AI game loop disguised as a text-adventure RPG. It implements a strict referee-and-agent architecture where the AI Game Master (GM) narrates the story and requests state updates via tool calls, but the backend server acts as the authoritative referee, executing updates in transactional database operations and rejecting illegal moves.

## Technology Stack

- **Backend**: Node.js + Express.js + TypeScript
- **Frontend**: React + Next.js (App Router) + TanStack React Query + Vanilla CSS (Custom dark theme with cosmic violet and cyan glassmorphism)
- **Database & ORM**: PostgreSQL + Prisma ORM
- **AI Engine**: Google Gemini API / OpenAI API (wrapped through unified OpenAI compatibility layer)
- **Containerization**: Docker & Docker Compose

---

## AI Game Master Tools

The backend exposes the following tools to the AI GM. Every state update must go through these functions:

1. **`move_player(direction)`**: Moves the player in a direction (`north`, `south`, `east`, `west`). The backend validates exits, check locked barriers (e.g. Treasury door locked), and active threats (e.g. Goblin guard blocks exit east).
2. **`take_item(item)`**: Picks up an item (`rusty key`, `wooden shield`, `health potion`, `golden crown`) from the current room. Validates item availability. Triggers game victory if the player picks up the `golden crown`.
3. **`use_item(item)`**: Consumes an item. Consuming `health potion` recovers up to 10 HP. Consuming `rusty key` unlocks the Treasury door (must be in Armoury).
4. **`attack_enemy()`**: Attacks the goblin in the Armoury. Calculates damage, handles goblin retaliation (mitigated by `wooden shield`), and triggers defeat if player HP <= 0.

---

## Secure Architecture & Anti-Cheat

To keep the game state authoritative and prevent cheating:
- **Untrusted LLM**: The LLM cannot change data values directly. It can only *propose* a state change by invoking a tool.
- **Transactional Referee**: The backend executes the tool logic inside a Postgres transaction (`prisma.$transaction`).
- **Validation**: If the player attempts an illegal move (e.g., "attack goblin" in cavern, "use key" without owning it, or "teleport to treasury"), the tool call returns `success: false` with a specific error message.
- **Forced Honesty**: The GM receives the tool result and is instructed by system rules to narrate only what was accepted on the server. The client stats dashboard refetches directly from the DB, ensuring visual alignment.

---

## Setup & Running Locally

### 1. Prerequisites
- Docker & Docker Compose installed.
- Node.js & npm installed (optional, for local non-docker development).

### 2. Environment Configuration
Copy `backend/.env.example` to `backend/.env`:
```bash
cp backend/.env.example backend/.env
```
Provide your API key:
- **`GEMINI_API_KEY`** (default) or **`OPENAI_API_KEY`**.

### 3. Start the Application
Boot PostgreSQL and the Express backend with a single command from the project root:
```bash
docker compose up -d --build
```
This automatically runs all Prisma database migrations (`npx prisma migrate deploy`) and starts the server on port `4000`.

### 4. Running the Frontend
Navigate to the frontend folder, configure environment variables if needed, and start the development server:
```bash
cd frontend
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to play the game!

---

## Running Backend Migrations Manually
If you make changes to the schema, run migrations locally:
```bash
cd backend
npx prisma migrate dev --name <migration-name>
```

---

## Deployment & Production Configurations

### Frontend Deployment (Vercel)
- Live Frontend URL: [https://quest-forge-eight.vercel.app](https://quest-forge-eight.vercel.app)
- Subdomain Mapping (Optional): [https://questforge.sohello.ai](https://questforge.sohello.ai)

### Backend Deployment (Production Server)
- Live API URL: [https://questforge-api.sohello.ai](https://questforge-api.sohello.ai)
- Deployed inside Docker on the production server, reverse-proxied with Nginx and secured via Let's Encrypt SSL.

---

## Submission Checklist

- [x] Repo link
- [x] Live Vercel URL
- [x] Backend location (Production API: https://questforge-api.sohello.ai)
- [x] Test account or registration instructions (Create an account on the Register page)
- [x] AI provider used: Gemini / OpenAI (OpenAI API on production server)
- [x] List of tools exposed to the AI documented
- [x] How the backend validates tool calls / enforces win-lose documented
- [x] .env.example committed
- [x] Migration file(s) committed
- [x] docker compose up works locally
- [ ] Demo video link
- [x] No secrets committed
