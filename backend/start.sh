#!/bin/sh
set -e
echo "[start.sh] Starting backend..."
echo "[start.sh] NODE_ENV=$NODE_ENV PORT=$PORT"
echo "[start.sh] Running migrations..."
npx prisma migrate deploy
echo "[start.sh] Starting node..."
exec node dist/index.js
