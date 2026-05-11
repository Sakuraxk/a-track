"""
AI导师路由
处理与AI导师的对话交互
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.schemas.conversation import (
    ChatRequest, ChatResponse,
)
from app.schemas.ai_tutor import TutorRequest, TutorResponse
from app.services.conversation_service import ConversationService, ConversationServiceError


router = APIRouter()


# ============== 新的对话API ==============

@router.post("/chat", response_model=ChatResponse, summary="💬 与AI导师对话")
async def chat(
    request: ChatRequest,
    user_id: str = Query(..., description="用户ID"),
    db: AsyncSession = Depends(get_db)
) -> ChatResponse:
    """
    与AI导师进行智能对话

    ## 🎯 功能说明
    - 支持角色切换：`explainer`（讲解者）、`code_reviewer`（代码审查员）
    - 默认为引导式回答，设置 `request_direct_answer=true` 获取直接答案
    - 可传入上下文（当前学习节点、题目、错误记录）增强回答相关性

    ## 📝 参数说明
    | 参数 | 必填 | 说明 |
    |------|:----:|------|
    | session_id | 否 | 传入已有会话ID继续对话，不传则创建新会话 |
    | message | 是 | 用户消息内容（1-4000字符） |
    | tutor_role | 否 | AI导师角色，默认 `explainer` |
    | context | 否 | 学习上下文信息（知识节点、题目等） |
    | request_direct_answer | 否 | 是否请求直接答案，默认 `false` |

    ## ⚠️ 注意
    使用此API前需要先配置LLM（通过 `/api/llm-config` 端点）
    """
    service = ConversationService(db)
    try:
        return await service.chat(user_id, request)
    except ConversationServiceError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"对话服务错误: {str(e)}")


@router.post("/chat/stream", summary="🌊 流式与AI导师对话")
async def chat_stream(
    request: ChatRequest,
    user_id: str = Query(..., description="用户ID"),
    db: AsyncSession = Depends(get_db)
):
    """
    流式与AI导师对话 (Server-Sent Events)

    ## 🎯 功能说明
    与普通 /chat 接口相同，但使用 SSE 流式返回响应，实时显示 AI 回复内容。

    ## 📤 返回事件类型
    返回的是 SSE 格式的流，每个事件格式为 `data: {...}\\n\\n`：

    | type | 说明 |
    |------|------|
    | `session` | 会话ID，格式：`{"type": "session", "session_id": "..."}` |
    | `thinking` | 思维链内容（仅 DeepSeek R1 等推理模型），逐字返回 |
    | `content` | 正常回复内容，逐字返回 |
    | `done` | 流结束，包含完整内容 |
    | `error` | 错误信息 |

    ## 💡 前端使用示例
    ```javascript
    const response = await fetch('/api/ai-tutor/chat/stream?user_id=xxx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '你好' })
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const lines = decoder.decode(value).split('\\n\\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const chunk = JSON.parse(line.slice(6));
          if (chunk.type === 'content') {
            // 实时显示内容
            console.log(chunk.content);
          }
        }
      }
    }
    ```
    """
    service = ConversationService(db)

    return StreamingResponse(
        service.chat_stream(user_id, request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # 禁用 nginx 缓冲
        }
    )





# ============== 兼容旧API（保留但标记为废弃） ==============

@router.post("/", response_model=TutorResponse, deprecated=True, summary="⚠️ [已废弃] 旧版导师接口")
async def guide_legacy(payload: TutorRequest) -> TutorResponse:
    """
    **⚠️ 此接口已废弃**

    仅返回静态响应，请迁移到新的 `/chat` 端点。

    新端点优势：
    - ✅ 真正的 LLM 对话
    - ✅ 会话历史管理
    - ✅ 上下文感知
    - ✅ 多角色支持
    """
    tips = [
        "Focus on the base case first.",
        "Add print statements to observe loop counters.",
    ]
    message = "Here is a guided breakdown, not the full answer. Please use the new /chat endpoint for AI-powered responses."
    return TutorResponse(
        message=message,
        model_used="static",
        guidance_only=True,
        tips=tips,
        references=payload.context_nodes,
    )
