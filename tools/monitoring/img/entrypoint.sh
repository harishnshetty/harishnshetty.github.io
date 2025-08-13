#!/bin/bash
set -e

# Start Nginx in the background
service nginx start

# Wait for Nginx to be fully ready
sleep 2

# Optional: activate Python virtualenv if used
# source /app/venv/bin/activate

# Start Gunicorn to serve the Flask or Django app
# For Flask:
exec gunicorn --bind 0.0.0.0:8000 app:app

# For Django, use:
# exec gunicorn --bind 0.0.0.0:8000 myproject.wsgi:application