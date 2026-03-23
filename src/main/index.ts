import { app, BrowserWindow } from 'electron'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { store } from '@main/lib/store'
import { logger } from '@main/lib/logger'
import { setupIPCHandlers } from '@main/ipc'
import { healthPoller } from '@main/services/health-poller'
import { daemonManager } from '@main/services/daemon-manager'
import { proxyService } from '@main/proxy/proxy.service'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

let mainWindow: BrowserWindow | null = null

/**
 * Create the main application window
 */
function createWindow(): void {
  // Get saved window state or use defaults
  const savedWindowState = store.get('windowState', {
    width: 1200,
    height: 800
  })

  mainWindow = new BrowserWindow({
    width: savedWindowState.width,
    height: savedWindowState.height,
    x: savedWindowState.x,
    y: savedWindowState.y,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : undefined,
    trafficLightPosition: process.platform === 'darwin' ? { x: 14, y: 16 } : undefined,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true
    },
    icon:
      process.platform === 'darwin'
        ? join(__dirname, '../../assets/icon.icns')
        : join(__dirname, '../../assets/icon.png'),
    show: false
  })

  // macOS: Setup custom traffic light buttons for frameless window
  if (process.platform === 'darwin') {
    mainWindow.setWindowButtonVisibility(true)
  }

  // Load the app
  const devServerUrl = process.env.ELECTRON_RENDERER_URL
  const isDev = !app.isPackaged && !!devServerUrl
  const url = isDev
    ? devServerUrl
    : `file://${join(__dirname, '../renderer/index.html')}`

  mainWindow.loadURL(url)

  // Show window after content is loaded
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  // Save window state on close
  mainWindow.on('close', () => {
    if (mainWindow) {
      const bounds = mainWindow.getBounds()
      store.set('windowState', {
        width: bounds.width,
        height: bounds.height,
        x: bounds.x,
        y: bounds.y
      })
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Open DevTools in development
  if (isDev) {
    mainWindow.webContents.openDevTools()
  }
}

/**
 * App lifecycle
 */
app.on('ready', async () => {
  logger.info('system', 'Application starting', { version: app.getVersion() })

  // Setup IPC handlers
  setupIPCHandlers()

  // Start background provider health polling.
  healthPoller.start()

  try {
    await proxyService.start()
  } catch (error) {
    logger.error('proxy', 'Failed to start proxy services', {
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }

  // Create window
  createWindow()
})

app.on('window-all-closed', () => {
  // On macOS, applications typically stay open until user quits explicitly
  if (process.platform !== 'darwin') {
    healthPoller.stop()
    app.quit()
  }
})

app.on('before-quit', () => {
  healthPoller.stop()
  void proxyService.stop()
  daemonManager.stopManagedOllama()
})

app.on('activate', () => {
  // Re-create window when app is activated (macOS)
  if (mainWindow === null) {
    createWindow()
  }
})

// Security: Disable navigation to external sites
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl)

    // Allow only same-origin navigation in development
    if (parsedUrl.origin !== 'http://localhost:5173') {
      event.preventDefault()
    }
  })

  // Disable opening new windows
  contents.setWindowOpenHandler(() => {
    return { action: 'deny' }
  })
})

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}
