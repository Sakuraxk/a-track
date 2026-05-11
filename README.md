# 智辙 (A-Track) — AI 多学科自适应学习平台

> "智辙"（英文 A-Track），寓意 AI 智慧为学生铺好知识的轨迹。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

基于 AI 驱动的跨学科学习平台，提供智能评估、个性化推荐、在线代码执行和 AI 导师辅导。
当前支持 **7 大核心学科**：**Python 编程** · **机器学习** · **高等数学** · **概率论** · **线性代数** · **统计学** · **AI通识与AI素养**。

同时提供独立的**管理后台面板**，用于用户管理、学科管理、学习数据分析和系统配置。

---

## ✨ 核心特性

| 模块 | 说明 |
|------|------|
| 🎯 **智能水平评估** | 快速测验生成能力画像，精准定位知识薄弱点 |
| 📚 **多学科沉浸式学习** | 涵盖文理科核心课程的系统化学习路径 |
| 🗺️ **动态知识图谱** | 基于学科特性构建可视化知识树与前置依赖 |
| 🤖 **苏格拉底 AI 导师** | 引导式教学，结合用户记忆流提供个性化提示 |
| 🧠 **用户记忆系统** | 跨学习周期追踪行为、偏好与学习模式 |
| 💻 **交互式练习环境** | 工程学科浅色代码展示 + 前端轻量执行 / 后端独立沙箱执行 + 多样化题型练习 |
| 📝 **智能题库** | AI 生成题目，按难度/知识点自动编排 |
| 📖 **概念学习工作台** | 流式生成学习内容，内嵌 AI 提问与 SVG 配图 |
| 🛤️ **AI 学习路线规划** | AI 生成多阶段个性化学习计划与每日任务 |
| 🏆 **成就树系统** | 章节级进度可视化与成就解锁 |
| 💬 **学习社区** | 帖子分享、点赞、评论与互动通知 |
| 📊 **能力雷达图** | 多维度可视化展示学习进度与成就 |
| 🔔 **游戏化通知** | 完成任务时的成就庆祝与激励反馈 |
| 🎛️ **Prompt Lab** | 开发环境的 Prompt 编辑、版本管理与调试工具 |
| 📐 **数学实验室** | 交互式数学公式计算、JSXGraph 函数图形绘制 |
| 📱 **互动式课程学习** | 结构化课程体系，含章节详情沉浸式学习 |
| 🏢 **管理后台** | 独立 Vue 3 管理面板，用户/学科/社区管理与数据分析 |

---

## 🛠️ 技术栈

### 后端

| 技术 | 用途 |
|------|------|
| **Python 3.10+** | 运行时 |
| **FastAPI** | Web 框架 + SSE 流式 |
| **Uvicorn** | ASGI 服务器 |
| **SQLAlchemy 2.0** (asyncio) | ORM + 异步数据库 |
| **PostgreSQL 17** + **pgvector** | 关系数据库 + 向量检索 |
| **asyncpg** / **psycopg** | 异步 PostgreSQL 驱动 |
| **Alembic** | 数据库迁移 |
| **Pydantic v2** | 数据校验与序列化 |
| **LangChain** + **OpenAI SDK** | LLM 编排与调用 |
| **Redis** | 缓存层 |
| **Docker** | 全栈容器化部署（前端 + 后端 + 数据库） |
| **uv** | Python 包管理器 |

### 前端

| 技术 | 用途 |
|------|------|
| **React 18** + **TypeScript** | UI 框架 |
| **Vite 5** | 构建工具 |
| **Tailwind CSS 3** | 原子化样式 |
| **Ant Design 6** | UI 组件库 |
| **Radix UI** | 无障碍原语组件 |
| **Zustand** | 状态管理 |
| **TanStack React Query** | 数据获取与缓存 |
| **React Flow** | 知识图谱可视化 |
| **Recharts** | 数据图表 |
| **mathjs** | 数学引擎（公式计算、函数绘图） |
| **JSXGraph** (CDN) | 交互式 2D 几何与函数图形画板 |
| **Monaco Editor** | 代码编辑器 |
| **Sonner** | Toast 通知 |
| **Markmap** | 思维导图渲染 |

### 管理后台

| 技术 | 用途 |
|------|------|
| **Vue 3** | UI 框架 |
| **Vite** | 构建工具 |
| **Element Plus** | UI 组件库 |
| **ECharts** | 数据可视化图表 |
| **Vue Router 4** | 路由管理 |

---

## 📋 环境要求

- **Docker Desktop** 或 **Docker Engine** >= 20.10
- **Docker Compose** v2（Docker Desktop 自带）

> 全栈 Docker 容器化部署，**无需**安装 Python、Node.js 等运行时依赖。

---

## 🚀 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/Sakuraxk/a-track.git
cd a-track
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件，配置你的 AI API 密钥：

