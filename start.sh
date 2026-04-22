#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

# Install dependencies if needed
if [ ! -d "$BACKEND/node_modules" ]; then
  echo "Installing backend dependencies..."
  (cd "$BACKEND" && npm install)
fi

if [ ! -d "$FRONTEND/node_modules" ]; then
  echo "Installing frontend dependencies..."
  (cd "$FRONTEND" && npm install)
fi

# Copy .env if not present
if [ ! -f "$BACKEND/.env" ]; then
  cp "$BACKEND/.env.example" "$BACKEND/.env"
  echo "Created backend/.env from example (using mock data provider)"
fi

echo ""
echo "Starting SwingFlow..."
echo "  Backend  → http://localhost:3001"
echo "  Frontend → http://localhost:5173"
echo ""

# Start backend and frontend in parallel
(cd "$BACKEND" && npm run dev) &
BACKEND_PID=$!

(cd "$FRONTEND" && npm run dev) &
FRONTEND_PID=$!

# Cleanup on exit
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM EXIT

wait $BACKEND_PID $FRONTEND_PID
