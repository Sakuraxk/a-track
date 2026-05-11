# 提示词管理与手动测试指南

## 1. 目录结构

| 路径 | 说明 |
| --- | --- |
| `backend/app/prompts/catalog.toml` | Prompt 元数据注册表 |
| `backend/app/prompts/templates/` | Prompt 模板正文 |
| `backend/app/prompts/registry.py` | Prompt 加载、校验、渲染入口 |
| `backend/app/prompts/versions/` | Prompt 历史版本快照 |
| `backend/prompts/fixtures/` | 手动测试样例输入 |
| `backend/scripts/prompt_playground.py` | 手动测试脚本 |

---

## 2. 已迁移的 Prompt

| Prompt Key | 用途 |
| --- | --- |
| `assessment.generate_questions` | 生成水平评估题目 |
| `assessment.analyze_results` | 分析评估结果 |
| `question_bank.generate` | AI 生成题库题目 |
| `question_bank.explain` | AI 题目讲解 |
| `ai_scoring.score_answer` | 主观题评分 |
| `ai_recommendation.recommend` | 个性化推荐 |
| `hint.generate` | 分层提示生成 |
| `knowledge_graph.generate` | 生成知识图谱 |
| `knowledge_graph.expand_node` | 扩展知识图谱节点 |
| `ai_learning_path.generate` | 生成学习路线 |
| `ai_learning_path.extend` | 续写学习路线 |
| `llm_service.role_explainer` | 导师角色系统提示 |
| `llm_service.role_code_reviewer` | 代码审查角色系统提示 |
| `llm_service.guidance_instruction` | 引导式回答附加指令 |
| `llm_service.direct_answer_instruction` | 直接回答附加指令 |

---

## 3. 手动测试

先进入后端目录：

```bash
cd backend
```

### 3.1 只渲染，不调用模型

```bash
python scripts/prompt_playground.py --prompt question_bank.generate --fixture prompts/fixtures/question_bank_generate.json
```

用途：

| 场景 | 说明 |
| --- | --- |
| 改模板后检查 messages | 确认 system/user 是否正确拼接 |
| 检查变量注入 | 确认主题、难度、上下文已正确进入 prompt |
| Review 前自检 | 快速查看最终发送给模型的内容 |

### 3.2 调用系统配置模型

确保 `backend/config.toml` 中的 `llm.system` 已配置，然后执行：

```bash
python scripts/prompt_playground.py --prompt question_bank.generate --fixture prompts/fixtures/question_bank_generate.json --run
```

可选覆盖参数：

```bash
python scripts/prompt_playground.py --prompt question_bank.generate --fixture prompts/fixtures/question_bank_generate.json --run --temperature 0.2 --max-tokens 1200
```

---

## 4. 网页端 Prompt Lab

开发环境下，前端会显示一个内部工具页：

| 路径 | 说明 |
| --- | --- |
| `/app/prompt-lab` | 网页端 Prompt 编辑、测试、版本管理页面 |

### 4.1 主要能力

| 能力 | 说明 |
| --- | --- |
| 编辑 Prompt | 修改 system/user 模板与参数 |
| 保存 | 直接写回模板文件和 catalog |
| 自动建版本 | 每次保存自动生成版本快照 |
| Render Prompt | 只渲染 messages，不调用模型 |
| 运行系统模型 | 用当前编辑内容直接做模型联调 |
| 提示词质量分析 | 返回真实评分、维度分、问题列表与建议 |
| 一键优化 | 基于规则分析生成优化版草稿，并写回编辑区 |
| 版本对比 | 对比历史版本差异 |
| 恢复版本 | 将历史版本恢复为当前版本 |

### 4.2 使用流程

| 步骤 | 操作 |
| --- | --- |
| 1 | 打开 `/app/prompt-lab` |
| 2 | 在左侧选择 Prompt Key |
| 3 | 在中间编辑 system/user 模板和参数 |
| 4 | 在右侧填写或调整 Variables JSON |
| 5 | 先点 `Render Prompt` 检查最终 messages |
| 6 | 点 `提示词质量分析` 查看真实评分和诊断 |
| 7 | 如需自动优化，点分析抽屉中的 `一键优化` |
| 8 | 如需联调，点 `运行系统模型` |
| 9 | 确认无误后点 `保存并创建版本` |
| 10 | 在版本区做 diff 或 restore |

### 4.3 版本存储

| 路径 | 作用 |
| --- | --- |
| `backend/app/prompts/versions/index.json` | 版本索引 |
| `backend/app/prompts/versions/<prompt_key>/<version_id>/meta.json` | 版本元信息 |
| `.../system.md` | system 模板快照 |
| `.../user.md` | user 模板快照 |
| `.../catalog.json` | 参数快照 |

---

## 5. 新增一个 Prompt 的步骤

| 步骤 | 操作 |
| --- | --- |
| 1 | 在 `backend/app/prompts/templates/` 下新增模板文件 |
| 2 | 在 `backend/app/prompts/catalog.toml` 中注册 prompt key 和元数据 |
| 3 | 在业务代码中调用 `get_prompt_registry().render_messages(...)` |
| 4 | 为该 Prompt 增加 fixture |
| 5 | 用 `prompt_playground.py` 做 render-only 和真实调用测试 |

---

## 6. 设计约束

| 约束 | 说明 |
| --- | --- |
| catalog 不放大段正文 | 正文只放模板文件 |
| 模板变量必须显式 | 缺少变量时 registry 会直接报错 |
| 手动测试优先 render-only | 先检查 prompt，再决定是否真实调用 |

---

## 7. 代码调用示例

```python
from app.prompts import get_prompt_registry

messages = get_prompt_registry().render_messages(
    "question_bank.generate",
    {
        "subject_name": "Python",
        "count": 2,
        "difficulty_desc": "中等",
        "difficulty": 3,
        "type_prompt": "请生成选择题。",
        "topic_clause": "",
        "topic_requirement": "",
    },
)
```

返回结果可直接传给 OpenAI 兼容接口：

```python
response = await client.chat.completions.create(
    model=model_name,
    messages=messages,
    temperature=0.7,
    max_tokens=2000,
)
```
