FROM public.ecr.aws/docker/library/python:3.12-alpine

WORKDIR /app

COPY --chown=root:root server.py index.html bundle.html styles.css assets.js engine.js arcade.js /app/

# F5 + Post-Exploitation RCE & Shell-Less Hardening (v9):
# 1. Grant cap_net_bind_service=+ep on python3 so non-root UID 10001 can bind port 80
#    (on-prem Docker `-p 8765:80`) or port 8080 (Cloud Run `$PORT`) without root.
# 2. Create unprivileged user (UID 10001) with /sbin/nologin.
# 3. Lock /app code files as root-owned read-only (0555/0444) and restrict writable
#    surface strictly to /app/data (0700 owned by 10001:10001).
# 4. Strip package managers (apk, pip, ensurepip), network/recon binaries (wget, nc, ftp),
#    setuid/setgid bits, AND remove /bin/sh, /bin/ash, and /bin/busybox as the final step
#    so an attacker cannot spawn an interactive shell even if RCE occurs.
RUN apk add --no-cache libcap && \
    setcap 'cap_net_bind_service=+ep' $(readlink -f $(which python3)) && \
    apk del libcap && \
    addgroup -g 10001 -S appgroup && \
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
           /root/.cache /tmp/* /var/tmp/* \
           /bin/sh /bin/ash /bin/busybox /sbin/busybox

USER 10001:10001

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=80
ENV GALACTIC_SHEEP_DATA_DIR=/app/data

EXPOSE 80 8080

# Exec-form entrypoint invokes python3 directly via execve() without /bin/sh
ENTRYPOINT ["/usr/local/bin/python3", "/app/server.py"]
