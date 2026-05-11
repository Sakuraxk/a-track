# ============================================================
# Frontend Dockerfile — 仅构建静态产物，不含 Nginx
# 构建完成后将产物复制到共享 volume 挂载点 /output
# ============================================================

# ── 构建阶段 ──────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# 先复制依赖文件，利用缓存
COPY package.json package-lock.json ./
RUN npm ci

# 复制源码并构建（跳过 TypeScript 类型检查以加速构建）
COPY . .
RUN npx vite build

# ── 产物输出阶段 ──────────────────────────────
FROM alpine:latest

# 从构建阶段复制产物
COPY --from=builder /app/dist /dist

# 容器启动时，将产物复制到共享 volume 挂载点
# 使用 cp -r 确保目录结构完整
CMD ["sh", "-c", "cp -r /dist/* /output/ && echo '✅ Frontend build copied to /output/ successfully'"]
