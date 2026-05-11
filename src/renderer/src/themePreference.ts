export type ThemeMode = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'luogu-tracker.theme'

export function sanitizeThemePreference(value: string | null | undefined): ThemeMode | null {
  if (value === 'light' || value === 'dark') {
    return value
  }
  return null
}

export function resolveInitialTheme(
  savedTheme: string | null | undefined,
  prefersDark: boolean,
): ThemeMode {
  return sanitizeThemePreference(savedTheme) ?? (prefersDark ? 'dark' : 'light')
}
