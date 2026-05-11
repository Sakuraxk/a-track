# 项目依赖说明 (Project Requirements)

本项目分为前端 (Frontend) 和后端 (Backend) 两部分，分别使用不同的包管理工具。

## 1. 前端 (Frontend)

前端基于 React, TypeScript, Vite 构建。

**依赖管理文件**: `frontend/package.json`  
**包管理器**: `npm` (Node Package Manager)

### 核心依赖
- **React 18**: UI 框架
- **Vite**: 构建工具
- **Tailwind CSS**: 样式框架
- **Shadcn UI**: UI 组件库 (基于 Radix UI)
- **React Router**: 路由管理
- **Zustand**: 状态管理
- **React Query**: 数据获取与缓存
- **React Flow**: 知识图谱可视化
- **Monaco Editor**: 代码编辑器组件

### 如何安装
请在终端中执行以下命令：

```bash
cd frontend
npm install
```

### 如何启动
```bash
npm run dev
```

---

## 2. 后端 (Backend)

后端基于 Python, FastAPI 构建。

**依赖管理文件**: `backend/pyproject.toml`（主）、`backend/uv.lock`（锁定）、`backend/requirements.txt`（pip 兼容备份）  
**包管理器**: `uv`

### 核心依赖
- **FastAPI**: Web 框架
- **Uvicorn**: ASGI 服务器
- **SQLAlchemy**: ORM (数据库操作)
- **Pydantic**: 数据验证
- **LangChain**: AI 智能体编排
- **OpenAI**: LLM 接口调用
- **pgvector**: 向量数据库支持 (PostgreSQL)
- **Pandas/Numpy**: 数据处理与分析

### 如何安装（uv）
```bash
cd backend
python -m pip install --user uv  # 首次安装 uv
uv sync --group dev              # 同步依赖并创建/更新 .venv
```

### 常见问题
| 现象 | 说明 | 解决办法 |
| --- | --- | --- |
| `ModuleNotFoundError: No module named 'pydantic_settings'` | 依赖未同步或环境混用 | 运行 `cd backend && uv sync --group dev`，并通过 `uv run ...` 执行命令，避免同时启用 conda 与 `.venv` |
| `No Python at 'C:\Users\xxx\anaconda3\python.exe'`（或类似路径） | `backend/.venv` 是别的机器上创建的，`pyvenv.cfg` 里写死了绝对路径 | 删除 `backend/.venv` 目录后重新执行 `cd backend && uv sync --group dev` |

### 如何启动
```bash
uv run uvicorn app.main:app --reload
```
