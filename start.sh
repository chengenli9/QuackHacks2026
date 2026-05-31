#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Ensure node/npm are on PATH
export PATH="/usr/local/bin:$PATH"

# Start backend
echo "Starting backend..."
(cd "$SCRIPT_DIR/server" && npm run dev) &
BACKEND_PID=$!

# Start frontend
echo "Starting frontend..."
(cd "$SCRIPT_DIR/roomcraft" && npm run dev) &
FRONTEND_PID=$!

echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo "Press Ctrl+C to stop both servers."

# Wait and handle shutdown
trap "echo 'Stopping servers...'; kill $BACKEND_PID $FRONTEND_PID; exit 0" SIGINT SIGTERM
wait
