FROM public.ecr.aws/docker/library/python:3.12-alpine

# F5: Create unprivileged user and grant net_bind_service on python3 binary
# so the exact same non-root container works on both:
#   - Local Linux Docker (`-p 8765:80` with default PORT=80)
#   - Google Cloud Run (which injects PORT=8080)
RUN apk add --no-cache libcap && \
    setcap 'cap_net_bind_service=+ep' $(readlink -f $(which python3)) && \
    apk del libcap && \
    addgroup -g 10001 -S appgroup && \
    adduser -u 10001 -S appuser -G appgroup

WORKDIR /app

COPY --chown=appuser:appgroup server.py index.html bundle.html styles.css assets.js engine.js arcade.js /app/

RUN mkdir -p /app/data && chown -R appuser:appgroup /app

USER 10001:10001

ENV PORT=80
ENV GALACTIC_SHEEP_DATA_DIR=/app/data

EXPOSE 80 8080

CMD ["python3", "/app/server.py"]