```env
# DeepSeek API Key（获取地址：https://platform.deepseek.com/）
DEEPSEEK_API_KEY=sk-your-deepseek-api-key-here
```

### 3. 首次部署

**Windows (PowerShell):**

```powershell
# 1. 一键构建并启动
.\deploy.ps1

# 2. 首次启动需要运行数据库迁移和初始化学科数据
.\deploy.ps1 -Migrate
.\deploy.ps1 -Seed
```

**Linux / Mac:**

```bash
chmod +x deploy.sh && ./deploy.sh
```

### 4. 访问应用

| 地址 | 说明 |
|------|------|
| `http://localhost` | 🌐 前端应用 |
| `http://localhost/admin/` | 🏢 管理后台 |
| `http://localhost/docs` | 📖 API 文档 (Swagger) |
| `http://localhost/health` | ❤️ 健康检查 |

### 5. 日常操作

| 操作 | 命令 |
|------|------|
| 🚀 启动开发模式 | `.\deploy.ps1 -Dev` |
| 🛑 停止开发模式 | `.\deploy.ps1 -DevDown` |
| 🔨 生产模式启动 | `.\deploy.ps1` |
| 🔨 强制重建启动 | `.\deploy.ps1 -Build` |
| 📋 查看日志 | `.\deploy.ps1 -Logs` |
| 🗄️ 数据库迁移 | `.\deploy.ps1 -Migrate` |
| 🌱 初始化学科数据 | `.\deploy.ps1 -Seed` |
| ⬇️ 停止生产模式 | `.\deploy.ps1 -Down` |

> **⚠️ 常见问题**：如果看到 `unable to get image ... failed to connect to the docker API`，说明 **Docker Desktop 没有启动**，请先打开 Docker Desktop 等待它完全启动后再运行命令。

---

## 🔥 开发模式

日常开发推荐使用开发模式，代码保存后**自动刷新**，无需重新构建镜像：

```powershell
.\deploy.ps1 -Dev         # 启动开发模式（热重载）
.\deploy.ps1 -DevDown     # 停止开发模式
```

| 地址 | 说明 |
|------|------|
| `http://localhost` | 🌐 前端应用（Vite HMR，经 Nginx 反代） |
| `http://localhost/admin/` | 🏢 管理后台（Vite HMR，经 Nginx 反代） |
| `http://localhost:8010` | 🔧 后端 API（uvicorn --reload） |
| `http://localhost:8010/docs` | 📖 API 文档 |

> **开发模式原理**：前端、管理后台、主后端、独立 `sandbox-worker`、数据库仍然全部运行在 Docker 容器中，但前端、管理后台与主后端通过 volume 挂载将本地代码映射到容器内。主后端使用 `uvicorn --reload` 自动检测 Python 文件变更；前端和管理后台使用 Vite dev server 提供 HMR 热模块替换。

---

## 🎓 使用流程

### 首次使用

1. **注册账号** — 访问 http://localhost，点击「注册」
2. **选择学科** — 登录后进入工作台，选择感兴趣的学科
3. **完成评估** — 完成所选学科的水平评估题（约 15 分钟）
4. **获取方案** — 查看生成的个性化能力分析和学习建议
5. **开始学习** — 根据 AI 推荐的定制化路径开始学习

### 核心功能导览

| 功能模块 | 入口 | 说明 |
|----------|------|------|
| **仪表盘** | `/app/dashboard` | 跨学科进展概览、能力雷达图、学习统计、智能推荐 |
| **学科切换** | `/app/subjects` | 多学科选择与切换 |
| **学科详情** | `/app/subject/:id` | 章节列表、成就树、学科进度 |
| **学习工作台** | `/app/studio/:id` | 统一承载概念学习、AI 提问和练习历史的沉浸式空间 |
| **AI 学习路线** | `/app/ai-learning-path` | AI 生成多阶段个性化学习计划 |
| **学习计划** | `/app/ai-learning-path/plan/:id` | 阶段任务、概念学习与复习进度 |
| **智能题库** | `/app/question-bank` | AI 组题、按知识点/难度筛选 |
| **题目列表** | `/app/problems` | 全题库浏览与练习 |
| **学习统计** | `/app/stats` | 多维度数据分析与学习报告 |
| **个人中心** | `/app/profile` | 能力模型、行为历史和学习模式分析 |
| **概念学习** | `/app/concept-learning/:taskId` | 沉浸式流式概念内容 + 内嵌 AI 对话 |
| **互动式学习** | `/app/interactive-learning` | 结构化课程列表与学习 |
| **Prompt Lab** | `/app/prompt-lab` | (仅开发环境) Prompt 编辑与调试 |
| **管理后台** | `/admin/` | 独立管理面板（用户/学科/社区/系统管理） |

