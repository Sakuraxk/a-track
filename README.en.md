<div align="center">

<img src="docs/images/logo.png" alt="A-Track Logo" width="120" />

# A-Track · 智辙

**AI-Powered Multi-Disciplinary Adaptive Learning Platform**

_AI wisdom paves the track of knowledge for every learner_

[简体中文](./README.md) · [Live Demo](http://8.148.82.93/) · [Changelog](CHANGELOG.md) · [Contributing](CONTRIBUTING.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/Sakuraxk/a-track?style=social)](https://github.com/Sakuraxk/a-track/stargazers)
[![GitHub Issues](https://img.shields.io/github/issues/Sakuraxk/a-track)](https://github.com/Sakuraxk/a-track/issues)
[![GitHub Pull Requests](https://img.shields.io/github/issues-pr/Sakuraxk/a-track)](https://github.com/Sakuraxk/a-track/pulls)

[![Python 3.10+](https://img.shields.io/badge/Python-3.10+-3776AB?logo=python&logoColor=white)](#)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)](#)
[![React 18](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](#)
[![Vue 3](https://img.shields.io/badge/Vue-3-4FC08D?logo=vuedotjs&logoColor=white)](#)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](#)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white)](#)

</div>

---

<div align="center">
  <img src="docs/images/hero-screenshot.png" alt="A-Track Platform" width="90%" />
</div>

<div align="center">

> 🎓 Covers **7 core disciplines**: **Python Programming** · **Machine Learning** · **Advanced Mathematics** · **Probability** · **Linear Algebra** · **Statistics** · **AI Literacy**
>
> Includes a standalone **Admin Dashboard** for user management, subject management, learning analytics, and system configuration.

</div>

<!--
🎬 Demo video embed:
1. Edit this README on GitHub
2. Drag docs/images/demo.mp4 into the editor
3. GitHub will auto-upload and generate a link
4. Replace the placeholder URL below
-->

<div align="center">

📺 **[▶ Watch Demo Video](http://8.148.82.93/)** | Visit the Live Demo for the full experience

</div>

---

## 📑 Table of Contents

- [✨ Key Features](#-key-features)
- [🚀 Quick Start](#-quick-start)
- [🛠️ Tech Stack](#️-tech-stack)
- [📸 Screenshots](#-screenshots)
- [🎓 User Guide](#-user-guide)
- [⚙️ AI Configuration](#️-ai-configuration)
- [📂 Project Structure](#-project-structure)
- [📚 API Overview](#-api-overview)
- [🔧 Development Guide](#-development-guide)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

---

## ✨ Key Features

<table>
<tr>
<td width="50%">

### 🎯 Adaptive Assessment
Quick quizzes generate ability profiles, pinpointing knowledge gaps to create a personalized starting point.

</td>
<td width="50%">

### 🤖 Socratic AI Tutor
Guided teaching over direct answers — combines user memory streams for personalized hints and deep tutoring.

</td>
</tr>
<tr>
<td width="50%">

### 🗺️ Dynamic Knowledge Graph
Interactive visualization of knowledge trees and prerequisite dependencies, clearly mapping subject structures.

</td>
<td width="50%">

### 🧠 User Memory System
Tracks behavior, preferences, and learning patterns across sessions — your AI gets smarter with every interaction.

</td>
</tr>
<tr>
<td width="50%">

### 💻 Interactive Practice Environment
Code display + frontend lightweight execution / backend sandbox execution + diverse question types.

</td>
<td width="50%">

### 📖 Concept Learning Workbench
Streaming content generation with embedded AI Q&A and SVG illustrations for immersive learning.

</td>
</tr>
<tr>
<td width="50%">

### 🛤️ AI Learning Path Planner
AI generates multi-stage personalized study plans with daily tasks — never feel lost again.

</td>
<td width="50%">

### 📊 Ability Radar Chart
Multi-dimensional visualization of learning progress and achievements across all subjects.

</td>
</tr>
</table>

<details>
<summary><b>🔽 More Features</b></summary>

| Module | Description |
|--------|-------------|
| 📚 **Multi-Subject Learning** | Systematic learning paths for core STEM courses |
| 📝 **Smart Question Bank** | AI-generated questions, auto-arranged by difficulty |
| 🏆 **Achievement Tree** | Chapter-level progress visualization and unlocks |
| 💬 **Learning Community** | Posts, likes, comments, and notifications |
| 📐 **Math Lab** | Interactive formula calculator + JSXGraph plotting |
| 🃏 **Flashcard System** | Spaced repetition algorithm-based memory tool |
| 🎲 **GPT-Vis Playground** | Smart chart rendering with @antv/gpt-vis |
| 🧊 **3D Canvas** | Three.js interactive 3D learning scenes |
| 🏢 **Admin Panel** | Standalone Vue 3 management dashboard |

</details>

---

## 🚀 Quick Start

> **Prerequisite**: [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.

### 1️⃣ Clone

```bash
git clone https://github.com/Sakuraxk/a-track.git
cd a-track
```

### 2️⃣ Launch

```powershell
# Windows PowerShell
.\deploy.ps1

# Linux / macOS
chmod +x deploy.sh && ./deploy.sh
```

### 3️⃣ Initialize

```powershell
.\deploy.ps1 -Migrate   # Database migration
.\deploy.ps1 -Seed      # Seed subject data
```

### 🎉 Open Your Browser

| URL | Description |
|-----|-------------|
| `http://localhost` | 🌐 Frontend App |
| `http://localhost/admin/` | 🏢 Admin Panel |
| `http://localhost/docs` | 📖 API Docs (Swagger) |

<details>
<summary><b>🔥 Development Mode (Hot Reload)</b></summary>

| Action | Command |
|--------|---------|
| 🚀 Start dev mode | `.\deploy.ps1 -Dev` |
| 🛑 Stop dev mode | `.\deploy.ps1 -DevDown` |
| 🔨 Production start | `.\deploy.ps1` |
| 🔨 Force rebuild | `.\deploy.ps1 -Build` |
| 📋 View logs | `.\deploy.ps1 -Logs` |
| 🗄️ DB migration | `.\deploy.ps1 -Migrate` |
| 🌱 Seed data | `.\deploy.ps1 -Seed` |
| ⬇️ Stop production | `.\deploy.ps1 -Down` |

</details>

---

## 🛠️ Tech Stack

<table>
<tr>
<td align="center" width="33%">

### Backend

[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)](#)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](#)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](#)
[![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)](#)
[![LangChain](https://img.shields.io/badge/LangChain-1C3C3C?style=for-the-badge&logo=langchain&logoColor=white)](#)

</td>
<td align="center" width="33%">

### Frontend

[![React](https://img.shields.io/badge/React_18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](#)
[![Vite](https://img.shields.io/badge/Vite_5-646CFF?style=for-the-badge&logo=vite&logoColor=white)](#)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](#)
[![Three.js](https://img.shields.io/badge/Three.js-000000?style=for-the-badge&logo=threedotjs&logoColor=white)](#)

</td>
<td align="center" width="33%">

### Admin Panel

[![Vue 3](https://img.shields.io/badge/Vue_3-4FC08D?style=for-the-badge&logo=vuedotjs&logoColor=white)](#)
[![Element Plus](https://img.shields.io/badge/Element_Plus-409EFF?style=for-the-badge&logo=element&logoColor=white)](#)
[![ECharts](https://img.shields.io/badge/ECharts-AA344D?style=for-the-badge&logo=apacheecharts&logoColor=white)](#)

</td>
</tr>
</table>

<div align="center">

[![Docker](https://img.shields.io/badge/Docker-Containerized-2496ED?style=for-the-badge&logo=docker&logoColor=white)](#)

</div>

---

## 📸 Screenshots

<table>
<tr>
<td align="center" width="50%">

**🏠 Learning Home**

<img src="docs/images/feature-dashboard.png" width="100%" />

_Personalized learning starting point with daily recommendations_

</td>
<td align="center" width="50%">

**🤖 Socratic AI Tutor**

<img src="docs/images/feature-ai-tutor.png" width="100%" />

_Guided teaching through thought-provoking questions_

</td>
</tr>
<tr>
<td align="center" width="50%">

**📚 Multi-Subject Management**

<img src="docs/images/feature-subjects.png" width="100%" />

_Freely switch between engineering and theoretical subjects_

</td>
<td align="center" width="50%">

**📝 Smart Question Bank**

<img src="docs/images/feature-question-bank.png" width="100%" />

_AI-composed questions filtered by topic and difficulty_

</td>
</tr>
<tr>
<td align="center" width="50%">

**💬 Learning Community**

<img src="docs/images/feature-community.png" width="100%" />

_Knowledge sharing, discussions, and community interaction_

</td>
<td align="center" width="50%">

**📐 Math Lab**

<img src="docs/images/feature-math-lab.png" width="100%" />

_Interactive function plotting and formula calculation_

</td>
</tr>
</table>

> 💡 **Tip**: Visit the [Live Demo](http://8.148.82.93/) for the full experience.

---

## 🎓 User Guide

```
Sign Up → Choose Subject → Complete Assessment → Get Personalized Plan → Start Learning
```

<details>
<summary><b>📋 Feature Navigation</b></summary>

| Module | Route | Description |
|--------|-------|-------------|
| **Dashboard** | `/app/dashboard` | Cross-subject overview, radar chart, stats |
| **Subjects** | `/app/subjects` | Multi-subject selection and switching |
| **Learning Studio** | `/app/studio/:id` | Concept learning, AI Q&A, practice |
| **AI Learning Path** | `/app/ai-learning-path` | AI-generated personalized study plans |
| **Question Bank** | `/app/question-bank` | AI-composed questions by topic/difficulty |
| **Statistics** | `/app/stats` | Multi-dimensional analytics and reports |
| **Profile** | `/app/profile` | Ability model and learning patterns |
| **Admin Panel** | `/admin/` | User/subject/community management |

</details>

---

## ⚙️ AI Configuration

Edit `backend/config.toml`:

```toml
[llm.system]
api_key = "sk-your-api-key-here"
base_url = "https://api.deepseek.com"
model = "deepseek-v4-flash"
enabled = true
```

Or configure via Web UI at `http://localhost:8010/config`.

---

## 📂 Project Structure

```
a-track/
├── backend/          # FastAPI backend (Python 3.10+)
├── frontend/         # React 18 + TypeScript frontend
├── admin/            # Vue 3 admin dashboard
├── nginx/            # Nginx configuration
├── docs/             # Documentation
├── docker-compose.yml      # Production config
├── docker-compose.dev.yml  # Dev config (hot reload)
├── deploy.ps1 / deploy.sh  # One-click deploy scripts
└── README.md
```

---

## 📚 API Overview

| Prefix | Function | Description |
|--------|----------|-------------|
| `/api/auth` | 🔐 Auth | Register, login, JWT |
| `/api/subjects` | 📘 Subjects | List, chapters, switching |
| `/api/assessment` | 🎯 Assessment | Adaptive quiz generation |
| `/api/practice` | 📝 Practice | Multi-type exercises |
| `/api/question-bank` | 📝 Question Bank | AI question generation |
| `/api/concept-learning` | 📖 Concepts | Streaming content |
| `/api/graph` | 🗺️ Knowledge Graph | Nodes and dependencies |
| `/api/ai-learning-path` | 🛤️ AI Path | Personalized plans |
| `/api/ai-tutor` | 🤖 AI Tutor | Socratic dialogue |
| `/api/community` | 💬 Community | Posts, comments, likes |
| `/api/reporting` | 📈 Reports | Progress analytics |

> Full API docs: `http://localhost:8010/docs`

---

## 🔧 Development Guide

```bash
# Backend tests
cd backend && uv run pytest

# Frontend tests
cd frontend && npm run test:run

# Code formatting
cd backend && uv run black . && uv run isort .
cd frontend && npm run lint
```

---

## 🤝 Contributing

Contributions welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details.

[![Contributors](https://contrib.rocks/image?repo=Sakuraxk/a-track)](https://github.com/Sakuraxk/a-track/graphs/contributors)

---

## ⭐ Star History

If you find this project helpful, please give it a ⭐!

[![Star History Chart](https://api.star-history.com/svg?repos=Sakuraxk/a-track&type=Date)](https://star-history.com/#Sakuraxk/a-track&Date)

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

<div align="center">

**[⬆ Back to Top](#a-track--智辙)**

Made with ❤️ by [A-Track Team](https://github.com/Sakuraxk/a-track)

</div>
