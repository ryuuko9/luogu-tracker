# luogu-tracker

用于管理洛谷中的 Codeforces 来源题单进度，帮助快速判断题目是否完成，基于 Electron、React 和 TypeScript。

## 项目背景

部分洛谷中的 CF 题单在日常刷题时，不容易快速判断“这道来源于 Codeforces 的题我以前到底做没做过”。  
这个项目的核心目标，就是把题单、完成状态和个人笔记放到本地统一管理，减少重复判断和重复开题。

## 当前能力

- 导入洛谷题单
- 在本地保存题单与题目列表
- 标记题目完成状态
- 查看题单完成进度
- 为题目记录 Markdown 笔记
- 通过独立登录窗口接入洛谷账号会话，支持访问需要登录的题单

## 技术栈

- Electron
- React
- TypeScript
- `sql.js`

## 环境要求

- Node.js 20 及以上
- npm 10 及以上

## 安装依赖

```bash
npm install
```

## 开发运行

```bash
npm run dev
```

这会启动 Electron 开发环境。

## 构建

```bash
npm run build
```

构建产物会输出到 `out/` 目录。

## 类型检查

```bash
npm run typecheck
```

## 测试

```bash
npm test
```

当前测试会先把现有 `node:test` 用例编译到临时目录，再在 Node 环境中执行。

## 数据目录

应用运行时会在项目根目录下创建 `.userdata/` 目录，用来保存：

- 本地数据库
- 登录会话数据
- Electron 本地状态文件

如果你迁移项目目录或同时运行多个副本，请注意：不同副本会各自维护自己的 `.userdata/` 数据目录。

## 目录说明

- `src/main/`：Electron 主进程、数据库、抓取与登录逻辑
- `src/preload/`：预加载层，向渲染进程暴露安全 API
- `src/renderer/`：React 界面
- `scripts/`：辅助脚本

## 当前状态

当前工程已经通过以下验证：

- `npm run typecheck`
- `npm test`
- `npm run build`
- Electron 启动烟雾检查
