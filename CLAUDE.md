# TikTok Musulman — Project Rules

## Stack
- Backend: Node.js + Fastify + Prisma + PostgreSQL + Socket.io
- Admin: React + Vite + TailwindCSS + React Query
- Mobile: React Native (iOS-first, bare workflow)

## Rules
- TypeScript strict everywhere
- Max 50 lines per function, max 400 lines per file
- Commits: `feat:` / `fix:` / `refactor:` prefix
- Never force push to main
- No secrets in code — use .env only
- Zod for all input validation
- bcrypt for passwords, JWT (access 15min + refresh 7d)

## Gender Messaging Rule
- Man CANNOT initiate DM to woman (unless she sent request first)
- Woman CANNOT initiate DM to man (unless he sent request first)
- Enforced at API level in `POST /messages/conversation-request`

## DB naming
- snake_case tables and columns
- Audit logs for all sensitive actions

## Dev ports
- Backend: 3001
- Admin: 5173
- Mobile Metro: 8081
