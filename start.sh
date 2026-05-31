#!/usr/bin/env bash
# Start RoomCraft frontend and backend together
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Trap Ctrl+C and kill both processes
cleanup() {
  echo ""
  echo "Shutting down..."
  kill "$FRONTEND_PID" "$BACKEND_PID" 2>/dev/null
  wait "$FRONTEND_PID" "$BACKEND_PID" 2>/dev/null
  exit 0
}
trap cleanup INT TERM

echo "Starting backend (backend)..."
cd "$SCRIPT_DIR/backend" && npm run dev &
BACKEND_PID=$!

echo "Starting frontend (frontend)..."
cd "$SCRIPT_DIR/frontend" && npm run dev &
FRONTEND_PID=$!

echo "Frontend PID: $FRONTEND_PID | Backend PID: $BACKEND_PID"
echo "Press Ctrl+C to stop both."

wait "$FRONTEND_PID" "$BACKEND_PID"
