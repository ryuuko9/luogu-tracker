# luogu-tracker

洛谷题单刷题进度管理工具，基于 Electron、React 和 TypeScript。

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

构建产物会输出到 [out](/D:/ryuuko/ACM-Template/luogu-tracker/out) 目录。

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

应用运行时会在项目根目录下创建 [.userdata](/D:/ryuuko/ACM-Template/luogu-tracker/.userdata) 目录，保存本地数据库和会话数据。

## 当前能力

- 导入洛谷题单
- 查看题目列表与完成进度
- 记录题目笔记
- 通过独立登录窗口接入洛谷账号会话
