import { app } from 'electron'
import { existsSync, mkdirSync, appendFileSync } from 'fs'
import { join } from 'path'
import { BrowserWindow } from 'electron'
import type { LogEntry, LogCategory, LogLevel } from '@shared/types'

/**
 * Logger class for structured logging to disk and renderer process.
 * - Writes structured JSON to userData/logs/quickl-YYYY-MM-DD.log
 * - Emits quickl:log-entry IPC event on every log
 * - Scrubs sensitive data (API keys, bearer tokens)
 * - Singleton pattern
 */
export class Logger {
  private logsDir: string
  private logBuffer: LogEntry[] = []

  constructor() {
    const userData = app.getPath('userData')
    this.logsDir = join(userData, 'logs')

    // Create logs directory if it doesn't exist
    if (!existsSync(this.logsDir)) {
      mkdirSync(this.logsDir, { recursive: true })
    }
  }

  /**
   * Get today's log file path
   */
  private getLogFilePath(): string {
    const now = new Date()
    const dateStr = now.toISOString().split('T')[0]
    return join(this.logsDir, `quickl-${dateStr}.log`)
  }

  /**
   * Scrub sensitive data from logs
   */
  private scrubSensitiveData(text: string): string {
    // API key pattern: sk-XXXX...
    text = text.replace(/sk-[a-zA-Z0-9]{20,}/g, 'sk-...xxxxx')

    // Bearer token pattern
    text = text.replace(/Bearer [a-zA-Z0-9\-._~+/]+=*/g, 'Bearer ...xxxxx')

    return text
  }

  /**
   * Internal log method
   */
  private log(level: LogLevel, category: LogCategory, message: string,
    payload?: Record<string, unknown>
  ): void {
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      level,
      category,
      message: this.scrubSensitiveData(message),
      payload: payload ? JSON.parse(JSON.stringify(payload)) : null
    }

    // Scrub payload if present
    if (entry.payload) {
      const scrubbed = this.scrubSensitiveData(JSON.stringify(entry.payload))
      entry.payload = JSON.parse(scrubbed)
    }

    // Add to buffer
    this.logBuffer.push(entry)

    // Write to file
    try {
      const logFile = this.getLogFilePath()
      appendFileSync(logFile, JSON.stringify(entry) + '\n', 'utf-8')
    } catch (err) {
      console.error('Failed to write log file:', err)
    }

    // Emit to renderer via IPC
    try {
      const windows = BrowserWindow.getAllWindows()
      windows.forEach((window) => {
        window.webContents.send('quickl:log-entry', entry)
      })
    } catch (err) {
      // Silently fail if no window available
    }
  }

  public debug(
    category: LogCategory,
    message: string,
    payload?: Record<string, unknown>
  ): void {
    this.log('debug', category, message, payload)
  }

  public info(
    category: LogCategory,
    message: string,
    payload?: Record<string, unknown>
  ): void {
    this.log('info', category, message, payload)
  }

  public warn(
    category: LogCategory,
    message: string,
    payload?: Record<string, unknown>
  ): void {
    this.log('warn', category, message, payload)
  }

  public error(
    category: LogCategory,
    message: string,
    payload?: Record<string, unknown>
  ): void {
    this.log('error', category, message, payload)
  }

  /**
   * Get all buffered log entries
   */
  public getBuffer(): LogEntry[] {
    return this.logBuffer
  }

  /**
   * Clear the in-memory buffer
   */
  public clearBuffer(): void {
    this.logBuffer = []
  }
}

// Singleton instance
export const logger = new Logger()
