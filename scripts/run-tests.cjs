const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

function collectTestFiles(dir) {
  if (!fs.existsSync(dir)) {
    return []
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectTestFiles(fullPath))
      continue
    }

    if (entry.isFile() && entry.name.endsWith('.test.js')) {
      files.push(fullPath)
    }
  }

  return files.sort()
}

const testRoot = path.resolve(__dirname, '../.tmp-test/dist')
const files = collectTestFiles(testRoot)

if (files.length === 0) {
  console.error('未找到已编译的测试文件')
  process.exit(1)
}

const result = spawnSync(process.execPath, ['--test', ...files], {
  stdio: 'inherit',
})

process.exit(result.status ?? 1)
