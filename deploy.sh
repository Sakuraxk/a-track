#!/bin/bash
# ============================================================
# 智辙 (A-Track) — Docker 一键部署脚本 (Linux/Mac)
# 用法: chmod +x deploy.sh && ./deploy.sh
# ============================================================

set -e

echo ""
echo "========================================"
echo "  智辙 (A-Track) — Docker 一键部署"
echo "========================================"
echo ""

# 检查 Docker 和 Docker Compose
if ! command -v docker &> /dev/null; then
    echo "[ERROR] 未找到 docker，请先安装 Docker。"
    echo "        安装文档: https://docs.docker.com/engine/install/"
    exit 1
fi

if ! docker compose version &> /dev/null; then
    echo "[ERROR] 未找到 docker compose，请确保 Docker 版本 >= 20.10。"
    exit 1
fi

# 检查 .env 文件
if [ ! -f ".env" ]; then
    echo "[INFO] 未找到 .env 文件，从模板创建..."
    cp .env.example .env
    echo "[INFO] 已创建 .env 文件，请根据需要修改配置后重新运行此脚本。"
    echo ""
    echo "  特别注意以下配置项:"
    echo "    - POSTGRES_PASSWORD  (数据库密码)"
    echo "    - JWT_SECRET         (JWT 密钥)"
    echo "    - ENCRYPTION_KEY     (加密密钥)"
    echo "    - FRONTEND_PORT      (前端端口，默认 80)"
    echo ""
    exit 0
fi

# 构建并启动所有服务
echo "[1/3] 构建 Docker 镜像..."
docker compose build

echo ""
echo "[2/3] 启动所有服务..."
docker compose up -d

echo ""
echo "[3/3] 等待服务就绪..."
# 等待后端健康检查
RETRIES=0
MAX_RETRIES=30
BACKEND_PORT=${BACKEND_PORT:-8010}
FRONTEND_PORT=${FRONTEND_PORT:-80}

while [ $RETRIES -lt $MAX_RETRIES ]; do
    if curl -s "http://localhost:${BACKEND_PORT}/health" > /dev/null 2>&1; then
        break
    fi
    sleep 2
    RETRIES=$((RETRIES + 1))
done

echo ""
echo "========================================"
echo "  ✅ 所有服务已启动！"
echo "========================================"
echo ""
echo "  🌐 前端访问:  http://localhost:${FRONTEND_PORT}"
echo "  📡 后端 API:  http://localhost:${BACKEND_PORT}"
echo "  📖 API 文档:  http://localhost:${FRONTEND_PORT}/docs"
echo "  ❤️  健康检查:  http://localhost:${FRONTEND_PORT}/health"
echo ""
echo "  常用命令:"
echo "    查看日志:    docker compose logs -f"
echo "    查看状态:    docker compose ps"
echo "    停止服务:    docker compose down"
echo "    重启服务:    docker compose restart"
echo "    重建并启动:  docker compose up -d --build"
echo ""
echo "  数据库操作:"
echo "    运行迁移:    docker compose exec backend alembic upgrade head"
echo "    初始化学科:  docker compose exec backend python -m scripts.seed_subjects"
echo "    备份数据库:  docker compose exec postgres pg_dump -U ai_learning learning_platform > backup.sql"
echo ""
