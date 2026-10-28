FROM python:3.12-alpine

WORKDIR /app

COPY server.py index.html bundle.html styles.css assets.js engine.js arcade.js /app/

RUN mkdir -p /app/data

ENV PORT=80
ENV GALACTIC_SHEEP_DATA_DIR=/app/data

EXPOSE 80

CMD ["python3", "/app/server.py", "--port", "80"]
