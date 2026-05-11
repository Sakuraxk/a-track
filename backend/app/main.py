import sys
import asyncio
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html, get_redoc_html
from fastapi.staticfiles import StaticFiles
from datetime import datetime

# Fix for Windows asyncpg compatibility: Use SelectorEventLoop instead of ProactorEventLoop
# This resolves TimeoutError and CancelledError issues with asyncpg on Windows
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from .routers import (
    auth,
    profile,
    diagnostics,
    practice,
    ai_tutor,
    reporting,
    observability,
    llm_config,
    community,
    ai_learning_path,
    subjects,
    achievement_tree,
    assessment,
    question_bank,
    concept_learning,
    user_memory,
    dev_prompts,
    learning_path_map,
)
from .core.config import settings
from .core.db import init_models, close_db, verify_connection
from .core.redis import init_redis, close_redis
from .services.llm_service import LLMServiceFactory


# API 标签元数据（中文描述）
tags_metadata = [
    {
        "name": "ai-tutor",
        "description": "🤖 **AI 智能导师** - 与 AI 导师进行对话，获取编程指导和学习建议",
    },
    {
        "name": "llm-config",
        "description": "⚙️ **模型配置** - 管理用户的 LLM API 配置，支持多模型角色",
    },
    {
        "name": "practice",
        "description": "📝 **练习系统** - 编程练习、代码提交与自动评测",
    },
    {
        "name": "diagnostics",
        "description": "📊 **诊断测试** - 用户水平评估与能力诊断",
    },
    {
        "name": "auth",
        "description": "🔐 **身份认证** - 用户注册、登录与授权",
    },
    {
        "name": "profile",
        "description": "👤 **用户档案** - 个人信息与学习偏好管理",
    },
    {
        "name": "reporting",
        "description": "📈 **学习报告** - 学习进度统计与数据分析",
    },
    {
        "name": "observability",
        "description": "🔍 **系统监控** - 服务状态与性能指标",
    },
    {
        "name": "community",
        "description": "💬 **学习社区** - 帖子分享、点赞、评论与互动",
    },
    {
        "name": "ai-learning-path",
        "description": "🛤️ **AI学习路线** - AI生成个性化学习计划和每日任务",
    },
    {
        "name": "用户记忆",
        "description": "🧠 **用户记忆** - 长期记忆管理，追踪用户行为、偏好和学习模式",
    },
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # Verify Windows event loop policy is correct
    if sys.platform == "win32":
        policy = asyncio.get_event_loop_policy()
        if isinstance(policy, asyncio.WindowsSelectorEventLoopPolicy):
            print("[OK] Windows asyncpg compatibility: WindowsSelectorEventLoopPolicy active")
        else:
            print(f"[WARNING] Event loop policy is {type(policy).__name__}, may cause issues")

    # 安全检查：非本地环境不允许使用默认密钥
    _DEFAULT_SECRETS = {"dev-secret-change-in-production", "dev-encryption-key-32-chars-xx"}
    if settings.environment not in ("local", "development"):
        _fatal_errors = []
        if settings.jwt_secret in _DEFAULT_SECRETS:
            _fatal_errors.append("JWT_SECRET")
        if settings.encryption_key in _DEFAULT_SECRETS:
            _fatal_errors.append("ENCRYPTION_KEY")
        if _fatal_errors:
            raise RuntimeError(
                f"🔴 安全检查失败：以下密钥仍使用默认值 → {', '.join(_fatal_errors)}\n"
                f"生产环境必须设置安全的密钥，否则用户 API Key 等敏感数据将面临泄露风险！\n"
                f"生成方式:\n"
                f"  JWT_SECRET:     openssl rand -hex 32\n"
                f"  ENCRYPTION_KEY: python -c \"import secrets; print(secrets.token_hex(16))\""
            )
    else:
        if settings.jwt_secret in _DEFAULT_SECRETS:
            print("[WARNING] JWT_SECRET 使用默认值（仅限开发环境）")

    # 启动时：开发环境自动创建表，生产环境请用 Alembic
    if settings.environment in ["local", "development"]:
        # 跳过启动时的数据库初始化，延迟到首次使用时
        # 这避免了启动超时问题，并加快启动速度
        print("[INFO] 数据库将在首次使用时自动初始化")
        print("[INFO] 如需手动初始化，请访问: POST /api/admin/init-db")
    else:
        print("生产环境，请使用 Alembic 管理数据库迁移")

    # 启动 Redis 连接池
    await init_redis()

    # 检测系统 LLM 连接（可跳过以避免启动依赖外网）
    if settings.use_system_llm and settings.deepseek_api_key:
        if not settings.llm_startup_check:
            print("系统 LLM 已启用：已跳过启动连通性检查")
        else:
            print("正在检测系统 LLM 连接...")
            try:
                service = LLMServiceFactory.create(
                    api_base_url=settings.deepseek_base_url,
                    api_key=settings.deepseek_api_key,
                    model_name=settings.deepseek_model,
                    timeout=10,
                )
                result = await service.test_connection()
                if result.get("success"):
                    print(
                        f"系统 LLM 连接成功 (模型: {settings.deepseek_model}, 延迟: {result.get('latency_ms', 0):.0f}ms)"
                    )
                else:
                    print(f"系统 LLM 连接失败: {result.get('message', '未知错误')}")
            except Exception as e:
                print(f"系统 LLM 连接检测出错: {e}")
    else:
        print("系统 LLM 未启用")

    yield

    # 关闭时清理数据库连接池与 Redis
    await close_db()
    print("[OK] 应用关闭，数据库连接池已释放")
    await close_redis()


def create_app() -> FastAPI:
    app = FastAPI(
        title="🎓 智辙 (A-Track) - AI 智能教学平台",
        version="1.0.0",
        description="""
## 📚 项目简介

**智辙 (A-Track) AI 智能教学平台** 是一个多学科自适应学习系统，通过 AI 导师提供个性化的学习指导。

### ✨ 核心功能

| 功能 | 说明 |
|------|------|
| 🤖 AI 导师 | 智能对话，引导式教学，不直接给答案 |
| 📊 水平诊断 | 自适应测试，精准评估学习水平 |
| 🗺️ 学习路径 | 根据用户水平生成个性化学习计划 |
| 📝 编程练习 | 海量题库，自动评测，即时反馈 |
| 📈 学习报告 | 可视化学习进度与能力分析 |

### 🚀 快速开始

1. 配置您的 LLM API（支持 OpenAI、DeepSeek 等）
2. 与 AI 导师开始对话
3. 完成诊断测试，获取个性化学习路径

---
        """,
        lifespan=lifespan,
        openapi_tags=tags_metadata,
        docs_url=None,  # 禁用默认的 /docs
        redoc_url=None,  # 禁用默认的 /redoc
        swagger_ui_parameters={
            "docExpansion": "none",
            "filter": True,
            "showExtensions": True,
            "showCommonExtensions": True,
            "syntaxHighlight.theme": "monokai",
        },
    )

    # 配置CORS（根据环境动态设置来源）
    if settings.environment in ("local", "development"):
        cors_origins = ["*"]
        cors_credentials = False  # allow_credentials=True 与 "*" 不兼容
    else:
        cors_origins = [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ]
        cors_credentials = True

    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=cors_credentials,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 挂载静态文件目录（用于上传的头像等）
    uploads_dir = Path("uploads")
    uploads_dir.mkdir(exist_ok=True)
    app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

    # 添加根路由
    @app.get("/", tags=["observability"])
    async def root():
        """应用根端点，提供基本信息和导航"""
        return JSONResponse(
            content={
                "message": "🎓 智辙 (A-Track) - AI 智能教学平台 API",
                "version": "1.0.0",
                "status": "running",
                "timestamp": datetime.now().isoformat(),
                "quick_start": {
                    "step1": "访问 /config 配置您的 LLM API",
                    "step2": "访问 /docs 查看 API 文档",
                    "step3": "调用 /api/ai-tutor/chat 开始对话"
                },
                "pages": {
                    "config": "/config - 🎛️ 可视化配置中心",
                    "docs": "/docs - 📖 API 文档",
                    "redoc": "/redoc - 📚 API 参考"
                },
                "endpoints": {
                    "ai_tutor": "/api/ai-tutor - AI 智能导师",
                    "llm_config": "/api/llm-config - 模型配置",
                    "practice": "/api/practice - 练习系统",
                    "diagnostics": "/api/diagnostics - 诊断测试",
                    "ai_learning_path": "/api/ai-learning-path - AI学习路线"
                }
            }
        )

    # 健康检查端点
    @app.get("/health", tags=["observability"])
    async def health_check():
        """
        健康检查端点

        用于监控服务状态和负载均衡探测。

        返回:
        - **status**: 服务状态（healthy/unhealthy）
        - **service**: 服务名称
        - **version**: 当前版本
        - **timestamp**: 检查时间
        """
        return {
            "status": "healthy",
            "status_cn": "运行正常",
            "service": "ai-learning-platform",
            "service_cn": "智辙 (A-Track) AI 智能教学平台",
            "timestamp": datetime.now().isoformat(),
            "version": "1.0.0"
        }

    # 自定义 Swagger UI（现代扁平化设计）
    @app.get("/docs", include_in_schema=False)
    async def custom_swagger_ui_html():
        """自定义 Swagger UI 页面"""
        return get_swagger_ui_html(
            openapi_url=app.openapi_url,
            title=f"{app.title} - API 文档",
            swagger_js_url="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js",
            swagger_css_url="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css",
            swagger_favicon_url="https://fastapi.tiangolo.com/img/favicon.png",
            swagger_ui_parameters={
                "docExpansion": "none",
                "filter": True,
                "showExtensions": True,
                "syntaxHighlight.theme": "monokai",
                "tryItOutEnabled": True,
                "requestSnippetsEnabled": True,
                "defaultModelsExpandDepth": -1,
                "persistAuthorization": True,
            },
        )

    # 自定义 ReDoc（现代扁平化设计）
    @app.get("/redoc", include_in_schema=False)
    async def custom_redoc_html():
        """自定义 ReDoc 页面"""
        return get_redoc_html(
            openapi_url=app.openapi_url,
            title=f"{app.title} - API 参考文档",
            redoc_js_url="https://cdn.jsdelivr.net/npm/redoc@latest/bundles/redoc.standalone.js",
            redoc_favicon_url="https://fastapi.tiangolo.com/img/favicon.png",
            with_google_fonts=True,
        )

    # 可视化配置页面
    @app.get("/config", include_in_schema=False)
    async def config_page():
        """LLM 配置中心页面"""
        template_path = Path(__file__).parent / "templates" / "config.html"
        return HTMLResponse(content=template_path.read_text(encoding="utf-8"))

    # 注册路由
    app.include_router(subjects.router, prefix="/api/subjects", tags=["subjects"])
    app.include_router(achievement_tree.router, prefix="/api/achievement-tree", tags=["achievement-tree"])
    app.include_router(assessment.router, prefix="/api/assessment", tags=["assessment"])
    app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
    app.include_router(profile.router, prefix="/api/profile", tags=["profile"])
    app.include_router(diagnostics.router, prefix="/api/diagnostics", tags=["diagnostics"])
    app.include_router(practice.router, prefix="/api/practice", tags=["practice"])
    app.include_router(ai_tutor.router, prefix="/api/ai-tutor", tags=["ai-tutor"])
    app.include_router(llm_config.router, prefix="/api/llm-config", tags=["llm-config"])
    app.include_router(reporting.router, prefix="/api/reporting", tags=["reporting"])
    app.include_router(community.router, prefix="/api/community", tags=["community"])
    app.include_router(ai_learning_path.router, prefix="/api/ai-learning-path", tags=["ai-learning-path"])
    app.include_router(learning_path_map.router, prefix="/api/learning-path-map", tags=["learning-path-map"])
    app.include_router(question_bank.router, prefix="/api/question-bank", tags=["question-bank"])
    app.include_router(concept_learning.router, prefix="/api/concept-learning", tags=["concept-learning"])
    app.include_router(dev_prompts.router)
    app.include_router(user_memory.router)  # Uses prefix from router definition
    app.include_router(observability.router, prefix="/api", tags=["observability"])

    return app


app = create_app()

# Application entrypoint for `uvicorn app.main:app --reload`
