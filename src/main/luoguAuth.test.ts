import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isNeedLogin,
  parseUserInfo,
  extractUid,
  buildCookieRemovalUrl,
  shouldAutoCloseLoginWindow
} from './luoguAuth'

test('needLogin=1 时判定未登录', () => {
  const html = `<script id="lentille-context" type="application/json">{"data":{"errorData":{"needLogin":1}}}</script>`
  assert.equal(isNeedLogin(html), true)
})

test('errorCode=401 时判定未登录', () => {
  const html = `<script id="lentille-context" type="application/json">{"data":{"errorCode":401}}</script>`
  assert.equal(isNeedLogin(html), true)
})

test('正常页面不判定为未登录', () => {
  const html = `<script id="lentille-context" type="application/json">{"data":{"user":{"name":"test"}}}</script>`
  assert.equal(isNeedLogin(html), false)
})

test('无 lentille-context 时不判定为未登录', () => {
  assert.equal(isNeedLogin('<html></html>'), false)
})

test('解析用户信息（昵称和头像）', () => {
  const html = `<script id="lentille-context" type="application/json">{"data":{"user":{"uid":123,"name":"测试用户","avatar":"https://example.com/avatar.png"}}}</script>`
  const info = parseUserInfo(html)
  assert.ok(info)
  assert.equal(info!.nickname, '测试用户')
  assert.equal(info!.avatar, 'https://example.com/avatar.png')
})

test('无用户数据时返回 null', () => {
  const html = `<script id="lentille-context" type="application/json">{"data":{}}</script>`
  assert.equal(parseUserInfo(html), null)
})

test('从 cookies 中提取 _uid', () => {
  const uid = extractUid([
    { name: '__client_id', value: 'abc' },
    { name: '_uid', value: '1447771' }
  ])
  assert.equal(uid, '1447771')
})

test('构造 Cookie 删除 URL 时保留协议、域名和路径', () => {
  const url = buildCookieRemovalUrl({
    secure: true,
    domain: '.www.luogu.com.cn',
    path: '/training'
  })
  assert.equal(url, 'https://www.luogu.com.cn/training')
})

test('首次登录成功后自动关闭登录窗口', () => {
  assert.equal(shouldAutoCloseLoginWindow(null, '1447771'), true)
})

test('已登录用户重新打开登录窗口时，不因相同 uid 自动关闭', () => {
  assert.equal(shouldAutoCloseLoginWindow('1447771', '1447771'), false)
})

test('切换到新账号后自动关闭登录窗口', () => {
  assert.equal(shouldAutoCloseLoginWindow('1447771', '2000000'), true)
})
