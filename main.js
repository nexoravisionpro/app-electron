const { app, BrowserWindow, shell } = require('electron')
const path = require('node:path')

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true
    }
  })
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url === 'https://nexora-server-2uub.onrender.com/telegram') {
      shell.openExternal(url).catch(() => {})
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })
  win.loadFile(path.join(__dirname, 'Facture01.html'))
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})


app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
