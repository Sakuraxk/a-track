FROM docker.m.daocloud.io/library/python:3.12-slim AS base

# 安装系统依赖（asyncpg / psycopg2 需要 libpq）
RUN sed -i "s@http://deb.debian.org@http://mirrors.aliyun.com@g" /etc/apt/sources.list.d/debian.sources && \
    apt-get update && \
    apt-get install -y --no-install-recommends gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 先复制依赖文件，利用 Docker 缓存层
COPY requirements.txt ./
RUN pip install --no-cache-dir --default-timeout=1000 -i https://mirrors.aliyun.com/pypi/simple/ --trusted-host mirrors.aliyun.com -r requirements.txt

# 复制应用代码
COPY . .

# 创建 uploads 目录
RUN mkdir -p uploads/avatars

# 暴露后端端口
EXPOSE 8010

# 启动命令：生产环境不开 reload、监听 0.0.0.0
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8010", "--log-level", "info"]
