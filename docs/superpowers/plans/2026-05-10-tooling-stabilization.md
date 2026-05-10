# Tooling Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复当前工程的类型检查、测试入口与基础文档，使项目具备可验证的本地运行链路。

**Architecture:** 保持现有 Electron + React + TypeScript 结构不变，只补齐编译目标、全局类型声明、测试编译配置与最小运行时适配。测试继续复用现有 `node:test` 用例，通过单独的测试编译产物在 Node 环境执行。

**Tech Stack:** Electron 33、electron-vite、React 18、TypeScript 5、Node `node:test`

---

### Task 1: 补齐编译与测试配置

**Files:**
- Modify: `package.json`
- Modify: `tsconfig.node.json`
- Modify: `tsconfig.web.json`
- Create: `tsconfig.test.json`
- Create: `scripts/run-tests.cjs`

- [ ] **Step 1: 先让 `tsc -b` 失败点固定下来**

Run: `npx tsc -b`
Expected: 现有类型错误稳定复现，作为修复前基线。

- [ ] **Step 2: 为 node / web 编译目标补齐 `target`、`lib`、`types`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "types": ["node"]
  }
}
```

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client"]
  }
}
```

- [ ] **Step 3: 新增专用测试编译配置**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "types": ["node"],
    "outDir": ".tmp-test/dist"
  }
}
```

- [ ] **Step 4: 新增测试执行脚本**

```js
const files = collectTestFiles('.tmp-test/dist')
spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' })
```

- [ ] **Step 5: 在 `package.json` 中接入 `typecheck` 与 `test`**

```json
{
  "scripts": {
    "typecheck": "npx tsc -b",
    "test": "node -e \"require('fs').rmSync('.tmp-test/dist',{ recursive: true, force: true })\" && npx tsc -p tsconfig.test.json && node scripts/run-tests.cjs"
  }
}
```

### Task 2: 修复类型错误与测试运行时接缝

**Files:**
- Create: `src/types/sqljs.d.ts`
- Modify: `src/main/db.ts`
- Modify: `src/main/ipc.ts`
- Modify: `src/main/luoguAuth.ts`
- Modify: `src/main/scraper.ts`
- Modify: `src/preload/index.d.ts`
- Modify: `src/renderer/src/components/NoteEditor.tsx`

- [ ] **Step 1: 为 `sql.js` 写最小声明，覆盖当前真实用法**

```ts
declare module 'sql.js' {
  export type BindParams = Array<string | number | boolean | null | Uint8Array>
  export interface Database { /* 当前项目实际用到的方法 */ }
}
```

- [ ] **Step 2: 先修 `db.ts` / `ipc.ts` 的 `unknown` 数据收窄**

```ts
return rows.map((row) => ({
  id: Number(row.id),
  name: String(row.name ?? ''),
}))
```

- [ ] **Step 3: 把纯函数测试依赖的 Electron 顶层导入改成惰性获取**

```ts
function getElectronNet() {
  return require('electron') as typeof import('electron')
}
```

- [ ] **Step 4: 修复 `window.api` 声明与 Milkdown 类型错误**

```ts
declare global {
  interface Window {
    api: LuoguTrackerAPI
  }
}

ctx.set(trailingConfig.key, {
  shouldAppend: () => false,
  getNode: (state: EditorState) => state.schema.nodes.paragraph!.create(),
})
```

- [ ] **Step 5: 运行 `npx tsc -b`，确认所有类型错误清零**

Run: `npx tsc -b`
Expected: exit code 0，无类型错误输出。

### Task 3: 补基础说明文档并完成整体验证

**Files:**
- Create: `README.md`

- [ ] **Step 1: 编写最小可用 README**

```md
# luogu-tracker

## 开发
- `npm install`
- `npm run dev`
- `npm run build`
- `npm test`
```

- [ ] **Step 2: 运行测试**

Run: `npm test`
Expected: 现有 3 个测试全部通过。

- [ ] **Step 3: 运行构建**

Run: `npm run build`
Expected: main / preload / renderer 均成功构建。

- [ ] **Step 4: 启动 Electron 烟雾验证**

Run: `.\node_modules\.bin\electron.cmd .`
Expected: 成功拉起“洛谷题单管理”窗口，启动阶段无崩溃。
