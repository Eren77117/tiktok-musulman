#!/bin/sh
set -e
echo "[start.sh] Starting TikTok Musulman backend..."
echo "[start.sh] Node: $(node --version)"
echo "[start.sh] DATABASE_URL: ${DATABASE_URL:0:30}..."

echo "[start.sh] Running Prisma generate..."
npx prisma generate

echo "[start.sh] Running Prisma migrate..."
npx prisma migrate deploy

echo "[start.sh] Starting server..."
exec npx tsx src/index.ts
