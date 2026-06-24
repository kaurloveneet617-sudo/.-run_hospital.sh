#!/bin/bash

# Go to the project directory
cd "/home/kaurloveneet617/pythonProgram/Hospital assist"

# Kill any existing cloudflared tunnels to avoid conflicts
echo "Stopping any existing tunnels..."
pkill -f cloudflared 2>/dev/null

# Check if cloudflared is present, download if missing
if [ ! -f "./cloudflared" ]; then
    echo "Downloading cloudflared..."
    curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o ./cloudflared
    chmod +x ./cloudflared
fi

# Run the hospital local server (Flask app)
echo "Starting local Flask server..."
./run_hospital.sh

# Start cloudflared tunnel in the background and redirect output to tunnel.log
echo "Creating public secure link..."
rm -f tunnel.log
./cloudflared tunnel --url http://127.0.0.1:5000 > tunnel.log 2>&1 &
TUNNEL_PID=$!

# Wait for the tunnel link to be generated
echo "Waiting for public link..."
LIMIT=20
COUNT=0
URL=""

while [ $COUNT -lt $LIMIT ]; do
    if [ -f tunnel.log ]; then
        URL=$(grep -oE "https://[a-zA-Z0-9.-]+\.trycloudflare\.com" tunnel.log | head -n 1)
        if [ ! -z "$URL" ]; then
            break
        fi
    fi
    sleep 1
    COUNT=$((COUNT + 1))
done

if [ ! -z "$URL" ]; then
    echo -e "\n=================================================="
    echo -e "   YOUR PUBLIC SECURE LINK IS READY!   "
    echo -e "   $URL"
    echo -e "=================================================="
    echo -e "Open this link on any device (phone, laptop) to access your app."
    echo -e "Webcam face recognition will work because this is a secure HTTPS link.\n"
else
    echo "Error: Could not retrieve public tunnel link. Check tunnel.log for details."
fi

# Keep the script running to hold the tunnel. Clean up on Exit/Ctrl+C
trap "echo -e '\nStopping server and tunnel...'; kill $TUNNEL_PID 2>/dev/null; fuser -k 5000/tcp 2>/dev/null; exit" INT TERM
wait $TUNNEL_PID
