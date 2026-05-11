import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveInitialTheme, sanitizeThemePreference } from './themePreference'

test('优先使用已保存的合法主题', () => {
  assert.equal(resolveInitialTheme('dark', false), 'dark')
  assert.equal(resolveInitialTheme('light', true), 'light')
})

test('已保存主题非法时回退到系统主题', () => {
  assert.equal(resolveInitialTheme('system', true), 'dark')
  assert.equal(resolveInitialTheme('unknown', false), 'light')
})

test('sanitizeThemePreference 仅接受 light 和 dark', () => {
  assert.equal(sanitizeThemePreference('light'), 'light')
  assert.equal(sanitizeThemePreference('dark'), 'dark')
  assert.equal(sanitizeThemePreference(''), null)
  assert.equal(sanitizeThemePreference('system'), null)
})