---

## ⚙️ AI 功能配置

### 方式一：配置文件（推荐）

编辑 `backend/config.toml`：

```toml
[llm.system]
api_key = "sk-your-api-key-here"
base_url = "https://api.deepseek.com/v1"
model = "deepseek-chat"
enabled = true
```

**常用 API 服务**:

| 服务商 | base_url | model |
|--------|----------|-------|
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` |
| OpenAI | `https://api.openai.com/v1` | `gpt-3.5-turbo` |
| 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-turbo` |

修改后重启后端即可。

### 方式二：可视化配置

访问 http://localhost:8010/config，通过 Web 界面配置 API 密钥和模型参数。

---

## 🗄️ 数据库管理

### 迁移操作

```bash
cd backend

# 应用所有迁移
uv run alembic upgrade head

# 创建新迁移
uv run alembic revision --autogenerate -m "description"

# 回滚迁移
uv run alembic downgrade -1
```

### 初始化数据

```bash
cd backend

# 初始化学科数据（七大学科）— 首次部署或重置数据库后必须执行
uv run python -m scripts.seed_subjects
```

> **注意**: 不执行 seed 脚本，学科切换、成就树等功能将无法正常显示。

### Docker 操作

```bash
# 全栈启动/停止
docker compose up -d                    # 启动所有服务
docker compose down                     # 停止所有服务
docker compose up -d --build            # 重建并启动（代码更新后）

# 仅启动数据库（本地开发用）
docker compose up -d postgres

# 查看日志
docker compose logs -f                  # 所有服务日志
docker compose logs -f backend          # 仅后端日志
docker compose logs -f sandbox-worker   # 独立代码沙箱日志

# 容器内运行命令
docker compose exec backend alembic upgrade head           # 数据库迁移
docker compose exec backend python -m scripts.seed_subjects # 初始化学科

# 备份 / 恢复
docker compose exec postgres pg_dump -U ai_learning learning_platform > backup.sql
docker compose exec -T postgres psql -U ai_learning learning_platform < backup.sql
```

### 代码沙箱

项目采用**独立 `sandbox-worker` 服务**承载工程类代码执行：

| 组件 | 作用 |
|------|------|
| `backend` | 业务 API、鉴权、数据读写、执行请求分发 |
| `sandbox-worker` | 独立执行 Python / 科学计算代码 |
| 前端 `CodeSandbox` | 轻量代码前端直接运行，重代码自动请求后端转发 |

---

## 📂 项目结构

```
a-track/
├── backend/                          # FastAPI 后端
│   ├── app/
│   │   ├── core/                     # 核心基础设施
│   │   ├── models/                   # SQLAlchemy 数据模型
│   │   ├── schemas/                  # Pydantic 请求/响应模型
│   │   ├── routers/                  # API 路由
│   │   ├── services/                 # 业务逻辑层
│   │   ├── prompts/                  # Prompt 管理系统
│   │   ├── dependencies/             # FastAPI 依赖注入
│   │   ├── templates/                # HTML 模板
│   │   └── main.py                   # 应用入口
│   ├── scripts/                      # 运维脚本
│   ├── tests/                        # 后端测试
│   ├── alembic/                      # 数据库迁移
│   ├── sandbox_worker/               # 独立代码沙箱服务
│   ├── config.toml                   # 应用配置文件
│   ├── pyproject.toml                # uv 依赖管理
│   └── requirements.txt              # pip 兼容依赖
├── frontend/                         # React + TypeScript 前端
│   ├── src/
│   │   ├── pages/                    # 页面组件
│   │   ├── components/               # 可复用组件
│   │   ├── stores/                   # Zustand 状态管理
│   │   ├── lib/                      # 工具函数 & API 客户端
│   │   ├── features/                 # 功能模块
│   │   ├── hooks/                    # 自定义 Hooks
│   │   └── styles/                   # 样式覆盖
│   ├── package.json                  # npm 依赖
│   ├── vite.config.ts                # Vite 配置
│   └── tailwind.config.js            # Tailwind 配置
├── admin/                            # Vue 3 管理后台面板
│   ├── src/
│   │   ├── views/                    # 管理页面
│   │   ├── components/               # 管理组件
│   │   ├── layout/                   # 管理布局
│   │   └── router/                   # Vue Router 路由
│   └── package.json                  # npm 依赖
├── nginx/                            # Nginx 配置
├── docs/                             # 项目文档
├── docker-compose.yml                # 生产配置
├── docker-compose.dev.yml            # 开发配置（热重载）
├── deploy.ps1                        # 部署脚本（Windows）
├── deploy.sh                         # 部署脚本（Linux/Mac）
├── .env.example                      # 环境变量模板
├── CONTRIBUTING.md                   # 贡献指南
├── CHANGELOG.md                      # 版本变更日志
├── LICENSE                           # MIT 许可证
└── README.md                         # 本文件
```

---

## 📚 API 端点概览

| 前缀 | 功能 | 说明 |
|------|------|------|
| `/api/auth` | 🔐 用户认证 | 注册、登录、JWT Token |
| `/api/profile` | 👤 用户档案 | 个人信息、头像、学习偏好 |
| `/api/subjects` | 📘 学科管理 | 获取学科列表、章节、切换学科 |
| `/api/assessment` | 🎯 水平评估 | 自适应评估题生成与结果分析 |
| `/api/diagnostics` | 📊 诊断测试 | 快速诊断与能力定位 |
| `/api/practice` | 📝 练习系统 | 多题型练习、代码执行、自动评测 |
| `/api/question-bank` | 📝 智能题库 | AI 组题、难度筛选、批量生成 |
| `/api/concept-learning` | 📖 概念学习 | 流式内容生成、配图、AI 提问 |
| `/api/graph` | 🗺️ 知识图谱 | 学科知识节点与依赖关系 |
| `/api/learning-path-map` | 🗺️ 学习路径地图 | 路径节点与进度 |
| `/api/ai-learning-path` | 🛤️ AI 学习路线 | 个性化学习计划生成与管理 |
| `/api/ai-tutor` | 🤖 AI 导师 | 苏格拉底式对话、个性化引导 |
| `/api/achievement-tree` | 🏆 成就树 | 章节进度、成就解锁 |
| `/api/community` | 💬 学习社区 | 帖子、评论、点赞、通知 |
| `/api/reporting` | 📈 学习报告 | 进度统计、数据分析 |
| `/api/user-memory` | 🧠 用户记忆 | 行为追踪、偏好、交互历史 |
| `/api/llm-config` | ⚙️ LLM 配置 | API Key 管理、模型参数 |
| `/api/observability` | 🔍 系统监控 | 健康检查、性能指标 |

完整 API 文档见: http://localhost:8010/docs

---

## 🔧 开发指南

### 运行测试

```bash
# 后端测试
cd backend
uv run pytest

