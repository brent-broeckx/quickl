import Store from 'electron-store'
import type {
  Provider,
  LocalModel,
  IDE,
  MCPServer,
  Profile
} from '@shared/types'

/**
 * Schema for electron-store with strict typing and defaults
 */
interface StoreSchema {
  providers: Provider[]
  models: LocalModel[]
  ides: IDE[]
  mcpServers: MCPServer[]
  profiles: Profile[]
  settings: {
    theme: 'light' | 'dark' | 'system'
    startAtLogin: boolean
    startMinimized: boolean
    healthCheckIntervalSeconds: number
    proxy: {
      providerPort: number
      mcpPort: number
    }
    notifications: {
      providerOffline: boolean
      mcpCrash: boolean
      guardrailViolation: boolean
    }
  }
  windowState: {
    width: number
    height: number
    x?: number
    y?: number
  }
  onboarding: {
    completed: boolean
  }
}

const defaultStore: StoreSchema = {
  providers: [],
  models: [],
  ides: [],
  mcpServers: [],
  profiles: [],
  settings: {
    theme: 'system',
    startAtLogin: false,
    startMinimized: false,
    healthCheckIntervalSeconds: 30,
    proxy: {
      providerPort: 3820,
      mcpPort: 3821
    },
    notifications: {
      providerOffline: true,
      mcpCrash: true,
      guardrailViolation: true
    }
  },
  windowState: {
    width: 1200,
    height: 800,
    x: undefined,
    y: undefined
  },
  onboarding: {
    completed: false
  }
}

/**
 * Create and export the electron-store instance
 */
export const store = new Store<StoreSchema>({
  defaults: defaultStore,
  schema: {
    providers: {
      type: 'array',
      default: []
    },
    models: {
      type: 'array',
      default: []
    },
    ides: {
      type: 'array',
      default: []
    },
    mcpServers: {
      type: 'array',
      default: []
    },
    profiles: {
      type: 'array',
      default: []
    },
    settings: {
      type: 'object',
      properties: {
        theme: { type: 'string', enum: ['light', 'dark', 'system'] },
        startAtLogin: { type: 'boolean' },
        startMinimized: { type: 'boolean' },
        healthCheckIntervalSeconds: { type: 'number' },
        proxy: {
          type: 'object',
          properties: {
            providerPort: { type: 'number' },
            mcpPort: { type: 'number' }
          }
        },
        notifications: {
          type: 'object',
          properties: {
            providerOffline: { type: 'boolean' },
            mcpCrash: { type: 'boolean' },
            guardrailViolation: { type: 'boolean' }
          }
        }
      }
    },
    windowState: {
      type: 'object',
      properties: {
        width: { type: 'number' },
        height: { type: 'number' },
        x: { type: ['number', 'null'] },
        y: { type: ['number', 'null'] }
      }
    },
    onboarding: {
      type: 'object',
      properties: {
        completed: { type: 'boolean' }
      }
    }
  }
})

export type { StoreSchema }
