# Luogu Session Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为应用增加洛谷会话登录窗口、持久登录状态与基于头像的登录展示。

**Architecture:** 主进程创建 `persist:luogu-auth` 持久会话与单独登录窗口，登录成功后通过会话抓取受限题单，并在前端展示头像和登录管理弹窗。旧的手动 Cookie 方案从用户界面与 IPC 链路中移除。

**Tech Stack:** Electron、React、TypeScript、sql.js、node:test

---

### Task 1: 主进程登录状态解析测试

**Files:**
- Create: `D:\ryuuko\ACM-Template\CF_notebook\luogu-tracker\src\main\luoguAuth.test.ts`
- Create: `D:\ryuuko\ACM-Template\CF_notebook\luogu-tracker\src\main\luoguAuth.ts`

- [ ] 写登录错误和用户头像解析失败测试
- [ ] 运行测试确认先失败
- [ ] 写最小解析实现让测试通过
- [ ] 再跑测试确认通过

### Task 2: 主进程持久会话与登录窗口

**Files:**
- Modify: `D:\ryuuko\ACM-Template\CF_notebook\luogu-tracker\src\main\index.ts`
- Modify: `D:\ryuuko\ACM-Template\CF_notebook\luogu-tracker\src\main\ipc.ts`
- Modify: `D:\ryuuko\ACM-Template\CF_notebook\luogu-tracker\src\main\scraper.ts`
- Modify: `D:\ryuuko\ACM-Template\CF_notebook\luogu-tracker\src\preload\index.ts`
- Modify: `D:\ryuuko\ACM-Template\CF_notebook\luogu-tracker\src\main\luoguAuth.ts`

- [ ] 新增 `persist:luogu-auth` 会话与登录窗口逻辑
- [ ] 新增 `get/login/logout` IPC
- [ ] `scrapeTraining` 支持复用登录 session
- [ ] 删除旧的手动 Cookie IPC
- [ ] 构建验证

### Task 3: 前端头像状态与登录管理

**Files:**
- Modify: `D:\ryuuko\ACM-Template\CF_notebook\luogu-tracker\src\renderer\src\types.ts`
- Modify: `D:\ryuuko\ACM-Template\CF_notebook\luogu-tracker\src\renderer\src\hooks\useApi.ts`
- Modify: `D:\ryuuko\ACM-Template\CF_notebook\luogu-tracker\src\renderer\src\App.tsx`
- Modify: `D:\ryuuko\ACM-Template\CF_notebook\luogu-tracker\src\renderer\src\components\Sidebar.tsx`
- Modify: `D:\ryuuko\ACM-Template\CF_notebook\luogu-tracker\src\renderer\src\App.css`

- [ ] 增加登录状态类型与 API
- [ ] 侧边栏显示登录按钮或头像
- [ ] 点击头像打开管理弹窗
- [ ] 支持重新登录与退出登录
- [ ] 移除旧 Cookie 弹窗

### Task 4: 回归验证

**Files:**
- No file changes

- [ ] `npm run build`
- [ ] `node --test .tmp-test/*.test.js` 中相关测试通过
- [ ] 手动验证登录、持久化、导入受限题单、退出登录

