# ============================================================
# Nginx Dockerfile — 独立反向代理容器
# ============================================================
FROM nginx:alpine

# 复制自定义 Nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
