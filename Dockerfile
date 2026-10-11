FROM python:3.12-slim

# System dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy project files
COPY requirements.txt .
COPY src/ ./src/
COPY web/ ./web/
COPY tests/ ./tests/
COPY train.py .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Clone and setup flybrain (this takes ~10 minutes)
RUN git clone https://github.com/jppaquet/flybrain.git && \
    cd flybrain && \
    bash setup.sh || true

# Create mock data directory
RUN mkdir -p /data/documents /data/archive

EXPOSE 8766

CMD ["python", "src/server/server.py", "--port", "8766"]
