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

echo "Starting backend (server)..."
cd "$SCRIPT_DIR/server" && npm run dev &
BACKEND_PID=$!

echo "Starting frontend (roomcraft)..."
cd "$SCRIPT_DIR/roomcraft" && npm run dev &
FRONTEND_PID=$!

echo "Frontend PID: $FRONTEND_PID | Backend PID: $BACKEND_PID"
echo "Press Ctrl+C to stop both."

wait "$FRONTEND_PID" "$BACKEND_PID"
