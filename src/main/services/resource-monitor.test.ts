import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import { ResourceMonitor } from '@main/services/resource-monitor'

const mocks = vi.hoisted(() => ({
  spawnMock: vi.fn(),
  totalmemMock: vi.fn(),
  freememMock: vi.fn(),
  loadavgMock: vi.fn(),
  cpusMock: vi.fn(),
  warnMock: vi.fn()
}))

vi.mock('node:child_process', () => {
  return {
    spawn: mocks.spawnMock
  }
})

vi.mock('node:os', () => {
  return {
    default: {
      totalmem: mocks.totalmemMock,
      freemem: mocks.freememMock,
      loadavg: mocks.loadavgMock,
      cpus: mocks.cpusMock
    }
  }
})

vi.mock('@main/lib/logger', () => {
  return {
    logger: {
      warn: mocks.warnMock,
      info: vi.fn(),
      debug: vi.fn(),
      error: vi.fn()
    }
  }
})

function createFailingChild(errorMessage = 'command not found'): EventEmitter & {
  stdout: EventEmitter
  stderr: EventEmitter
  kill: () => void
} {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter
    stderr: EventEmitter
    kill: () => void
  }

  child.stdout = new EventEmitter()
  child.stderr = new EventEmitter()
  child.kill = vi.fn()

  queueMicrotask(() => {
    child.emit('error', new Error(errorMessage))
  })

  return child
}

describe('ResourceMonitor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.totalmemMock.mockReturnValue(16 * 1024 * 1024 * 1024)
    mocks.freememMock.mockReturnValue(6 * 1024 * 1024 * 1024)
    mocks.loadavgMock.mockReturnValue([2, 0, 0])
    mocks.cpusMock.mockReturnValue([{ model: 'cpu' }, { model: 'cpu' }, { model: 'cpu' }, { model: 'cpu' }])
    mocks.spawnMock.mockImplementation(() => createFailingChild())
  })

  it('getStats returns RAM values from os module', async () => {
    const monitor = new ResourceMonitor()
    const stats = await monitor.getStats()

    expect(stats.ramTotalMb).toBeCloseTo(16384, 1)
    expect(stats.ramUsedMb).toBeCloseTo(10240, 1)
  })

  it('getStats returns null VRAM values when nvidia-smi is unavailable', async () => {
    const monitor = new ResourceMonitor()
    const stats = await monitor.getStats()

    expect(stats.vramTotalMb).toBeNull()
    expect(stats.vramUsedMb).toBeNull()
  })

  it('getStats never throws when all command probes fail', async () => {
    const monitor = new ResourceMonitor()

    await expect(monitor.getStats()).resolves.toMatchObject({
      ramTotalMb: expect.any(Number),
      ramUsedMb: expect.any(Number),
      vramTotalMb: null,
      vramUsedMb: null,
      cpuPercent: expect.any(Number)
    })
  })
})
