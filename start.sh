#!/bin/bash
# Start both server and client in parallel
echo "Starting Poker Server on :3001..."
(cd "$(dirname "$0")/server" && node index.js) &

echo "Starting Vite client on :5173..."
(cd "$(dirname "$0")/client" && npm run dev) &

echo ""
echo "  Game running at → http://localhost:5173"
echo "  Press Ctrl+C to stop both servers."
wait
