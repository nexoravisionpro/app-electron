const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron')
const path = require('node:path')
const fs = require('node:fs/promises')
const {pathToFileURL} = require('node:url')
const {createBusinessPDF} = require('./business-pdf.cjs')
let savingBusinessPDF=false
ipcMain.handle('cp:save-business-pdf',async(event,data)=>{
  const trusted=pathToFileURL(path.join(__dirname,'Facture01.html')).href
  if(event.senderFrame!==event.sender.mainFrame||event.senderFrame.url.split('#')[0]!==trusted)return {error:'Origen de documento no autorizado'}
  if(savingBusinessPDF)return {error:'Ya hay un documento en proceso'}
  savingBusinessPDF=true
  try{
    const pdf=await createBusinessPDF(data)
    const filename=data.kind==='quote'?'Cotizacion-'+String(data.quote?.id||'').replace(/[^a-zA-Z0-9-]/g,'').slice(0,40)+'.pdf':'Reporte_CorePoint.pdf'
    const result=await dialog.showSaveDialog(BrowserWindow.fromWebContents(event.sender),{title:'Guardar documento de Core Point',defaultPath:filename,filters:[{name:'PDF',extensions:['pdf']}]})
    if(result.canceled||!result.filePath)return {cancelled:true}
    await fs.writeFile(result.filePath,pdf)
    return {saved:true}
  }catch(error){console.error('No se pudo generar el documento:',error.message);return {error:'No se pudo guardar el PDF. Revisa los datos y la carpeta de destino.'}}
  finally{savingBusinessPDF=false}
})

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname,'preload.cjs'),
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
