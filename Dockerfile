FROM python:3.11

WORKDIR /app

# Copy requirements.txt first to cache dependencies
COPY requirements.txt .

# Install dependencies with single-thread compilation to respect Render's RAM limits
RUN MAKEFLAGS="-j 1" pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application files
COPY . .

EXPOSE 5000

# Start application using gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "app:app"]
