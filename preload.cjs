const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('cpDocuments',Object.freeze({savePdf:data=>ipcRenderer.invoke('cp:save-business-pdf',data)}));
