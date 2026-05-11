# 代码审查清单 — Vibe Coding Edition

> 适用于 AI 辅助开发（Claude / Copilot / Cursor 等）的 React + FastAPI + AI 项目。
> 每次提交前，提交者自查；每次 PR，审查者逐项过。

---

## 1. 异步 & 流式（FastAPI）

- [ ] `StreamingResponse` 的生成器**禁止**使用 `Depends(get_db)` 注入的会话
  — 必须在生成器内部通过 `get_session()` 自建会话（依赖注入会话在响应返回后即关闭）
- [ ] 生成器捕获 `asyncio.CancelledError` 并正确清理资源；`try/finally` 关闭 DB/HTTP 连接
- [ ] 客户端断连时停止上游 LLM 任务（取消 token 生成或关闭上游流），避免持续计费
- [ ] SSE 端点设置 `media_type="text/event-stream"` + `Cache-Control: no-cache` + `X-Accel-Buffering: no`
- [ ] 流式端点包含心跳事件（`event: ping`），防止代理/浏览器断开空闲连接
- [ ] `async` 路径禁止阻塞型 I/O — 必须使用异步库或 `run_in_threadpool`
- [ ] 后台任务与请求上下文解耦 — 显式传参，不依赖 `Request` 对象生命周期

## 2. 数据库 & ORM

- [ ] 写操作有明确事务边界（`commit` / `rollback`），失败路径可控回滚
- [ ] 多表写入必须处于同一事务 — 任何失败整体回滚，禁止部分写入
- [ ] 列表/嵌套查询使用 `selectinload` / `joinedload`，无 N+1
- [ ] `AsyncSession` 不跨协程共享（共享会导致竞态与数据错乱）
- [ ] 热路径 SQL 必须有 `EXPLAIN` 证据或索引注释说明
- [ ] 列表查询必须分页或限流，禁止无限结果集
- [ ] 长事务/生成器中不持有锁过久，批量操作分段提交

## 3. API 合约

- [ ] Pydantic v2 模型显式 `model_config`（如 `from_attributes=True`），字段可选性正确
- [ ] 错误响应统一结构（`code` / `message` / `details`），状态码与语义一致
- [ ] 输入校验失败（422）与业务失败（4xx/5xx）区分清晰
- [ ] SSE 事件格式必须包含 `data` 字段；`event` 按协议约定使用
- [ ] 流开始后不可再改变 HTTP 状态码 — 错误必须通过 SSE 错误事件传递
- [ ] 若有终止事件，必须包含 `status` / `error` 字段

## 4. 前端状态 & 渲染

- [ ] Hooks 规则严格遵守 — 不在条件分支/循环中调用 hooks
- [ ] 流式 UI 更新有节流策略 — SSE token 合并更新：每 50–100ms 批量 setState 或 `requestAnimationFrame`
- [ ] 列表渲染使用稳定 `key`（禁止 `index`），尤其是流式插入场景
- [ ] `useMemo` / `useCallback` 依赖数组完整，无遗漏依赖
- [ ] 组件卸载时清理副作用（`AbortController`、定时器、事件监听）
- [ ] 受控/非受控输入不混用
- [ ] SSE 断线重连使用指数退避，重复事件做去重
- [ ] `useEffect` 必须幂等并正确清理（React 18 Strict Mode 开发态双调用）

## 5. 前端样式 & 组件

- [ ] Tailwind 暗色模式：所有自定义颜色同时提供 `dark:` 变体
- [ ] 响应式：关键页面在移动端（`sm:`）可用，无水平溢出
- [ ] `z-index` 有序管理 — 不随意使用 `z-[9999]`
- [ ] 禁止全局 `!important`；如需覆盖 Ant Design 样式仅在局部 scope 并说明原因
- [ ] 组件粒度合理 — 单文件超过 400 行需附"不拆分理由"，否则拆分

## 6. TypeScript 严格性

