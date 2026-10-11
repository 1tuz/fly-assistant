FROM python:3.12-slim

# System dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Keep flybrain aligned with the repository submodule and cache its large setup layer.
RUN git clone https://github.com/jppaquet/flybrain.git && \
    cd flybrain && \
    git checkout c582cfdb90c49cfa7da71d0f5ec958dc17730223 && \
    bash setup.sh

COPY src/ ./src/
COPY web/ ./web/
COPY tests/ ./tests/
COPY train.py .

# Create mock data directory
RUN mkdir -p /data/documents /data/archive

EXPOSE 8766

CMD ["python", "src/server/server.py", "--port", "8766"]