# 前端测试
cd frontend
npm run test:run
```

### 代码格式化

```bash
# 后端
cd backend
uv run black .
uv run isort .

# 前端
cd frontend
npm run lint
```

### 代码审查

项目提供了详细的代码审查清单 — 见 `docs/code-review.md`。

---

## 🛠️ 常见问题

<details>
<summary><strong>Q: docker-compose up -d 报错端口被占用？</strong></summary>

**原因**: 宿主机端口被占用或被系统保留（Windows + WSL2/Hyper-V 常见）。

**解决方案**:
1. 修改 `.env` 中的端口（如 `FRONTEND_PORT=8080`、`POSTGRES_PORT=15433`）
2. 重新启动: `.\deploy.ps1`
3. 验证: `docker ps` 查看端口映射
</details>

<details>
<summary><strong>Q: 注册/登录时报 422 Unprocessable Content？</strong></summary>

**原因**: FastAPI/Pydantic 参数校验失败。

**解决方案**:
1. 确认邮箱格式正确且无首尾空格
2. 密码至少 6 位
3. 浏览器 DevTools → Network → 查看响应 `detail` 定位具体字段
</details>

<details>
<summary><strong>Q: AI 导师不直接给答案？</strong></summary>

这是设计特性 — 采用苏格拉底式教学法引导思考。如需直接答案，在对话请求中设置:
```json
{ "request_direct_answer": true }
```
</details>

<details>
<summary><strong>Q: 如何切换 LLM 模型？</strong></summary>

修改 `backend/config.toml` 中的 `model` 字段，或通过 http://localhost:8010/config Web 界面切换。
</details>

<details>
<summary><strong>Q: 在 cmd 终端中无法运行 .ps1 脚本？</strong></summary>

在 Command Prompt 中需要加 `powershell` 前缀：
```cmd
powershell .\deploy.ps1 -Dev
```
或者直接使用 PowerShell 终端。
</details>

---

## 🤝 贡献

欢迎贡献！请阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 了解详情。

---

## 📖 参考文档

- [FastAPI](https://fastapi.tiangolo.com/) · [SQLAlchemy](https://docs.sqlalchemy.org/) · [Alembic](https://alembic.sqlalchemy.org/)
- [React](https://react.dev/) · [Vite](https://vitejs.dev/) · [Tailwind CSS](https://tailwindcss.com/)
- [Zustand](https://zustand-demo.pmnd.rs/) · [TanStack Query](https://tanstack.com/query/) · [React Flow](https://reactflow.dev/)
- [Vue 3](https://vuejs.org/) · [Element Plus](https://element-plus.org/)

---

## 📄 License

本项目采用 [MIT 许可证](LICENSE) 开源。
