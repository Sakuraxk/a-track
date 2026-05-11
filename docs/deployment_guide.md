# 🚀 智辙 (A-Track) 服务器部署指南

> **服务器信息**（从截图获取）：阿里云轻量应用服务器 · 华中1（武汉）· 4 vCPU / 8 GB · ESSD 云盘 70 GB · Docker 镜像

---

## 📋 部署总览

```mermaid
flowchart LR
    A[1. 连接服务器] --> B[2. 安装 Docker]
    B --> C[3. 上传项目]
    C --> D[4. 配置环境]
    D --> E[5. 构建部署]
    E --> F[6. 初始化数据]
    F --> G[7. 配置域名/防火墙]
    G --> H[8. 验证上线]
```

预计耗时：**30-60 分钟**（首次构建镜像需要较长时间）

---

## 第一步：连接服务器

### 1.1 获取服务器登录信息

在阿里云控制台 → 轻量应用服务器 → 你的实例 → **远程连接**：
- 记下**公网 IP 地址**（截图中显示 `8.148.82.93`）
- 如果尚未设置 root 密码，点击 **重置密码** 设置一个强密码

### 1.2 通过 SSH 连接

在你的 Windows 电脑上打开 PowerShell 或 Windows Terminal：

```powershell
ssh root@8.148.82.93
```

> [!TIP]
> 首次连接会提示 `Are you sure you want to continue connecting (yes/no)?`，输入 `yes` 回车。
> 如果无法连接，检查阿里云防火墙规则是否放行了 **22 端口 (SSH)**。

---

## 第二步：安装 Docker（如需要）

> [!NOTE]
> 你的服务器使用了阿里云的 **Docker 镜像**，Docker 可能已经预装。先检查一下。

### 2.1 检查 Docker 是否已安装

```bash
docker --version
docker compose version
```

如果两个命令都有版本输出（Docker >= 20.10，Compose v2），**跳到第三步**。

### 2.2 如果未安装，执行以下命令

```bash
# 安装 Docker
curl -fsSL https://get.docker.com | sh

# 启动 Docker 并设置开机自启
systemctl start docker
systemctl enable docker

# 验证安装
docker --version
docker compose version
```

### 2.3 配置 Docker 镜像加速（推荐）

国内服务器拉取镜像较慢，配置阿里云镜像加速器：

```bash
mkdir -p /etc/docker

cat > /etc/docker/daemon.json << 'EOF'
{
  "registry-mirrors": [
    "https://mirror.ccs.tencentyun.com",
    "https://docker.m.daocloud.io"
  ]
}
EOF

# 重启 Docker 使配置生效
systemctl daemon-reload
systemctl restart docker
```

