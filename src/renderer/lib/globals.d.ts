import type { QuicklBridge } from '@shared/types'

declare global {
  interface Window {
    quickl: QuicklBridge
    quicklTheme: {
      getTheme: () => Promise<'light' | 'dark' | 'system'>
      setTheme: (theme: 'light' | 'dark' | 'system') => Promise<void>
    }
  }
}

export {}
