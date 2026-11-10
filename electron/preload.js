const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // SQLite Database Operations
  dbQuery: (sql, params) => ipcRenderer.invoke('db:query', { sql, params }),
  dbGet: (sql, params) => ipcRenderer.invoke('db:get', { sql, params }),
  dbRun: (sql, params) => ipcRenderer.invoke('db:run', { sql, params }),
  dbExec: (sql) => ipcRenderer.invoke('db:exec', { sql }),

  // Backup & Restore
  createBackup: () => ipcRenderer.invoke('app:create-backup'),
  restoreBackup: () => ipcRenderer.invoke('app:restore-backup'),

  // Print & PDF
  printReport: () => ipcRenderer.invoke('app:print-report'),
  exportPDF: (suggestedName) => ipcRenderer.invoke('app:export-pdf', suggestedName),

  // Image Upload (Logo & Signatures)
  selectAndSaveImage: (category) => ipcRenderer.invoke('app:select-image', category),

  // Platform info
  getAppInfo: () => ipcRenderer.invoke('app:get-info'),
});
