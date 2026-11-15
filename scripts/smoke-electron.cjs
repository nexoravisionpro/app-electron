const {app}=require('electron'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const root=path.resolve(__dirname,'..'),archive=fs.readFileSync(path.join(root,'packaged-app-path.txt'),'utf8').trim();
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'corepoint-ci-')));app.disableHardwareAcceleration();
let ended=false;const errors=[];
function finish(code,info){if(ended)return;ended=true;console.log(JSON.stringify(info));app.exit(code)}
setTimeout(()=>finish(1,{error:'Tiempo de arranque excedido'}),60000).unref();
app.on('browser-window-created',(_,win)=>{
 win.hide();
 win.webContents.on('render-process-gone',(_,details)=>finish(1,{error:'Renderer terminó',reason:details.reason}));
 win.webContents.on('console-message',(event,_level,message)=>{const text=event.message||message||'';if(/Uncaught|SyntaxError|ReferenceError|TypeError/.test(text))errors.push(text)});
 win.webContents.once('did-finish-load',async()=>{
  try{
   await new Promise(resolve=>setTimeout(resolve,1500));
   const state=await win.webContents.executeJavaScript(`({telegram:!!document.getElementById('cp-open-telegram'),crm:typeof window.cpLoadCRM==='function',sessionReset:typeof window.cpResetCRM==='function',auth:typeof window.sb?.auth?.signInWithPassword==='function',login:!!document.getElementById('login-overlay'),calls:!!document.getElementById('crm-call-form'),campaigns:!!document.getElementById('crm-campaign-form'),unauthenticated:!window._currentUserId,employeeDetails:!!document.getElementById('ops-emp-code'),quoteItems:!!document.getElementById('ops-cot-lines'),appointmentCalendar:!!document.getElementById('ops-calendar'),expensePayments:!!document.getElementById('ops-gasto-state'),reportFilters:!!document.getElementById('ops-report-from'),pdfBridge:typeof window.cpDocuments?.savePdf==='function'})`);
   if(errors.length||Object.values(state).some(v=>!v))return finish(1,{error:'Falló el arranque del paquete',state,errors});
   const pdf=await require(path.join(archive,'business-pdf.cjs')).createBusinessPDF({kind:'quote',business:{name:'Prueba de empaquetado'},quote:{id:'QA',cliente:'Cliente de prueba',concepto:'Prueba local sin cobro',monto:116,details:{items:[{description:'Servicio',qty:1,price:100}],discount:0,tax:16}}});
   if(!pdf.subarray(0,4).equals(Buffer.from('%PDF')))throw Error('El PDF empaquetado no es válido');
   const report={startupPassed:true,state,pdfGenerated:true,pdfBytes:pdf.length,scope:'Arranque y generación de PDF desde el código empaquetado; sin iniciar sesión ni operaciones comerciales'};
   fs.writeFileSync(path.join(root,'dist','arranque-'+process.platform+'-'+process.arch+'.json'),JSON.stringify(report,null,2));finish(0,report);
  }catch(error){finish(1,{error:String(error)})}
 });
});
require(path.join(archive,'main.js'));
