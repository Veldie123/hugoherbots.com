FROM python:3.11-slim

# Install FFmpeg 7.x from static builds (matches Replit's version)
RUN apt-get update && apt-get install -y wget xz-utils && rm -rf /var/lib/apt/lists/* \
    && wget -q https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz \
    && tar xf ffmpeg-release-amd64-static.tar.xz \
    && mv ffmpeg-*-static/ffmpeg /usr/local/bin/ \
    && mv ffmpeg-*-static/ffprobe /usr/local/bin/ \
    && rm -rf ffmpeg-*

WORKDIR /app

RUN pip install flask requests mux_python openai google-cloud-tasks google-auth supabase google-cloud-secret-manager

COPY worker.py .
COPY backgrounds/ ./backgrounds/

CMD ["python", "worker.py"]
