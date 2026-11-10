const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const dbManager = require('./db');

let mainWindow = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 1100,
    minHeight: 700,
    title: 'Acharya Pathology — Silwani',
    backgroundColor: '#f8fafc',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  });

  mainWindow.maximize();
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Remove default menu bar for a clean, professional application look
  mainWindow.setMenuBarVisibility(false);

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    const indexPath = path.join(__dirname, '../dist/index.html');
    await mainWindow.loadFile(indexPath);
  }
}

// App lifecycle
app.whenReady().then(async () => {
  try {
    const userDataPath = app.getPath('userData');
    console.log('App userData path:', userDataPath);
    await dbManager.init(userDataPath);
  } catch (err) {
    console.error('Failed to initialize database on startup:', err);
  }

  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  dbManager.close();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function registerIpcHandlers() {
  // SQLite queries
  ipcMain.handle('db:query', async (event, { sql, params }) => {
    return dbManager.query(sql, params);
  });

  ipcMain.handle('db:get', async (event, { sql, params }) => {
    return dbManager.get(sql, params);
  });

  ipcMain.handle('db:run', async (event, { sql, params }) => {
    return dbManager.run(sql, params);
  });

  ipcMain.handle('db:exec', async (event, { sql }) => {
    return dbManager.exec(sql);
  });

  // Backup: Save dialog
  ipcMain.handle('app:create-backup', async () => {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
    const defaultName = `Acharya_Pathology_Backup_${dateStr}_${timeStr}.db`;

    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Database Backup',
      defaultPath: defaultName,
      filters: [
        { name: 'SQLite Database (*.db)', extensions: ['db', 'sqlite'] },
        { name: 'All Files (*.*)', extensions: ['*'] }
      ]
    });

    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }

    return dbManager.exportBackup(result.filePath);
  });

  // Restore: Open dialog
  ipcMain.handle('app:restore-backup', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Backup Database to Restore',
      properties: ['openFile'],
      filters: [
        { name: 'SQLite Database (*.db, *.sqlite)', extensions: ['db', 'sqlite'] },
        { name: 'All Files (*.*)', extensions: ['*'] }
      ]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }

    const filePath = result.filePaths[0];
    return await dbManager.restoreBackup(filePath);
  });

  // Print Report
  ipcMain.handle('app:print-report', async () => {
    if (!mainWindow) return { success: false, error: 'No active window' };
    try {
      mainWindow.webContents.print({
        silent: false,
        printBackground: true,
        margins: { marginType: 'none' },
        pageSize: 'A4'
      }, (success, failureReason) => {
        if (!success) console.warn('Print canceled or failed:', failureReason);
      });
      return { success: true };
    } catch (err) {
      console.error('Print error:', err);
      return { success: false, error: err.message };
    }
  });

  // Export to PDF
  ipcMain.handle('app:export-pdf', async (event, suggestedName = 'Acharya_Report.pdf') => {
    if (!mainWindow) return { success: false, error: 'No active window' };
    try {
      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Save Report as PDF',
        defaultPath: suggestedName,
        filters: [{ name: 'PDF Document (*.pdf)', extensions: ['pdf'] }]
      });

      if (result.canceled || !result.filePath) {
        return { canceled: true };
      }

      const pdfData = await mainWindow.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
        margins: { marginType: 'none' }
      });

      fs.writeFileSync(result.filePath, pdfData);
      return { success: true, filePath: result.filePath };
    } catch (err) {
      console.error('Export PDF error:', err);
      return { success: false, error: err.message };
    }
  });

  // Select Image (Logo or Signature) and return Base64 Data URL for zero-dependency offline rendering
  ipcMain.handle('app:select-image', async (event, category) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: `Select ${category === 'logo' ? 'Pathology Logo' : 'Signatory Signature'} Image`,
      properties: ['openFile'],
      filters: [
        { name: 'Image Files (*.png, *.jpg, *.jpeg, *.webp)', extensions: ['png', 'jpg', 'jpeg', 'webp'] }
      ]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }

    const filePath = result.filePaths[0];
    const ext = path.extname(filePath).toLowerCase().replace('.', '');
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    const fileBuffer = fs.readFileSync(filePath);
    const base64 = fileBuffer.toString('base64');
    const dataUrl = `data:${mime};base64,${base64}`;

    return { success: true, dataUrl };
  });

  // Info
  ipcMain.handle('app:get-info', () => {
    return {
      appName: 'Acharya Pathology',
      version: app.getVersion(),
      userDataPath: app.getPath('userData'),
      isDev
    };
  });
}
