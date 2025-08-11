# Build stage
FROM python:3.11-slim AS builder
WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    git \
    && rm -rf /var/lib/apt/lists/*

# Use the same flags that worked in your debugging test
ENV CFLAGS="-Wno-error -v"
ENV CXXFLAGS="-Wno-error -v"
ENV FORCE_CMAKE=1

RUN pip install --upgrade pip setuptools wheel
RUN pip install --no-cache-dir --user llama-cpp-python==0.2.11 --verbose

COPY requirements.txt .
RUN grep -v "llama-cpp-python" requirements.txt > requirements_filtered.txt 2>/dev/null || cp requirements.txt requirements_filtered.txt
RUN pip install --no-cache-dir --user -r requirements_filtered.txt
RUN ls -l /root/.local/lib/python3.11/site-packages/llama_cpp

# Runtime stage
FROM python:3.11-slim AS backend
WORKDIR /app

# Copy installed packages from builder stage
COPY --from=builder /root/.local /root/.local

# Make sure scripts in .local are usable
ENV PATH=/root/.local/bin:$PATH
ENV LD_LIBRARY_PATH=/root/.local/lib:$LD_LIBRARY_PATH


COPY . .
ENV PYTHONUNBUFFERED=1
EXPOSE 5055
CMD ["gunicorn", "--bind", "0.0.0.0:5055", "app:app", "--workers", "1", "--threads", "4"]
