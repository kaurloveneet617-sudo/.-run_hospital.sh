#!/bin/bash
# Go to the project directory
cd "/home/kaurloveneet617/pythonProgram/Hospital assist"

# Stop any old server running on port 5000 to avoid conflicts
fuser -k 5000/tcp 2>/dev/null
kill -9 $(lsof -t -i:5000) 2>/dev/null

# Activate the Python environment
source venv/bin/activate

# Run the Flask app in the background
python3 app.py &

# Wait for 2 seconds to let it start
sleep 2

# Open the website in your web browser
xdg-open "http://127.0.0.1:5000"
