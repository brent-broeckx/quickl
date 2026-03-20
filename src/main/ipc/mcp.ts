import { ipcMain } from 'electron'
import type { AddMCPInput, MCPCatalogEntry, MCPServer, MCPTool } from '@shared/types'

export function registerMCPHandlers(): void {
  ipcMain.handle('mcp:list', async (): Promise<MCPServer[]> => {
    return []
  })

  ipcMain.handle('mcp:catalog', async (): Promise<MCPCatalogEntry[]> => {
    return []
  })

  ipcMain.handle('mcp:add', async (_e, config: AddMCPInput): Promise<MCPServer> => {
    return {
      id: 'stub',
      name: 'Stub',
      transport: 'stdio',
      command: '',
      args: [],
      status: 'stopped',
      pid: null,
      exposedTools: [],
      autoStart: false,
      ...config
    }
  })

  ipcMain.handle('mcp:remove', async (): Promise<void> => {
    // TODO: Implement MCP server removal in Phase 5.
  })

  ipcMain.handle('mcp:start', async (): Promise<void> => {
    // TODO: Implement MCP process startup in Phase 5.
  })

  ipcMain.handle('mcp:stop', async (): Promise<void> => {
    // TODO: Implement MCP process shutdown in Phase 5.
  })

  ipcMain.handle('mcp:list-tools', async (): Promise<MCPTool[]> => {
    return []
  })
}
