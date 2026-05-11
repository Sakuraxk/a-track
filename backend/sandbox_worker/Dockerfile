FROM docker.m.daocloud.io/library/python:3.12-slim

RUN sed -i "s@http://deb.debian.org@https://mirrors.aliyun.com@g" /etc/apt/sources.list.d/debian.sources \
    && apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 fonts-noto-cjk fonts-wqy-zenhei \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN pip install --no-cache-dir \
    --default-timeout=1000 \
    -i https://mirrors.aliyun.com/pypi/simple/ \
    --trusted-host mirrors.aliyun.com \
    fastapi==0.135.3 \
    uvicorn==0.44.0 \
    pydantic==2.13.0 \
    numpy==1.26.4 \
    pandas==3.0.2 \
    matplotlib==3.10.8 \
    scikit-learn==1.8.0

# Build-time warmup: trigger __pycache__ generation
RUN python -c "import numpy; import pandas; import sklearn; print('Build-time warmup done')"

COPY app.py /app/app.py

# Startup script
RUN printf '#!/bin/sh\n\
echo "[entrypoint] Pre-warming libraries..."\n\
python -c "import sklearn; import numpy; import pandas; print(\"[entrypoint] Warmup complete\")"\n\
echo "[entrypoint] Starting uvicorn..."\n\
exec uvicorn app:app --host 0.0.0.0 --port 8011 --log-level info\n' > /app/entrypoint.sh \
    && chmod +x /app/entrypoint.sh

RUN useradd --no-create-home --shell /usr/sbin/nologin sandbox \
    && mkdir -p /tmp/sandbox-worker \
    && chown -R sandbox:sandbox /tmp/sandbox-worker

USER sandbox

EXPOSE 8011

CMD ["/app/entrypoint.sh"]
