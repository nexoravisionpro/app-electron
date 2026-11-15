'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
// Solo lo ejecuta CI en un perfil temporal. No inicia sesión ni escribe en Supabase.
async function checkNavigation(win,out){
 await win.webContents.executeJavaScript(`(()=>{
  const u='00000000-0000-4000-8000-000000000001',now=new Date().toISOString(),day=fechaLocalNomina(new Date());
  const owned=r=>({user_id:u,created_at:now,...r});
  const sale=owned({id:'qa-sale',legacy_ticket_id:'1',customer_name:'Cliente de prueba',phone:'',concept:'Venta de prueba',total:500,refunded_total:0,status:'completed',payment_method:'Transferencia'});
  const expense=owned({id:'qa-expense',descripcion:'Servicio de prueba',categoria:'Servicios',monto:100,proveedor:'Proveedor de prueba',fecha:day,details:{paymentStatus:'Pagado',paidOn:day,method:'Transferencia'}});
  const appointment=owned({id:'qa-appointment',titulo:'Cita de prueba',cliente:'Cliente de prueba',fecha:day,hora:'12:00',prioridad:'normal',hecho:false,details:{status:'confirmada',responsable:'Equipo de prueba',duracion:30}});
  const ticket=owned({id:1,cliente:'Cliente de prueba',concepto:'Venta de prueba',monto:500,telefono:''});
  const rows={
   cp_business_suppliers:[owned({id:'qa-supplier',name:'Proveedor de prueba',contact:'Equipo de compras',phone:'',email:'',rfc:'',address:'Domicilio de prueba',terms:'Pago contra entrega',active:true,revision:0})],
   cp_purchase_orders:[owned({id:'qa-order',supplier_id:'qa-supplier',warehouse_id:'qa-warehouse',supplier_name:'Proveedor de prueba',reference:'OC-QA',expected_on:day,items:[{product_id:1,description:'Producto de prueba',quantity:2,unit_cost:100}],subtotal:200,discount:0,tax:16,total:232,status:'ordenada',revision:1})],
   cp_finance_accounts:[owned({id:'qa-receivable',kind:'cobrar',party:'Cliente de prueba',concept:'Saldo de prueba',reference:'QA-001',phone:'',amount:200,due_on:day,status:'abierta'}),owned({id:'qa-payable',kind:'pagar',party:'Proveedor de prueba',concept:'Pago de prueba',reference:'QA-002',phone:'',amount:232,due_on:day,status:'abierta'})],
   cp_finance_payments:[],cp_service_cases:[owned({id:'qa-case',subject:'Seguimiento de prueba',customer:'Cliente de prueba',category:'Soporte',priority:'alta',status:'abierto',owner_name:'Equipo de prueba',due_on:day,description:'Caso de muestra exclusivo de la compilación',resolution:''})],
   cp_case_events:[],cp_business_goals:[owned({id:'qa-goal',month:day.slice(0,7)+'-01',sales_goal:1000,expense_budget:400,notes:'Meta de prueba'})],
   cp_business_events:[owned({id:'qa-event',action:'supplier.save',entity_id:'qa-supplier',summary:'Cuenta de prueba · supplier.save'})],
   cp_sales:[sale],tickets:[ticket],productos:[owned({id:1,nombre:'[QA] Producto de prueba (5 piezas) {costo:100.00} {min:8}',precio:150})],
   almacenes:[owned({id:'qa-warehouse',nombre:'Almacén de prueba',activo:true})],producto_existencias:[owned({id:'qa-stock',producto_id:1,almacen_id:'qa-warehouse',cantidad:5})],
   producto_stock_config:[owned({id:'qa-stock-config',producto_id:1,stock_minimo:8,stock_maximo:12,punto_reorden:8,stock_seguridad:2})],gastos:[expense],citas:[appointment]
  };
  window.__qaWriteAttempts=0;
  window.sb={from(table){const filters=[];let cap=500,one=false;return {select(){return this},eq(k,v){filters.push(r=>r[k]===v);return this},gt(k,v){filters.push(r=>r[k]>v);return this},order(){return this},limit(n){cap=n;return this},range(){return this},maybeSingle(){one=true;return this},then(resolve,reject){return Promise.resolve().then(()=>{const data=(rows[table]||[]).filter(r=>filters.every(f=>f(r))).slice(0,cap);return {data:one?(data[0]||null):data,error:null};}).then(resolve,reject)},insert(){window.__qaWriteAttempts++;throw Error('CI no permite escrituras')},update(){window.__qaWriteAttempts++;throw Error('CI no permite escrituras')},delete(){window.__qaWriteAttempts++;throw Error('CI no permite escrituras')}}},rpc(){window.__qaWriteAttempts++;throw Error('CI no permite operaciones de escritura')}};
  window._currentUserId=u;window._cfgNegocio={nombreNegocio:'Negocio de prueba · QA'};
  document.querySelector('.nav-title').textContent='Negocio de prueba · QA';
  ['login-overlay','section-pass-overlay','cp-operator-overlay','splash','welcome-premium'].forEach(id=>{const e=document.getElementById(id);if(e){e.style.display='none';e.classList.remove('open');}});
  window._cpOperatorRequired=false;
  ['gestion','empleados','agenda','gastos','cotizaciones','dashboard','inventario','historial'].forEach(name=>seccionesDesbloqueadas.add(name));
  chartJsReady=true;_historialEstado='listo';baseDeDatosLocal=[ticket];
  _empleadosEstado='listo';empleadosDB=[owned({id:'qa-employee',nombre:'Empleado de prueba',rol:'Encargado',telefono:'',salario:5000,bono:0,deduccion:0,status:'activo',turno:'Flexible',details:{code:'QA-001',department:'Operaciones',hired:day,contract:'Indefinido'}})];pagosNominaDB=[];
  _citasEstado='listo';citasDB=[appointment];_gastosEstado='listo';gastosDB=[expense];
  _cotizacionesEstado='listo';cotizacionesDB=[owned({id:'qa-quote',cliente:'Cliente de prueba',concepto:'Cotización de prueba',monto:116,validez:day,estado:'pendiente',details:{}})];
  return true;
 })()`);
 win.setSize(1440,1000);win.showInactive();
 const checks=[];
 async function check(name,activate,screenshot){
  await win.webContents.executeJavaScript(activate);
  await new Promise(resolve=>setTimeout(resolve,180));
  const result=await win.webContents.executeJavaScript(`(()=>{
   const e=document.getElementById('view-'+${JSON.stringify(name)}),r=e.getBoundingClientRect(),style=getComputedStyle(e);
   const active=Array.from(document.querySelectorAll('.view[id^="view-"].active')).map(v=>v.id);
   const text=e.innerText.trim();const hit=document.elementFromPoint(Math.min(innerWidth-10,r.x+r.width/2),Math.max(100,Math.min(innerHeight-20,r.y+35)));
   return {view:${JSON.stringify(name)},display:style.display,width:r.width,height:r.height,active,textLength:text.length,uncovered:!!hit&&e.contains(hit),writes:window.__qaWriteAttempts};
  })()`);
  checks.push(result);
  fs.writeFileSync(path.join(out,'navegacion-progreso-'+process.platform+'-'+process.arch+'.json'),JSON.stringify({checks},null,2));
  if(screenshot){const image=await win.webContents.capturePage();assert(!image.isEmpty());fs.writeFileSync(path.join(out,screenshot),image.toPNG());}
  assert.notEqual(result.display,'none',name+' debe ser visible');assert(result.width>300&&result.height>60,name+' debe ocupar espacio visible');assert(result.textLength>20,name+' debe mostrar contenido');assert(result.uncovered,name+' no debe quedar tapado por otra capa');assert.deepEqual(result.active,['view-'+name]);assert.equal(result.writes,0);
 }
 await check('gestion',`document.getElementById('sb-gestion').scrollIntoView({block:'nearest'});document.getElementById('sb-gestion').click();`,'gestion-inicio.png');
 const labels=['Proveedores','Compras','Por cobrar','Por pagar','Posventa y soporte','Reposición','Metas y presupuestos','Bitácora'];
 for(const label of labels)await check('gestion',`Array.from(document.querySelectorAll('#mgmt-tabs button')).find(b=>b.textContent.trim()===${JSON.stringify(label)}).click();`,label==='Proveedores'?'gestion-proveedores.png':null);
 for(const name of ['empleados','agenda','gastos','cotizaciones','dashboard'])await check(name,`document.getElementById('sb-'+${JSON.stringify(name)}).click();`,name==='empleados'?'empleados-visible.png':null);
 await check('gestion',`document.getElementById('sb-gestion').click();`);
 const result={passed:true,fixture:'Datos sintéticos y perfil temporal; sin sesión real ni escrituras',checks};
 fs.writeFileSync(path.join(out,'navegacion-'+process.platform+'-'+process.arch+'.json'),JSON.stringify(result,null,2));
 return {passed:true,viewsChecked:checks.length,screenshots:['gestion-inicio.png','gestion-proveedores.png','empleados-visible.png']};
}
module.exports={checkNavigation};
