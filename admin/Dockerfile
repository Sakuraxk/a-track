# ============================================================
# Admin Dockerfile — 构建后台管理系统静态产物
# 与 frontend Dockerfile 模式相同：构建后复制到共享 volume
# ============================================================

# ── 构建阶段 ──────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# 先复制依赖文件，利用缓存
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# 复制源码并构建
COPY . .
RUN npx vite build

# ── 产物输出阶段 ──────────────────────────────
FROM alpine:latest

# 从构建阶段复制产物
COPY --from=builder /app/dist /dist

# 容器启动时，将产物复制到共享 volume 挂载点
CMD ["sh", "-c", "cp -r /dist/* /output/ && echo '✅ Admin build copied to /output/ successfully'"]