> [!TIP]
> 阿里云提供专属加速器地址，可在 [容器镜像服务控制台](https://cr.console.aliyun.com/cn-wuhan/instances/mirrors) 获取你的专属加速地址，替换上面的 mirror 地址效果更好。

---

## 第三步：上传项目代码到服务器

### 方式 A：Git 克隆（推荐）

如果项目在 GitHub/Gitee 仓库中：

```bash
# 安装 Git（如果没有）
apt-get update && apt-get install -y git

# 克隆项目
cd /opt
git clone <你的仓库URL> a-track
cd /opt/a-track
```

### 方式 B：本地打包上传

如果不使用 Git 仓库，在你的 **Windows 电脑上**打包上传：

```powershell
# 在 Windows 本地执行 —— 排除 node_modules 等大文件夹
# 先进入项目目录
cd c:\Users\lenovo\Documents\GitHub\test

# 使用 tar 打包（排除不必要的文件）
tar --exclude='node_modules' --exclude='.venv' --exclude='__pycache__' --exclude='.git' -czf a-track.tar.gz -C .. test

# 上传到服务器
scp a-track.tar.gz root@8.148.82.93:/opt/
```

然后在**服务器**上解压：

```bash
cd /opt
tar -xzf a-track.tar.gz
mv test a-track
cd /opt/a-track
```

> [!IMPORTANT]
> 确保上传的文件包含以下关键文件：
> - `docker-compose.yml`
> - `deploy.sh`
> - `.env.example`
> - `backend/Dockerfile`
> - `frontend/Dockerfile`
> - `frontend/nginx.conf`
> - `backend/config.toml`

---

## 第四步：配置环境变量（⚠️ 关键步骤）

### 4.1 创建 .env 文件

```bash
cd /opt/a-track
cp .env.example .env
vim .env    # 或用 nano .env
```

### 4.2 修改以下配置项

> [!CAUTION]
> 生产环境 **必须** 修改密码和密钥！使用默认值是严重的安全隐患。

```bash
# ── PostgreSQL ────────────────────────────────
POSTGRES_USER=ai_learning
POSTGRES_PASSWORD=<设置一个强密码，例如：Str0ng!P@ss2026>
POSTGRES_DB=learning_platform
POSTGRES_PORT=5432

# ── 数据库连接（Docker 部署时不需要修改此行）───
DATABASE_URL=postgresql+asyncpg://ai_learning:<上面设置的密码>@127.0.0.1:5432/learning_platform

# ── 环境 ──────────────────────────────────────
ENVIRONMENT=production
BACKEND_PORT=8010

# ── 前端端口 ────────────────────────────────
FRONTEND_PORT=80

# ── 安全（必须修改！）──────────────────────────
JWT_SECRET=<生成的随机密钥>
ENCRYPTION_KEY=<生成的随机密钥>

# ── 代码沙箱 ──────────────────────────────────
SANDBOX_ENABLED=true
SANDBOX_DOCKER_IMAGE=python-sandbox
```

### 4.3 生成安全密钥

在服务器上执行以下命令生成随机密钥：

```bash
# 生成 JWT_SECRET（64位十六进制字符串）
echo "JWT_SECRET=$(openssl rand -hex 32)"

# 生成 ENCRYPTION_KEY（32位十六进制字符串）
echo "ENCRYPTION_KEY=$(python3 -c 'import secrets; print(secrets.token_hex(16))')"
```

将输出的值复制粘贴到 `.env` 文件中对应的位置。

### 4.4 配置 AI 功能（LLM API）

编辑 `backend/config.toml`，确保 API Key 配置正确：

```bash
vim backend/config.toml
```

修改 `[llm.system]` 部分：

```toml
[llm.system]
api_key = "sk-你的DeepSeek-API-Key"
base_url = "https://api.deepseek.com/v1"
model = "deepseek-chat"
enabled = true
```

同时修改 `[app]` 部分为生产环境：

```toml
[app]
name = "AI Python 学习平台"
environment = "production"
```

---

## 第五步：构建并启动服务

### 5.1 给部署脚本添加执行权限

```bash
cd /opt/a-track
chmod +x deploy.sh
```

### 5.2 构建并启动所有服务

```bash
./deploy.sh
```

> [!NOTE]
> 首次构建会比较慢（5-15 分钟），因为需要：
> - 拉取 PostgreSQL、Python、Node.js、Nginx 基础镜像
> - 安装后端 Python 依赖
> - 安装前端 npm 依赖并构建
> 
> 如果拉取镜像超时，请确认上面第 2.3 步的镜像加速已配置。

构建成功后会看到：

```
========================================
  ✅ 所有服务已启动！
========================================

  🌐 前端访问:  http://localhost:80
  📡 后端 API:  http://localhost:8010
```

### 5.3 确认服务运行状态

```bash
docker compose ps
```

应该看到三个容器都是 `Up` 状态：

| 容器 | 状态 | 端口 |
|------|------|------|
| ai-learning-platform-db | Up (healthy) | 5432 |
| ai-learning-platform-backend | Up | 8010 |
| ai-learning-platform-frontend | Up | 80 |

如果有容器未启动，查看日志排查：

```bash
# 查看所有日志
docker compose logs -f

# 只看某个服务的日志
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f postgres
```

---

## 第六步：初始化数据库

### 6.1 运行数据库迁移

```bash
docker compose exec backend alembic upgrade head
```

### 6.2 初始化学科数据

```bash
docker compose exec backend python -m scripts.seed_subjects
```

> [!IMPORTANT]
> 这一步**必须执行**！不执行的话，学科切换、成就树等核心功能将无法正常工作。

### 6.3 （可选）构建代码沙箱镜像

如果需要在线代码执行功能：

```bash
docker compose run --rm sandbox-builder
```

---

## 第七步：配置防火墙 & 安全组

### 7.1 阿里云安全组 / 防火墙规则

在阿里云轻量应用服务器控制台 → **防火墙** 页面，添加以下规则：

| 端口 | 协议 | 用途 | 是否必须 |
|------|------|------|----------|
| **80** | TCP | HTTP 前端访问 | ✅ 必须 |
| **443** | TCP | HTTPS（配置 SSL 后） | 推荐 |
| 22 | TCP | SSH 远程管理 | ✅ 必须（已默认开放） |

> [!WARNING]
> **不要**开放 5432（数据库）和 8010（后端 API）端口到公网！
> 前端 Nginx 已经配置了反向代理，外部通过 80 端口访问即可自动转发 API 请求。

### 7.2 验证外网访问

在你的电脑浏览器中打开：

```
http://8.148.82.93
```

应该能看到智辙平台的登录/首页。

API 文档：`http://8.148.82.93/docs`  
健康检查：`http://8.148.82.93/health`

---

## 第八步：（可选）配置域名和 HTTPS

### 8.1 绑定域名

1. 在域名服务商处添加 **A 记录**，将域名指向服务器公网 IP `8.148.82.93`
2. 如果域名在阿里云购买，在**域名解析**中添加：

| 记录类型 | 主机记录 | 记录值 |
|----------|----------|--------|
| A | @ | 8.148.82.93 |
| A | www | 8.148.82.93 |

### 8.2 配置 SSL 证书（HTTPS）

推荐使用免费的 Let's Encrypt 证书：

```bash
# 安装 certbot
apt-get update && apt-get install -y certbot

# 先停止前端容器（释放 80 端口给 certbot 验证）
docker compose stop frontend

# 申请证书（替换 your-domain.com 为你的域名）
certbot certonly --standalone -d your-domain.com -d www.your-domain.com

# 证书申请成功后，重新启动
docker compose start frontend
```

申请成功后，需要修改 `frontend/nginx.conf` 添加 HTTPS 配置，并更新 `docker-compose.yml` 挂载证书。这部分如果需要我可以帮你配置。

---

## 🔧 日常运维命令速查

### 服务管理

```bash
cd /opt/a-track

# 查看服务状态
docker compose ps

# 查看所有日志（实时）
docker compose logs -f

# 只看后端日志
docker compose logs -f backend

# 重启所有服务
docker compose restart

# 停止所有服务
docker compose down

# 代码更新后重新构建并启动
docker compose up -d --build
```

### 数据库运维

```bash
# 数据库迁移（代码更新后可能需要）
docker compose exec backend alembic upgrade head

# 进入数据库命令行
docker compose exec postgres psql -U ai_learning learning_platform

# 备份数据库
docker compose exec postgres pg_dump -U ai_learning learning_platform > backup_$(date +%Y%m%d).sql

# 恢复数据库
docker compose exec -T postgres psql -U ai_learning learning_platform < backup_20260411.sql
```

### 更新部署（代码有更新时）

```bash
cd /opt/a-track

# 方式1：如果使用 Git
git pull origin main

# 方式2：如果使用 scp 上传，重新上传文件后

# 重新构建并启动
docker compose up -d --build

# 如果有数据库迁移
docker compose exec backend alembic upgrade head
```

---

## 🚨 常见问题排查

### Q: 容器启动失败，日志显示数据库连接错误
```bash
# 检查数据库容器是否健康
docker compose ps postgres

# 查看数据库日志
docker compose logs postgres

# 常见原因：.env 中密码配置不一致
# 解决：清除旧数据卷重新初始化
docker compose down -v   # ⚠️ 这会删除数据！
docker compose up -d
```

### Q: 前端能打开但 API 报错 502
```bash
# 检查后端容器状态
docker compose logs -f backend

# 常见原因：后端启动失败（依赖缺失、config.toml 配置错误等）
# 进入后端容器调试
docker compose exec backend bash
```

### Q: 浏览器访问服务器 IP 超时
1. 检查阿里云**防火墙规则**是否开放了 **80 端口**
2. 检查服务器状态是否正常运行
3. 在服务器上执行 `curl http://localhost` 确认服务本身可用

### Q: 首次构建镜像非常慢或失败
```bash
# 检查是否配置了镜像加速
cat /etc/docker/daemon.json

# 单独构建某个镜像调试
docker compose build backend
docker compose build frontend
```

### Q: 需要修改 LLM API Key
```bash
# 编辑配置文件
vim backend/config.toml

# 重启后端使配置生效
docker compose restart backend

# 或者通过 Web 界面配置
# 访问 http://你的IP/config（需要先进入后端 shell 确认路径）
```

---

## 📊 部署检查清单

完成部署后，逐项确认：

- [ ] `docker compose ps` 显示 3 个容器全部 `Up`
- [ ] 浏览器访问 `http://服务器IP` 能看到前端页面
- [ ] 访问 `http://服务器IP/health` 返回健康状态
- [ ] 访问 `http://服务器IP/docs` 能看到 API 文档
- [ ] 注册一个测试账号并成功登录
- [ ] 能看到 6 个学科（Python、机器学习等）
- [ ] AI 功能可用（配置了 API Key 后）
- [ ] `.env` 中密码和密钥已修改为强随机值
- [ ] 阿里云防火墙仅开放 80、443、22 端口