- [ ] 禁止 `any` — 使用 `unknown` 并显式缩窄
- [ ] 禁止无理由的 `@ts-ignore` — 改用 `@ts-expect-error` 并附注原因
- [ ] 未使用的变量/导入已清理（`noUnusedLocals` / `noUnusedParameters`）
- [ ] API 响应类型与后端实际返回结构对齐（含流式事件数据类型）
- [ ] 泛型约束明确，避免隐式 `any` 传播

## 7. 安全

- [ ] 所有写操作与敏感读路径有认证 + 授权检查
- [ ] 禁止字符串拼接 SQL — 使用参数化查询 / ORM
- [ ] 文件/URL 输入白名单校验 + 长度限制（防 SSRF / DoS）
- [ ] 日志不记录敏感信息（token / PII / 密钥）
- [ ] 关键端点有速率限制
- [ ] LLM / Markdown / HTML 输出必须做 XSS 净化，不能直接 `dangerouslySetInnerHTML`
- [ ] CORS 明确白名单；若使用 Cookie 鉴权必须有 CSRF 防护

## 8. AI / LLM 集成

- [ ] 模型调用设置超时 + 重试上限 + 幂等保护
- [ ] Prompt 中用户输入显式隔离（如 `<<<USER>>>` 区块），降低 prompt injection 风险
- [ ] Token 预算与截断策略明确（输入/输出上限），防成本失控
- [ ] 流式输出异常时发送终止事件并记录错误码
- [ ] 模型响应解析必须容错（JSON 解析失败有兜底）
- [ ] 模型输出必须做结构校验与安全过滤（JSON schema / regex guard）

## 9. Vibe Coding 专项 — AI 生成代码的常见陷阱

- [ ] **幻觉 API**：验证所有引用的库/函数/方法确实存在且签名正确
- [ ] **死代码**：清理未使用的导入、变量、函数、配置项
- [ ] **Happy Path 偏见**：检查 `catch` / `except` 路径是否完整且可观测（不是空 catch）
- [ ] **过度抽象**：单次调用的 helper/抽象必须有复用证据，否则内联
- [ ] **向后兼容幽灵**：删除的代码就彻底删除，不留 `_unused` 变量或 `// removed` 注释
- [ ] **测试覆盖**：关键逻辑有测试或最小复现脚本，不接受"看起来能跑"

---

## Vibe Coding 工作流规范

### 适合 AI 辅助的场景

| 场景 | AI 角色 | 人工职责 |
|------|---------|----------|
| CRUD / 样板代码 | 生成初稿 | 审查合约与边界 |
| 样式 / 布局调整 | 生成 Tailwind 类 | 验证暗色模式 + 响应式 |
| Bug 定位 | 分析日志 + 缩小范围 | 确认根因 + 验证修复 |
| 重构 | 提供方案对比 | 决策 + 回归测试 |
| 新架构 / 核心逻辑 | 仅作参考 | **必须人工主导**（涉及权限/资金/数据模型变更） |

### PR 审查流程

```
1. 提交者自查  →  对照本清单逐项过
2. AI 预审     →  可选：使用 Claude / Codex review 改动（受合规限制时跳过）
3. 人工审查    →  重点关注：
                   - 第 1、2 节（异步 + 数据库）— 最易出隐蔽 bug
                   - 第 9 节（Vibe Coding 专项）— AI 代码特有问题
                   - 安全相关改动必须双人审查
4. 构建验证    →  TypeScript 编译 + 生产构建通过
```

### 必须人工验证的红线

1. **数据库会话生命周期** — 任何涉及 `StreamingResponse` + DB 的改动
2. **认证/授权逻辑** — AI 常遗漏权限边界
3. **金额/计费/Token 消耗** — 数值精度与上限
4. **删除操作** — 级联删除、软删除策略
5. **第三方 API 调用** — 验证 API 确实存在、参数正确
