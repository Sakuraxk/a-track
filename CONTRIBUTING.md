# 贡献指南

感谢你对 **智辙 (A-Track)** 项目的关注！我们欢迎任何形式的贡献，包括但不限于：

- 🐛 Bug 报告
- 💡 功能建议
- 📝 文档改进
- 🔧 代码贡献

## 如何参与

### 报告 Bug

1. 在 [Issues](https://github.com/Sakuraxk/a-track/issues) 中搜索是否已存在相同问题
2. 如果没有，创建一个新的 Issue，请包含：
   - 问题的详细描述
   - 复现步骤
   - 期望行为 vs 实际行为
   - 运行环境信息（操作系统、Docker 版本等）

### 提交代码

1. **Fork** 本仓库
2. **创建功能分支**
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **编写代码**，确保遵循以下规范：
   - 后端代码使用 `black` 和 `isort` 格式化
   - 前端代码通过 `npm run lint` 检查
   - 新增 API 路由请补充 Pydantic schema
   - 前端组件遵循 TypeScript 类型定义
   - 数据库变更使用 Alembic 迁移
4. **运行测试**
   ```bash
   # 后端测试
   cd backend && uv run pytest

   # 前端测试
   cd frontend && npm run test:run
   ```
5. **提交你的修改**
   ```bash
   git commit -m "feat: 简要描述你的改动"
   ```
6. **推送到你的 Fork**
   ```bash
   git push origin feature/your-feature-name
   ```
7. **创建 Pull Request**

### Commit 信息规范

请使用 [Conventional Commits](https://www.conventionalcommits.org/) 格式：

| 前缀 | 用途 |
|------|------|
| `feat:` | 新功能 |
| `fix:` | Bug 修复 |
| `docs:` | 文档更新 |
| `refactor:` | 代码重构 |
| `test:` | 测试相关 |
| `chore:` | 构建/工具变更 |

### 代码审查

提交 PR 前，请参照 `docs/code-review.md` 中的代码审查清单自查，涵盖：

- 异步 & 流式（FastAPI 特有陷阱）
- 数据库 & ORM（事务边界、N+1 防范）
- API 合约（Pydantic v2 规范）
- 前端状态 & 渲染（Hooks 规则、流式 UI）
- TypeScript 严格性
- 安全 & AI/LLM 集成

## 开发环境搭建

请参阅 [README.md](README.md) 中的快速开始章节。

## 行为准则

请保持友善和尊重。我们致力于提供一个开放、包容的社区环境。

## 许可证

通过贡献代码，你同意你的贡献将在 [MIT 许可证](LICENSE) 下发布。
