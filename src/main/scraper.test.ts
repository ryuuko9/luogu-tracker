import test from 'node:test'
import assert from 'node:assert/strict'

import { parseTrainingId, extractTrainingPayload } from './scraper'

test('应正确解析数字 ID 与标准题单链接', () => {
  assert.equal(parseTrainingId('100'), 100)
  assert.equal(parseTrainingId(' https://www.luogu.com.cn/training/100 '), 100)
  assert.equal(parseTrainingId('https://www.luogu.com.cn/training/100#problems'), 100)
})

test('应兼容 luogu.com 域名的题单链接', () => {
  assert.equal(parseTrainingId('https://www.luogu.com/training/100'), 100)
})

test('应兼容带 trainingId 查询参数的题单链接', () => {
  assert.equal(parseTrainingId('https://www.luogu.com.cn/training/list?trainingId=100'), 100)
})

test('应从正常页面上下文中提取 training 数据', () => {
  const payload = extractTrainingPayload({
    data: {
      training: {
        id: 100,
        name: '题单',
        description: '描述',
        problems: [],
        problemCount: 0
      }
    }
  }, 100, false)

  assert.equal(payload.id, 100)
  assert.equal(payload.name, '题单')
})

test('未登录状态导入受限题单时提示先登录', () => {
  assert.throws(
    () => extractTrainingPayload({
      template: 'error',
      data: {
        errorCode: 401,
        errorMessage: '请先登录',
        errorData: { needLogin: 1 }
      }
    }, 465333, false),
    /请先登录洛谷/
  )
})

test('已登录但会话失效时提示重新登录', () => {
  assert.throws(
    () => extractTrainingPayload({
      template: 'error',
      data: {
        errorCode: 401,
        errorMessage: '请先登录',
        errorData: { needLogin: 1 }
      }
    }, 465333, true),
    /登录状态已失效/
  )
})
