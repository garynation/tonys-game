FROM public.ecr.aws/docker/library/python:3.12-alpine

WORKDIR /app

COPY --chown=root:root server.py index.html bundle.html styles.css assets.js engine.js arcade.js /app/

# F5 + Post-Exploitation RCE Hardening (v10):
# 1. Create unprivileged user (UID 10001:10001) with /sbin/nologin.
#    (Docker 20.10+ sets net.ipv4.ip_unprivileged_port_start=0 in container netns by default,
#    so UID 10001 binds port 80 on local Docker and PORT=8080 on Cloud Run without setcap,
#    avoiding AT_SECURE dynamic linker stripping of libpython3.12.so.1.0).
# 2. Lock /app code files as root-owned read-only (0555/0444) and restrict writable
#    surface strictly to /app/data (0700 owned by 10001:10001).
# 3. Strip package managers (apk, pip, ensurepip), network/recon tools (wget, nc, ftp),
#    and setuid/setgid bits across the filesystem.
RUN addgroup -g 10001 -S appgroup && \
    adduser -u 10001 -S -H -s /sbin/nologin appuser -G appgroup && \
    chmod 0555 /app /app/server.py && \
    chmod 0444 /app/index.html /app/bundle.html /app/styles.css /app/assets.js /app/engine.js /app/arcade.js && \
    mkdir -p /app/data && \
    chown 10001:10001 /app/data && \
    chmod 0700 /app/data && \
    python3 -m pip uninstall -y pip setuptools wheel 2>/dev/null || true && \
    find / -xdev -perm /6000 -type f -exec chmod a-s {} + 2>/dev/null || true && \
    rm -rf /sbin/apk /etc/apk /lib/apk /usr/share/apk /var/lib/apk \
           /usr/bin/wget /usr/bin/nc /usr/bin/ftp /usr/bin/tftp \
           /usr/local/lib/python3.12/ensurepip \
           /root/.cache /tmp/* /var/tmp/*

USER 10001:10001

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=80
ENV GALACTIC_SHEEP_DATA_DIR=/app/data

EXPOSE 80 8080

CMD ["python3", "/app/server.py"]
