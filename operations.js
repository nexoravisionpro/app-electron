/* Administración operativa de Core Point. */
(function(){
'use strict';
const $=id=>document.getElementById(id),esc=textoSeguroNomina;
const today=()=>fechaLocalNomina(new Date()),money=n=>'$'+Number(n||0).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2});
const val=id=>$(id)?.value.trim()||'';
const field=(id,label,type='text')=>`<div class="field"><label for="${id}">${label}</label><input id="${id}" type="${type}" maxlength="1000"></div>`;
const select=(id,label,values)=>`<div class="field"><label for="${id}">${label}</label><select id="${id}">${values.map(v=>`<option value="${v}">${v}</option>`).join('')}</select></div>`;
const inject=(overlay,html)=>$(overlay).querySelector('.mm-body').insertAdjacentHTML('beforeend',html);
const block=(title,body)=>`<section class="cp-ops-section"><h3>${title}</h3>${body}</section>`;
const grid=body=>`<div class="cp-ops-grid">${body}</div>`;
const permission=key=>typeof cpRequirePermission!=='function'||cpRequirePermission(key);
const fail=e=>{console.error('Operaciones:',e);showToast(e.message||'No se pudo completar la operación','error');};
inject('modal-emp-overlay',block('Expediente laboral',grid(field('ops-emp-code','Número de empleado')+field('ops-emp-department','Departamento')+field('ops-emp-email','Correo','email')+field('ops-emp-hired','Fecha de ingreso','date')+field('ops-emp-ended','Fecha de baja','date')+select('ops-emp-contract','Contrato',['Indefinido','Temporal','Por proyecto','Otro'])+field('ops-emp-address','Domicilio')+field('ops-emp-emergency','Contacto de emergencia')+field('ops-emp-emergency-phone','Teléfono de emergencia','tel')+field('ops-emp-notes','Observaciones laborales')))+`<p class="cp-ops-note">El expediente no crea una cuenta de acceso. Las asistencias se registran manualmente desde el detalle del empleado.</p>`);
inject('modal-gasto-overlay',block('Control del pago',grid(select('ops-gasto-state','Estado',['Pagado','Pendiente'])+select('ops-gasto-method','Método',['Sin especificar','Transferencia','Efectivo','Tarjeta','Depósito','Otro'])+field('ops-gasto-due','Vencimiento','date')+field('ops-gasto-paid','Fecha de pago','date')+field('ops-gasto-ref','Folio / referencia del comprobante')+field('ops-gasto-center','Centro de costo')))+`<p class="cp-ops-note">Monto total del gasto. Un gasto pendiente no se suma a las salidas pagadas.</p>`);
inject('modal-cita-overlay',block('Organización de la cita',grid(field('ops-cita-owner','Responsable / recurso')+field('ops-cita-duration','Duración en minutos','number')+select('ops-cita-state','Estado',['Programada','Confirmada','Cancelada'])+select('ops-cita-type','Tipo',['Presencial','Videollamada','Llamada','Entrega','Otro'])+field('ops-cita-place','Ubicación o enlace'))));
inject('modal-cot-overlay',block('Documento comercial',grid(field('ops-cot-email','Correo del cliente','email')+field('ops-cot-address','Domicilio del cliente')+field('ops-cot-rfc','RFC del cliente')+field('ops-cot-terms','Condiciones de pago y entrega')))+block('Partidas de la cotización',`<label><input id="ops-cot-itemized" type="checkbox" onchange="cpQuoteItemMode()"> Desglosar productos o servicios</label><div id="ops-cot-lines-area" hidden><div id="ops-cot-lines"></div><button type="button" class="btn-secondary" onclick="cpAddQuoteLine()">+ Agregar partida</button>${grid(field('ops-cot-discount','Descuento total (MXN)','number')+field('ops-cot-tax','Impuesto (%)','number'))}<div id="ops-cot-totals" class="cp-ops-total" aria-live="polite"></div></div><p class="cp-ops-note">Precios antes de impuesto. El descuento se aplica antes del impuesto. El documento no es un CFDI.</p>`));
$('modal-cot-overlay').querySelector('.modulo-modal').style.maxWidth='850px';
for(const id of ['ops-cot-discount','ops-cot-tax']){$(id).step='0.01';$(id).min='0';$(id).addEventListener('input',()=>cpQuoteRecalculate());}
$('ops-cita-duration').min='5';$('ops-cita-duration').max='1440';
const staffMap={code:'ops-emp-code',department:'ops-emp-department',email:'ops-emp-email',hired:'ops-emp-hired',ended:'ops-emp-ended',contract:'ops-emp-contract',address:'ops-emp-address',emergency:'ops-emp-emergency',emergencyPhone:'ops-emp-emergency-phone',notes:'ops-emp-notes'};
const expenseMap={paymentStatus:'ops-gasto-state',method:'ops-gasto-method',due:'ops-gasto-due',paidOn:'ops-gasto-paid',reference:'ops-gasto-ref',costCenter:'ops-gasto-center'};
const appointmentMap={responsable:'ops-cita-owner',duracion:'ops-cita-duration',status:'ops-cita-state',type:'ops-cita-type',place:'ops-cita-place'};
const quoteMap={email:'ops-cot-email',address:'ops-cot-address',rfc:'ops-cot-rfc',terms:'ops-cot-terms'};
window.cpFillOpsDetails=function(kind,row){
 const details=row?.details||{},map={employee:staffMap,expense:expenseMap,appointment:appointmentMap,quote:quoteMap}[kind];
 const defaults={contract:'Indefinido',paymentStatus:'Pagado',method:'Sin especificar',paidOn:row?.fecha||today(),duracion:30,status:'Programada',type:'Presencial'};
 Object.entries(map).forEach(([key,id])=>{$(id).value=details[key]??defaults[key]??'';});
 if(kind==='appointment')$('ops-cita-state').value=({programada:'Programada',confirmada:'Confirmada',cancelada:'Cancelada'})[details.status]||'Programada';
 if(kind==='quote'){$('ops-cot-itemized').checked=!!details.items?.length;$('ops-cot-lines').innerHTML='';(details.items||[]).forEach(l=>cpAddQuoteLine(l));$('ops-cot-discount').value=details.discount||0;$('ops-cot-tax').value=details.tax||0;cpQuoteItemMode();}
};
window.cpReadOpsDetails=function(kind){
 const map={employee:staffMap,expense:expenseMap,appointment:appointmentMap,quote:quoteMap}[kind];
 const existing={employee:empleadosDB.find(e=>e.id===_editEmpId),expense:gastosDB.find(e=>e.id===_editGastoId),appointment:citasDB.find(e=>e.id===_editCitaId),quote:cotizacionesDB.find(e=>e.id===_editCotId)}[kind];
 const d={...(existing?.details||{})};Object.entries(map).forEach(([key,id])=>d[key]=val(id));
 if(kind==='employee'){
  if(d.email&&!$('ops-emp-email').checkValidity())throw Error('Revisa el correo del empleado');
  if(d.ended&&d.hired&&d.ended<d.hired)throw Error('La baja no puede ser anterior al ingreso');
  if(d.code&&empleadosDB.some(e=>e.id!==_editEmpId&&e.details?.code?.toLowerCase()===d.code.toLowerCase()))throw Error('El número de empleado ya existe');
 }
 if(kind==='expense'){if(d.paymentStatus==='Pagado'&&!d.paidOn)throw Error('Indica la fecha de pago');if(d.paymentStatus==='Pendiente')d.paidOn='';}
 if(kind==='appointment'){d.status=d.status.toLowerCase();d.duracion=Number(d.duracion);if(!Number.isInteger(d.duracion)||d.duracion<5||d.duracion>1440)throw Error('La duración debe estar entre 5 y 1440 minutos');}
 if(kind==='quote'){
  if(d.email&&!$('ops-cot-email').checkValidity())throw Error('Revisa el correo del cliente');
  if($('ops-cot-itemized').checked)Object.assign(d,cpQuoteRecalculate(true));else ['items','subtotal','discount','tax','taxAmount','total'].forEach(k=>delete d[k]);
  const cfg=cargarConfig();d.business={name:cfg.nombreNegocio||'',address:cfg.direccion||'',city:cfg.ciudad||'',rfc:cfg.rfc||'',phone:cfg.whatsapp||''};
  if(!d.business.name)throw Error('Configura el nombre del negocio antes de emitir cotizaciones');
 }
 return d;
};
window.cpAddQuoteLine=function(line={}){
 if($('ops-cot-lines').children.length>=100){showToast('Máximo 100 partidas','error');return;}
 const row=document.createElement('div');row.className='cp-quote-line';
 row.innerHTML='<input aria-label="Descripción" placeholder="Producto o servicio" class="ql-description" maxlength="600"><input aria-label="Cantidad" type="number" class="ql-qty" min="0.001" step="0.001"><input aria-label="Precio unitario" type="number" class="ql-price" min="0" step="0.01"><button type="button" class="btn-secondary" aria-label="Quitar partida">×</button>';
 row.querySelector('.ql-description').value=line.description||'';row.querySelector('.ql-qty').value=line.qty||1;row.querySelector('.ql-price').value=line.price??0;
 row.addEventListener('input',()=>cpQuoteRecalculate());row.querySelector('button').onclick=()=>{row.remove();cpQuoteRecalculate();};$('ops-cot-lines').append(row);
};
window.cpQuoteItemMode=function(){const on=$('ops-cot-itemized').checked;$('ops-cot-lines-area').hidden=!on;$('cot-monto').readOnly=on;if(on){if(!$('ops-cot-lines').children.length)cpAddQuoteLine();cpQuoteRecalculate();}};
window.cpQuoteRecalculate=function(strict=false){try{
 const lines=[...$('ops-cot-lines').children].map(r=>({description:r.querySelector('.ql-description').value,qty:r.querySelector('.ql-qty').value,price:r.querySelector('.ql-price').value}));
 const result=CPBusiness.quote(lines,val('ops-cot-discount')||0,val('ops-cot-tax')||0);
 $('cot-monto').value=result.total.toFixed(2);$('ops-cot-totals').textContent=`Subtotal ${money(result.subtotal)} · Descuento ${money(result.discount)} · Impuesto ${money(result.taxAmount)} · Total ${money(result.total)}`;return result;
 }catch(e){$('ops-cot-totals').textContent=e.message;if($('ops-cot-itemized').checked)$('cot-monto').value='';if(strict)throw e;return null;}};
$('cot-status').insertAdjacentHTML('beforeend','<option value="vencida">Pendientes vencidas</option>');
$('cot-tbody').closest('table').parentElement.insertAdjacentHTML('beforebegin','<div id="ops-quotes-summary" class="cp-ops-note" style="padding:0 16px"></div>');
$('cot-tbody').closest('table').querySelector('thead').innerHTML='<tr><th>Fecha</th><th>Cliente / Folio</th><th>Concepto</th><th>Total MXN</th><th>Vigencia</th><th>Estado</th><th>Acciones</th></tr>';
window.renderCotizaciones=function(){
 if(_cotizacionesEstado!=='listo'){$('cot-tbody').innerHTML='<tr><td colspan="7">'+(_cotizacionesEstado==='error'?'Cotizaciones no disponibles':'Cargando cotizaciones…')+'</td></tr>';$('cot-count').textContent='Datos no disponibles';$('cot-sum').textContent='—';return;}
 const q=val('cot-search').toLowerCase(),state=val('cot-status');
 const expired=c=>c.estado==='pendiente'&&c.validez&&c.validez<today();
 const rows=cotizacionesDB.filter(c=>(!q||`${c.cliente} ${c.concepto} ${c.id}`.toLowerCase().includes(q))&&(!state||(state==='vencida'?expired(c):c.estado===state)));
 $('cot-count').textContent=rows.length+' cotizaciones';$('cot-sum').textContent=money(rows.reduce((a,c)=>a+Number(c.monto),0));
 const summary=$('ops-quotes-summary');if(summary)summary.textContent=`${rows.filter(c=>c.estado==='pendiente'&&!expired(c)).length} pendientes vigentes · ${rows.filter(expired).length} vencidas · ${rows.filter(c=>c.estado==='aceptada').length} aceptadas. Los importes son propuestas, no cobros.`;
 $('cot-tbody').innerHTML=rows.map(c=>`<tr><td>${esc(String(c.created_at||'').slice(0,10))}</td><td><strong>${esc(c.cliente)}</strong><small class="cp-ops-note">Folio ${esc(String(c.id).slice(0,8))}</small></td><td>${esc(c.concepto)}<small class="cp-ops-note">${c.details?.items?.length?c.details.items.length+' partidas':'Importe único'}</small></td><td>${money(c.monto)}</td><td>${esc(c.validez||'Sin fecha')}</td><td><span class="status-badge ${c.estado==='aceptada'?'activo':'pendiente'}">${expired(c)?'Vencida':esc(c.estado)}</span></td><td><div class="cp-ops-actions"><button class="btn-secondary" onclick="cpImprimirCotizacion('${c.id}')">PDF</button><button class="btn-secondary" onclick="abrirNuevaCotizacion('${c.id}')">Editar</button><button class="btn-secondary" onclick="cpDuplicateQuote('${c.id}')">Duplicar</button>${c.estado==='pendiente'?`<button class="btn-secondary" onclick="setCotEstado('${c.id}','aceptada')">Aceptar</button><button class="btn-secondary" onclick="setCotEstado('${c.id}','rechazada')">Rechazar</button>`:''}${c.estado==='aceptada'?`<button class="btn-secondary" onclick="convertirCotVentaId('${c.id}')">Preparar venta</button>`:''}${c.telefono?`<button class="btn-secondary" onclick="enviarCotWAId('${c.id}')">WhatsApp</button>`:''}<button class="btn-secondary" onclick="eliminarCot('${c.id}')">Eliminar</button></div></td></tr>`).join('')||'<tr><td colspan="7">Sin cotizaciones para los filtros seleccionados.</td></tr>';
};
window.cpDuplicateQuote=function(id){const c=cotizacionesDB.find(c=>c.id===id);if(!c||window._cpQuoteSaving||!permission('quotes'))return;abrirNuevaCotizacion();for(const [name,key] of [['cot-cliente','cliente'],['cot-tel','telefono'],['cot-concepto','concepto'],['cot-monto','monto'],['cot-notas','notas']])$(name).value=c[key]||'';cpFillOpsDetails('quote',c);const d=new Date();d.setDate(d.getDate()+15);$('cot-validez').value=fechaLocalNomina(d);$('modal-cot-title').textContent='Duplicar cotización · nueva propuesta';};
let calendarMonth=today().slice(0,7);
$('agenda-lista').insertAdjacentHTML('beforebegin',`<div class="cp-ops-toolbar"><input id="ops-agenda-q" placeholder="Buscar asunto, cliente o responsable" aria-label="Buscar citas"><input id="ops-agenda-day" type="date" aria-label="Fecha de agenda"><select id="ops-agenda-state" aria-label="Estado de cita"><option value="">Todos los estados</option><option value="pending">Pendientes</option><option value="done">Realizadas</option><option value="cancelled">Canceladas</option><option value="late">Atrasadas</option></select><button class="btn-secondary" onclick="cpExportAgenda()">Calendario .ics</button><button class="btn-secondary" onclick="cpResetAgenda()">Limpiar filtros</button></div><div id="ops-agenda-summary" class="cp-ops-note"></div><div class="cp-calendar-head"><button class="btn-secondary" onclick="cpMoveMonth(-1)">←</button><strong id="ops-calendar-title"></strong><button class="btn-secondary" onclick="cpMoveMonth(1)">→</button></div><div id="ops-calendar" class="cp-calendar"></div>`);
['ops-agenda-q','ops-agenda-day','ops-agenda-state'].forEach(id=>$(id).addEventListener('input',()=>{if(id==='ops-agenda-day'&&val(id))setAgendaTab('todas');renderAgenda();}));
window.cpMoveMonth=function(delta){const d=new Date(calendarMonth+'-01T12:00:00');d.setMonth(d.getMonth()+delta);calendarMonth=fechaLocalNomina(d).slice(0,7);renderAgenda();};
window.cpResetAgenda=function(){['ops-agenda-q','ops-agenda-day','ops-agenda-state'].forEach(id=>$(id).value='');calendarMonth=today().slice(0,7);setAgendaTab('hoy');};
window.cpChooseDay=function(day){$('ops-agenda-day').value=day;setAgendaTab('todas');};
function agendaRows(){
 const now=new Date(),day=today(),start=new Date(now.getFullYear(),now.getMonth(),now.getDate()-((now.getDay()+6)%7)),end=new Date(start);end.setDate(end.getDate()+6);
 const q=val('ops-agenda-q').toLowerCase(),date=val('ops-agenda-day'),state=val('ops-agenda-state');
 return citasDB.filter(c=>{
  const cancelled=c.details?.status==='cancelada',late=!c.hecho&&!cancelled&&(c.fecha<day||(c.fecha===day&&c.hora&&c.hora<now.toTimeString().slice(0,5)));
  if(date?c.fecha!==date:_agendaTab==='hoy'?c.fecha!==day:_agendaTab==='semana'?(c.fecha<fechaLocalNomina(start)||c.fecha>fechaLocalNomina(end)):false)return false;
  if(q&&!`${c.titulo} ${c.cliente} ${c.details?.responsable||''} ${c.details?.place||''}`.toLowerCase().includes(q))return false;
  return !state||(state==='pending'&&!c.hecho&&!cancelled)||(state==='done'&&c.hecho)||(state==='cancelled'&&cancelled)||(state==='late'&&late);
 }).sort((a,b)=>(a.fecha+(a.hora||'')).localeCompare(b.fecha+(b.hora||'')));
}
window.renderAgenda=function(){
 const list=$('agenda-lista');if(_citasEstado!=='listo'){list.textContent=_citasEstado==='error'?'Agenda no disponible. Usa Actualizar para reintentar.':'Cargando agenda…';$('ops-calendar').innerHTML='';$('ops-agenda-summary').textContent='';return;}
 $('ops-calendar-title').textContent=new Date(calendarMonth+'-01T12:00:00').toLocaleDateString('es-MX',{month:'long',year:'numeric'});
 const first=new Date(calendarMonth+'-01T12:00:00'),days=new Date(first.getFullYear(),first.getMonth()+1,0).getDate();
 $('ops-calendar').innerHTML=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d=>`<span>${d}</span>`).join('')+'<i></i>'.repeat((first.getDay()+6)%7)+Array.from({length:days},(_,i)=>{
  const date=calendarMonth+'-'+String(i+1).padStart(2,'0'),count=citasDB.filter(c=>c.fecha===date&&!c.hecho&&c.details?.status!=='cancelada').length;
  return `<button class="${date===today()?'today':''} ${date===val('ops-agenda-day')?'selected':''}" onclick="cpChooseDay('${date}')">${i+1}<small>${count?count+' citas':''}</small></button>`;
 }).join('');
 const rows=agendaRows();$('ops-agenda-summary').textContent=`${rows.length} citas en la vista · ${rows.filter(c=>!c.hecho&&c.details?.status!=='cancelada').length} pendientes · ${rows.filter(c=>c.hecho).length} realizadas`;
 list.innerHTML=rows.map(c=>`<article class="cp-agenda-item"><div><span class="cp-ops-eyebrow">${esc(c.fecha)} · ${esc(c.hora||'Sin hora')} · ${Number(c.details?.duracion||30)} min</span><h3>${esc(c.titulo)}</h3><p>${esc(c.cliente||'Sin cliente')} · ${esc(c.details?.responsable||'Sin responsable')}</p><p>${esc(c.details?.type||'Cita')} · ${esc(c.details?.place||'Sin ubicación')}</p><p>${esc(c.notas||'')}</p><span class="status-badge ${c.hecho?'activo':'pendiente'}">${c.hecho?'Realizada':c.details?.status==='cancelada'?'Cancelada':c.details?.status==='confirmada'?'Confirmada':'Programada'}</span> <span>${esc(c.prioridad||'normal')}</span></div><div class="cp-ops-actions"><button class="btn-secondary" onclick="abrirNuevaCita('${c.id}')">Editar / reprogramar</button>${c.details?.status==='cancelada'?'':`<button class="btn-secondary" onclick="toggleCitaHecho('${c.id}')">${c.hecho?'Reabrir':'Completar'}</button>`}<button class="btn-secondary" onclick="cpExportAgenda('${c.id}')">.ics</button>${c.telefono?`<button class="btn-secondary" onclick="enviarCitaWAId('${c.id}')">WhatsApp</button>`:''}<button class="btn-secondary" onclick="eliminarCita('${c.id}')">Eliminar</button></div></article>`).join('')||'<div class="cp-ops-empty">Sin citas para los filtros seleccionados.</div>';
};
window.cpAppointmentConflict=function(payload){return citasDB.find(c=>CPBusiness.overlap({...payload,id:_editCitaId},c));};
function download(name,text,type){const blob=new Blob([text],{type}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
window.cpExportAgenda=function(id){
 if(_citasEstado!=='listo')return;const rows=id?citasDB.filter(c=>c.id===id):agendaRows();if(!rows.length){showToast('No hay citas para exportar','error');return;}
 const ie=s=>String(s||'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
 const stamp=(date,hour)=>date.replace(/-/g,'')+'T'+hour.replace(/:/g,'').slice(0,4)+'00';
 const events=rows.map(c=>{let dateLines='';if(c.hora){const d=new Date(c.fecha+'T'+c.hora.slice(0,5)+':00');d.setMinutes(d.getMinutes()+Number(c.details?.duracion||30));dateLines=`DTSTART:${stamp(c.fecha,c.hora)}\r\nDTEND:${stamp(fechaLocalNomina(d),d.toTimeString().slice(0,5))}`;}else{const d=new Date(c.fecha+'T12:00:00');d.setDate(d.getDate()+1);dateLines=`DTSTART;VALUE=DATE:${c.fecha.replace(/-/g,'')}\r\nDTEND;VALUE=DATE:${fechaLocalNomina(d).replace(/-/g,'')}`;}
 return `BEGIN:VEVENT\r\nUID:${c.id}@corepoint\r\nDTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d+Z/,'Z')}\r\n${dateLines}\r\nSUMMARY:${ie(c.titulo)}\r\nDESCRIPTION:${ie([c.cliente,c.details?.responsable,c.notas].filter(Boolean).join('\n'))}\r\nLOCATION:${ie(c.details?.place)}\r\nSTATUS:${c.details?.status==='cancelada'?'CANCELLED':c.details?.status==='confirmada'?'CONFIRMED':'TENTATIVE'}\r\nEND:VEVENT`;});
 const fold=line=>{let out='',chunk='',bytes=0;for(const char of line){const size=new TextEncoder().encode(char).length;if(bytes+size>73){out+=chunk+'\r\n ';chunk='';bytes=1;}chunk+=char;bytes+=size;}return out+chunk;};
 download('Agenda_CorePoint.ics',('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//CorePoint//Agenda//ES\r\nCALSCALE:GREGORIAN\r\n'+events.join('\r\n')+'\r\nEND:VCALENDAR').split('\r\n').map(fold).join('\r\n'),'text/calendar;charset=utf-8');
};
$('gastos-toolbar').insertAdjacentHTML('beforeend','<select id="ops-gastos-state" aria-label="Estado del gasto"><option value="">Todos los pagos</option><option>Pagado</option><option>Pendiente</option><option>Vencido</option></select>');
$('ops-gastos-state').onchange=()=>renderGastos();
function expenseRows(){const q=val('gastos-search').toLowerCase(),state=val('ops-gastos-state'),from=val('gastos-desde'),to=val('gastos-hasta'),cat=val('gastos-cat');return gastosDB.filter(g=>{
 const s=g.details?.paymentStatus||'Pagado';
 return (!q||`${g.descripcion} ${g.proveedor} ${g.details?.reference||''} ${g.details?.costCenter||''}`.toLowerCase().includes(q))&&(!cat||cat===g.categoria)&&(!from||g.fecha>=from)&&(!to||g.fecha<=to)&&(!state||state===s||(state==='Vencido'&&s==='Pendiente'&&g.details?.due&&g.details.due<today()));
}).sort((a,b)=>String(b.fecha).localeCompare(String(a.fecha)));}
const card=(label,value,sub='')=>`<div class="cp-ops-metric"><span>${label}</span><strong>${value}</strong><small>${sub}</small></div>`;
window.renderGastos=function(){
 if(_gastosEstado!=='listo'){$('gastos-tbody').innerHTML=`<tr><td colspan="6">${_gastosEstado==='error'?'No se pudieron cargar los gastos':'Cargando gastos…'}</td></tr>`;$('gastos-kpis').innerHTML='';$('gastos-count').textContent='Datos no disponibles';$('gastos-sum').textContent='—';return;}
 const rows=expenseRows(),sum=rs=>rs.reduce((a,g)=>a+Number(g.monto||0),0),paid=rows.filter(g=>g.details?.paymentStatus!=='Pendiente'),pending=rows.filter(g=>g.details?.paymentStatus==='Pendiente');
 $('gastos-kpis').innerHTML=card('Pagados en la vista',money(sum(paid)),paid.length+' gastos')+card('Pendientes en la vista',money(sum(pending)),pending.length+' por pagar')+card('Pendientes vencidos',money(sum(pending.filter(g=>g.details?.due&&g.details.due<today()))),'Según fecha de vencimiento');
 $('gastos-count').textContent=rows.length+' registros filtrados';$('gastos-sum').textContent=money(sum(rows));
 $('gastos-tbody').innerHTML=rows.map(g=>`<tr><td>${esc(g.fecha)}</td><td><strong>${esc(g.descripcion)}</strong><small class="cp-ops-note">${esc(g.details?.reference||'Sin folio')} · ${esc(g.details?.costCenter||'Sin centro de costo')}</small></td><td>${esc(g.categoria)}<br><span class="status-badge ${g.details?.paymentStatus==='Pendiente'?'pendiente':'activo'}">${esc(g.details?.paymentStatus||'Pagado')}</span></td><td>${esc(g.proveedor||'—')}<small class="cp-ops-note">${esc(g.details?.method||'Sin método histórico')}${g.details?.due?' · Vence '+esc(g.details.due):''}</small></td><td class="num">${money(g.monto)}</td><td><button class="btn-secondary" onclick="abrirNuevoGasto('${g.id}')">Editar</button><button class="btn-secondary" onclick="eliminarGasto('${g.id}')">Eliminar</button></td></tr>`).join('')||'<tr><td colspan="6">Sin gastos para los filtros seleccionados.</td></tr>';
};
const originalClearGastos=limpiarFiltrosGastos;window.limpiarFiltrosGastos=function(){$('ops-gastos-state').value='';originalClearGastos();};
let expenseBusy=false,expenseDraftId=null;
const openExpense=abrirNuevoGasto,closeExpense=cerrarModalGasto;
window.abrirNuevoGasto=async function(id){if(expenseBusy)return;await openExpense(id);expenseDraftId=id||window.crypto.randomUUID();};
window.cerrarModalGasto=function(){if(!expenseBusy)closeExpense();};
window.guardarGasto=async function(){
 if(expenseBusy||_gastosEstado!=='listo'||!window._currentUserId)return;
 const user=window._currentUserId,id=_editGastoId,before=gastosDB.find(g=>g.id===id),draft=expenseDraftId||window.crypto.randomUUID();
 let payload;try{const amount=Number(val('gasto-monto'));if(!val('gasto-desc')||!Number.isFinite(amount)||amount<=0||amount>999999999999.99||Math.abs(amount*100-Math.round(amount*100))>.00001||!val('gasto-fecha'))throw Error('Completa descripción, fecha y un importe válido con dos decimales');payload={descripcion:val('gasto-desc'),categoria:val('gasto-cat'),monto:amount,proveedor:val('gasto-proveedor'),fecha:val('gasto-fecha'),notas:val('gasto-notas'),details:cpReadOpsDetails('expense')};}catch(e){fail(e);return;}
 expenseBusy=true;const controls=[...$('modal-gasto-overlay').querySelectorAll('input,select,textarea,button')].map(el=>({el,disabled:el.disabled}));controls.forEach(c=>c.el.disabled=true);
 try{if(id&&!(await gastoPuedeModificarse(id)))return;if(user!==window._currentUserId)return;let q=id?window.sb.from('gastos').update(payload).eq('id',id).eq('ops_revision',before?.ops_revision??0):window.sb.from('gastos').insert([{...payload,id:draft}]);const {data,error}=await q.select('id').maybeSingle();if(error||!data)throw Error(error?.code==='23505'?'Este registro ya existe. Revisa gastos antes de reintentar.':'No se confirmó el gasto o fue modificado desde otro dispositivo. Revisa la lista antes de reintentar.');if(user!==window._currentUserId)return;expenseBusy=false;cerrarModalGasto();await cargarGastos();showToast(id?'Gasto actualizado':'Gasto registrado','success');}
 catch(e){if(user===window._currentUserId)fail(e);}finally{expenseBusy=false;controls.forEach(c=>c.el.disabled=c.disabled);}
};
window.exportarGastosExcel=function(){if(_gastosEstado!=='listo')return;const rows=expenseRows();downloadExcel('Gastos_CorePoint.xlsx','Gastos',[['Fecha','Descripción','Categoría','Proveedor','Monto','Estado','Método','Vencimiento','Pagado el','Referencia','Centro de costo','Notas'],...rows.map(g=>[g.fecha,g.descripcion,g.categoria,g.proveedor,Number(g.monto),g.details?.paymentStatus||'Pagado',g.details?.method||'',g.details?.due||'',g.details?.paidOn||'',g.details?.reference||'',g.details?.costCenter||'',g.notas])]);};

// Expediente con incidencias fechadas, enlazadas por identificador de empleado.
$('emp-search').placeholder='Nombre, puesto, departamento, número o correo';
$('emp-search').closest('.historial-toolbar').insertAdjacentHTML('beforeend','<select id="ops-emp-dept" aria-label="Departamento"><option value="">Todos los departamentos</option></select>');
$('ops-emp-dept').onchange=()=>renderEmpleados();
const originalEmployeeRender=renderEmpleados;
window.renderEmpleados=function(){originalEmployeeRender();if(_empleadosEstado!=='listo')return;
 const dept=val('ops-emp-dept');$('ops-emp-dept').innerHTML='<option value="">Todos los departamentos</option>'+[...new Set(empleadosDB.map(e=>e.details?.department).filter(Boolean))].sort().map(d=>`<option value="${esc(d)}">${esc(d)}</option>`).join('');$('ops-emp-dept').value=dept;
 const q=val('emp-search').toLowerCase(),state=val('emp-status-filter'),turn=val('emp-turno-filter'),sort=val('emp-sort');
 const rows=empleadosDB.filter(e=>(!q||`${e.nombre} ${e.rol} ${e.details?.department||''} ${e.details?.code||''} ${e.details?.email||''}`.toLowerCase().includes(q))&&(!state||e.status===state)&&(!turn||String(e.turno||'').includes(turn))&&(!dept||e.details?.department===dept));
 if(sort==='nombre')rows.sort((a,b)=>String(a.nombre).localeCompare(String(b.nombre)));if(sort==='salario')rows.sort((a,b)=>netoEmpleado(b)-netoEmpleado(a));
 $('emp-lista').innerHTML=`<div class="cp-ops-panel"><h2>Directorio de personal</h2><p class="cp-ops-note">${rows.length} empleados en la vista. Abre el expediente para consultar pagos y registrar asistencias o incidencias.</p><div class="cp-ops-table-wrap"><table class="rpt-table"><thead><tr><th>Número / Nombre</th><th>Departamento / Puesto</th><th>Contacto</th><th>Ingreso / Contrato</th><th>Turno</th><th>Neto quincenal estimado</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${rows.map(e=>`<tr><td><small>${esc(e.details?.code||'Sin número')}</small><br><strong>${esc(e.nombre)}</strong></td><td>${esc(e.details?.department||'Sin departamento')}<br>${esc(e.rol||'Sin puesto')}</td><td>${esc(e.telefono||'—')}<br>${esc(e.details?.email||'')}</td><td>${esc(e.details?.hired||'Sin fecha')}<br>${esc(e.details?.contract||'Sin registrar')}</td><td>${esc(e.turno||'—')}</td><td>${money(netoEmpleado(e))}</td><td><span class="status-badge ${e.status==='activo'?'activo':'pendiente'}">${esc(e.status)}</span></td><td><div class="cp-ops-actions"><button class="btn-secondary" onclick="verDetalleEmpleado('${e.id}')">Expediente</button><button class="btn-secondary" onclick="abrirNuevoEmpleado('${e.id}')">Editar</button>${e.status==='activo'?`<button class="btn-secondary" onclick="abrirPagoNomina('${e.id}')">Registrar pago</button>`:''}<button class="btn-secondary" onclick="eliminarEmpleado('${e.id}')">Eliminar</button></div></td></tr>`).join('')||'<tr><td colspan="8">Sin empleados para los filtros seleccionados.</td></tr>'}</tbody></table></div></div>`;
};
const clearEmployeeFilters=limpiarFiltrosEmp;window.limpiarFiltrosEmp=function(){$('ops-emp-dept').value='';clearEmployeeFilters();};
const originalDetail=verDetalleEmpleado;
let eventGeneration=0,eventBusy=false;
window.verDetalleEmpleado=function(id){originalDetail(id);const e=empleadosDB.find(x=>x.id===id);if(!e)return;
 const d=e.details||{};
 $('emp-detalle-body').insertAdjacentHTML('beforeend',block('Expediente',`<dl class="cp-ops-dl">${Object.entries({Número:d.code,Departamento:d.department,Correo:d.email,Ingreso:d.hired,Baja:d.ended,Contrato:d.contract,Domicilio:d.address,Emergencia:[d.emergency,d.emergencyPhone].filter(Boolean).join(' · '),Observaciones:d.notes}).map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v||'Sin registrar')}</dd>`).join('')}</dl>`)+block('Asistencias e incidencias',`<p class="cp-ops-note">Registro manual. No modifica automáticamente salario, descuentos ni prestaciones.</p>${grid(select('ops-event-kind','Movimiento',['Asistencia','Falta','Retardo','Vacaciones','Permiso','Incapacidad'])+field('ops-event-day','Fecha','date')+field('ops-event-minutes','Minutos de retardo','number')+field('ops-event-note','Detalle / motivo'))}<button id="ops-event-save" class="btn-primary" onclick="cpSaveStaffEvent()">Registrar movimiento</button><button class="btn-secondary" onclick="cpExportStaffEvents()">Exportar historial</button><div id="ops-staff-events" role="status"></div>`));
 $('ops-event-day').value=today();$('ops-event-minutes').value=0;loadStaffEvents(id);
};
let staffEventRows=[],staffEventUser=null,staffEventId=null,staffEventsReady=false;
async function loadStaffEvents(id){const generation=++eventGeneration,user=window._currentUserId;staffEventRows=[];staffEventsReady=false;staffEventId=id;staffEventUser=user;$('ops-staff-events').textContent='Cargando movimientos…';
 try{const rows=[];let last=null;for(;;){let q=window.sb.from('cp_staff_events').select('*').eq('employee_id',id).eq('user_id',user).order('id').limit(500);if(last)q=q.gt('id',last);const {data,error}=await q;if(error)throw error;rows.push(...data);if(data.length<500)break;last=data.at(-1).id;}
 if(generation!==eventGeneration||user!==window._currentUserId||_detalleEmpId!==id)return;
 staffEventRows=rows.sort((a,b)=>b.day.localeCompare(a.day));staffEventsReady=true;
 $('ops-staff-events').innerHTML=staffEventRows.map(r=>`<div class="cp-ops-event"><div><strong>${esc(r.day)} · ${esc(r.kind)}</strong><p>${esc(r.note||'')}${r.minutes?' · '+r.minutes+' min':''}</p></div><button class="btn-secondary" onclick="cpDeleteStaffEvent('${r.id}')">Eliminar</button></div>`).join('')||'<p class="cp-ops-note">Sin movimientos registrados.</p>';
 }catch(e){if(generation===eventGeneration&&user===window._currentUserId&&$('ops-staff-events'))$('ops-staff-events').textContent='No se pudo cargar el historial. Vuelve a abrir el expediente.';}}
window.cpSaveStaffEvent=async function(){if(eventBusy||!permission('manage_team')||!staffEventsReady||staffEventUser!==window._currentUserId||staffEventId!==_detalleEmpId)return;
 const id=_detalleEmpId,user=window._currentUserId,kind=val('ops-event-kind'),day=val('ops-event-day'),minutes=Number(val('ops-event-minutes')||0),note=val('ops-event-note');
 if(!day||!Number.isInteger(minutes)||minutes<0||minutes>1440){showToast('Revisa fecha y minutos','error');return;}
 eventBusy=true;$('ops-event-save').disabled=true;
 try{const {error}=await window.sb.from('cp_staff_events').insert({employee_id:id,user_id:user,kind,day,minutes:kind==='Retardo'?minutes:0,note});if(error)throw error;if(user===window._currentUserId&&id===_detalleEmpId){$('ops-event-note').value='';await loadStaffEvents(id);showToast('Movimiento registrado','success');}}
 catch(e){if(user===window._currentUserId)showToast('No se confirmó el movimiento. Revisa el historial antes de reintentar.','error');}
 finally{eventBusy=false;if($('ops-event-save'))$('ops-event-save').disabled=false;}
};
window.cpDeleteStaffEvent=async function(id){if(eventBusy||!permission('manage_team')||!confirm('¿Eliminar esta incidencia?'))return;const user=window._currentUserId,employee=_detalleEmpId;eventBusy=true;try{const {data,error}=await window.sb.from('cp_staff_events').delete().eq('id',id).eq('user_id',user).eq('employee_id',employee).select('id').maybeSingle();if(error||!data)throw error||Error('El movimiento cambió');if(user===window._currentUserId&&employee===_detalleEmpId)await loadStaffEvents(employee);}catch(e){fail(Error('No se pudo confirmar la eliminación'));}finally{eventBusy=false;}};
window.cpExportStaffEvents=function(){if(!staffEventsReady||staffEventUser!==window._currentUserId||staffEventId!==_detalleEmpId||!permission('manage_team'))return;downloadExcel('Incidencias_personal.xlsx','Incidencias',[['Empleado','Fecha','Tipo','Minutos','Detalle'],...staffEventRows.map(r=>[empleadosDB.find(e=>e.id===staffEventId)?.nombre||'',r.day,r.kind,r.minutes,r.note])]);};
window.cpExportarPersonal=function(){if(_empleadosEstado!=='listo'||!permission('manage_team'))return;downloadExcel('Empleados_CorePoint.xlsx','Personal',[['Número','Nombre','Departamento','Puesto','Estado','Ingreso','Baja','Contrato','Correo','Teléfono','Turno','Salario quincenal','Bono','Deducción','Neto estimado'],...empleadosDB.map(e=>[e.details?.code||'',e.nombre,e.details?.department||'',e.rol,e.status,e.details?.hired||'',e.details?.ended||'',e.details?.contract||'',e.details?.email||'',e.telefono,e.turno,Number(e.salario),Number(e.bono),Number(e.deduccion),netoEmpleado(e)])]);};
let reportUser=null,reportState='idle',reportVersion=0,reportSales=[],reportItems=[],reportReturns=[],reportPage=0,reportUpdated='';
document.querySelector('.reports-topbar').insertAdjacentHTML('afterend',`<div class="cp-ops-toolbar"><label>Desde <input type="date" id="ops-report-from"></label><label>Hasta <input type="date" id="ops-report-to"></label><input id="ops-report-search" placeholder="Buscar en el reporte" aria-label="Buscar en reporte"><button class="btn-secondary" onclick="cpRefreshReports()">Actualizar fuentes</button><button class="btn-secondary" onclick="cpReportPDF()">Descargar PDF</button></div><div id="ops-report-source" class="cp-ops-note" role="status"></div><div id="ops-report-summary" class="cp-ops-metrics"></div>`);
['ops-report-from','ops-report-to','ops-report-search'].forEach(id=>$(id).addEventListener('input',()=>{reportPage=0;renderCurrentReport();}));
const previousPeriod=setRptPeriod;window.setRptPeriod=function(p,el){$('ops-report-from').value='';$('ops-report-to').value='';reportPage=0;previousPeriod(p,el);};
async function readReportTable(table,user){let last=null,rows=[];for(;;){let q=window.sb.from(table).select('*').eq('user_id',user).order('id').limit(500);if(last!==null)q=q.gt('id',last);const {data,error}=await q;if(error)throw error;rows.push(...data);if(data.length<500)return rows;if(last===data.at(-1).id)throw Error('No se pudo completar la carga');last=data.at(-1).id;}}
window.cpRefreshReports=async function(){if(reportState==='loading'&&reportUser===window._currentUserId)return;const user=window._currentUserId,version=++reportVersion;reportUser=user;reportState='loading';reportSales=[];reportPage=0;renderCurrentReport();if(!user)return;
 try{const [tickets,sales,items,returns]=await Promise.all([readReportTable('tickets',user),readReportTable('cp_sales',user),readReportTable('cp_sale_items',user),readReportTable('cp_return_items',user),cargarGastos()]);if(user!==window._currentUserId||version!==reportVersion)return;reportSales=CPBusiness.sales(tickets,sales);reportItems=items;reportReturns=returns;reportState='ready';reportUpdated=new Date().toLocaleString('es-MX');}
 catch(e){if(user!==window._currentUserId||version!==reportVersion)return;reportState='error';reportSales=[];console.error('Fuentes de reportes:',e);}
 renderCurrentReport();
};
function reportRange(){const day=today(),from=val('ops-report-from'),to=val('ops-report-to');if(from||to)return {from,to};let start=day;if(rptPeriod==='semana'){const d=new Date();d.setDate(d.getDate()-6);start=fechaLocalNomina(d);}if(rptPeriod==='mes')start=day.slice(0,7)+'-01';return {from:rptPeriod==='todo'?'':start,to:rptPeriod==='todo'?'':day};}
function inRange(date,r=reportRange()){return !!date&&(!r.from||date>=r.from)&&(!r.to||date<=r.to);}
const salesDay=s=>{const d=new Date(s.created_at);return Number.isNaN(d.getTime())?'':fechaLocalNomina(d);};
function salesInRange(){const q=val('ops-report-search').toLowerCase(),productSales=currentReport==='productos'&&q?new Set(reportItems.filter(i=>`${i.name} ${i.sku||''}`.toLowerCase().includes(q)).map(i=>'sale:'+i.sale_id)):null;return reportSales.filter(s=>inRange(salesDay(s))&&(!q||(productSales?productSales.has(s.id):`${s.cliente} ${s.concepto} ${s.metodoPago}`.toLowerCase().includes(q))));}
window.getRptPeriodData=salesInRange;
window.gastosPeriodoReporte=function(){const q=val('ops-report-search').toLowerCase();return gastosDB.filter(g=>inRange(g.fecha)&&(!q||`${g.descripcion} ${g.proveedor} ${g.categoria}`.toLowerCase().includes(q)));};
function reportDataset(){const sales=salesInRange();
 if(currentReport==='gastos-rpt')return {title:'Control de gastos',headers:['Fecha','Descripción','Categoría','Proveedor','Estado','Monto MXN'],rows:gastosPeriodoReporte().map(g=>[g.fecha,g.descripcion,g.categoria,g.proveedor,g.details?.paymentStatus||'Pagado',Number(g.monto)])};
 if(currentReport==='productos'){
  const included=new Set(sales.map(s=>s.id)),groups=new Map();
  for(const item of reportItems){if(!included.has('sale:'+item.sale_id))continue;const q=val('ops-report-search').toLowerCase();if(q&&!`${item.name} ${item.sku||''}`.toLowerCase().includes(q))continue;const key=item.product_id||item.sku||item.name;if(!groups.has(key))groups.set(key,{sku:item.sku||'',name:item.name||'Sin nombre',qty:0,returned:0,gross:0,refund:0});const g=groups.get(key);g.qty+=Number(item.quantity)||0;g.returned+=Number(item.returned_quantity)||0;g.gross+=Number(item.line_total)||0;g.refund+=reportReturns.filter(r=>r.sale_item_id===item.id).reduce((a,r)=>a+Number(r.line_refund||0),0);}
  return {title:'Productos vendidos por SKU',headers:['SKU','Producto','Unidades vendidas','Devueltas','Importe de partidas MXN','Reembolsos MXN'],rows:[...groups.values()].sort((a,b)=>b.gross-a.gross).map(g=>[g.sku,g.name,CPBusiness.round(g.qty),CPBusiness.round(g.returned),CPBusiness.round(g.gross),CPBusiness.round(g.refund)])};
 }
 if(currentReport==='clientes'){
  const groups=new Map();for(const s of sales){const label=currentReport==='clientes'?(s.cliente||'Sin nombre'):(s.concepto||'Sin concepto'),key=currentReport==='clientes'?(s.telefono||label.toLowerCase()):label;if(!groups.has(key))groups.set(key,{label,phone:s.telefono||'',count:0,net:0,last:''});const g=groups.get(key);g.count++;g.net+=s.monto;g.last=g.last>salesDay(s)?g.last:salesDay(s);}
  const rows=[...groups.values()].sort((a,b)=>b.net-a.net);
  return currentReport==='clientes'?{title:'Compras por cliente',headers:['Cliente','Teléfono','Transacciones','Última compra','Venta neta MXN'],rows:rows.map(g=>[g.label,g.phone,g.count,g.last,CPBusiness.round(g.net)])}:{title:'Conceptos de venta',headers:['Concepto','Transacciones','Venta neta MXN'],rows:rows.map(g=>[g.label,g.count,CPBusiness.round(g.net)])};
 }
 return {title:'Ventas y devoluciones',headers:['Fecha','Cliente','Concepto','Método','Origen','Bruto MXN','Devolución MXN','Neto MXN'],rows:sales.map(s=>[salesDay(s),s.cliente,s.concepto,s.metodoPago,s.fuente,s.bruto,s.devoluciones,s.monto])};
}
window.renderCurrentReport=function(){
 const section=$('rpt-'+currentReport);if(!section)return;
 if(reportUser!==window._currentUserId){reportSales=[];reportState='idle';reportUser=window._currentUserId;}
 if(reportState==='idle'&&window._currentUserId){cpRefreshReports();return;}
 if(reportState!=='ready'){$('ops-report-summary').innerHTML='';$('ops-report-source').textContent=reportState==='error'?'No se pudieron cargar las fuentes. Usa Actualizar fuentes.':'Cargando ventas POS, tickets y gastos…';section.innerHTML='<div class="cp-ops-empty">Reporte no disponible hasta completar la carga.</div>';return;}
 const range=reportRange();if(range.from&&range.to&&range.from>range.to){$('ops-report-summary').innerHTML='';section.innerHTML='<div class="cp-ops-empty">La fecha inicial debe ser anterior a la final.</div>';return;}
 const sales=salesInRange(),sum=(rows,key)=>CPBusiness.round(rows.reduce((a,s)=>a+Number(s[key]||0),0));
 const paid=_gastosEstado==='listo'?gastosDB.filter(g=>g.details?.paymentStatus!=='Pendiente'&&inRange(g.details?.paidOn||g.fecha)):null;
 const pending=_gastosEstado==='listo'?gastosDB.filter(g=>g.details?.paymentStatus==='Pendiente'&&inRange(g.fecha)):null;
 $('ops-report-source').textContent=`Fuentes: ventas POS + tickets históricos sin vínculo duplicado. Actualizado: ${reportUpdated}. Devoluciones atribuidas a la fecha de la venta. ${_gastosEstado!=='listo'?'Gastos no disponibles.':''}`;
 const net=sum(sales,'monto');
 $('ops-report-summary').innerHTML=card('Ventas netas',money(net),sales.length+' transacciones')+card('Devoluciones',money(sum(sales,'devoluciones')),'Descontadas de las ventas')+card('Gastos pagados',paid?money(sum(paid,'monto')):'No disponible','Según fecha de pago')+card('Balance administrativo',paid?money(net-sum(paid,'monto')):'No disponible','Ventas netas menos gastos pagados')+card('Por pagar',pending?money(sum(pending,'monto')):'No disponible','Gastos registrados en el periodo');
 const dataset=reportDataset(),totalPages=Math.max(1,Math.ceil(dataset.rows.length/100));reportPage=Math.min(reportPage,totalPages-1);
 const currentRows=dataset.rows.slice(reportPage*100,(reportPage+1)*100);
 const grouped={};sales.forEach(s=>{const day=salesDay(s);grouped[day]=(grouped[day]||0)+s.monto;});const daily=Object.entries(grouped).sort((a,b)=>a[0].localeCompare(b[0])).slice(-14),max=Math.max(1,...daily.map(x=>x[1]));
 section.innerHTML=`<div class="cp-ops-panel"><h2>${dataset.title}</h2><p class="cp-ops-note">${esc(range.from||'Inicio del historial')} a ${esc(range.to||'Último registro')} · ${dataset.rows.length} filas. Las cotizaciones no son ingresos. El balance no representa utilidad contable ni saldo bancario.</p>${currentReport==='productos'?'<p class="cp-ops-note">Solo ventas con partidas guardadas. Los tickets sin desglose no aportan unidades. Importes de partidas y reembolsos registrados; los descuentos globales pueden pertenecer a la venta completa.</p>':''}${currentReport==='ventas'?`<div class="cp-report-bars">${daily.map(([d,n])=>`<div><span>${esc(d.slice(5))}</span><i style="height:${Math.max(2,n/max*100)}px"></i><small>${money(n)}</small></div>`).join('')}</div><p class="cp-ops-note">Últimos 14 días con ventas del periodo seleccionado.</p>`:''}<div class="cp-ops-table-wrap"><table class="rpt-table"><thead><tr>${dataset.headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${currentRows.map(row=>`<tr>${row.map(c=>`<td>${esc(typeof c==='number'?c.toLocaleString('es-MX',{maximumFractionDigits:2}):c||'—')}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${dataset.headers.length}">Sin registros para los filtros.</td></tr>`}</tbody></table></div><div class="cp-ops-toolbar"><button class="btn-secondary" onclick="cpReportPage(-1)" ${reportPage===0?'disabled':''}>Anterior</button><span>Página ${reportPage+1} de ${totalPages}</span><button class="btn-secondary" onclick="cpReportPage(1)" ${reportPage===totalPages-1?'disabled':''}>Siguiente</button><button class="btn-primary" onclick="exportarReporteActualExcel()">Exportar todas las filas filtradas</button></div></div>`;
};
window.cpReportPage=function(delta){reportPage=Math.max(0,reportPage+delta);renderCurrentReport();};
window.exportarReporteActualExcel=function(){if(reportState!=='ready'||reportUser!==window._currentUserId)return;if(currentReport==='gastos-rpt'&&_gastosEstado!=='listo')return;const d=reportDataset();downloadExcel('Reporte_CorePoint.xlsx','Reporte',[d.headers,...d.rows]);};
window.cpReportPDF=async function(){if(reportState!=='ready'||reportUser!==window._currentUserId)return;if(currentReport==='gastos-rpt'&&_gastosEstado!=='listo')return;const d=reportDataset(),range=reportRange();await savePDF({kind:'report',business:business(),title:d.title,subtitle:`Periodo: ${range.from||'Inicio'} a ${range.to||'Último registro'}`,headers:d.headers,rows:d.rows,note:'Ventas POS y tickets sin vínculo duplicado. Devoluciones atribuidas a la fecha de venta. Balance administrativo, no utilidad contable.'});};
function business(){const c=cargarConfig();return {name:c.nombreNegocio||'',address:c.direccion||'',city:c.ciudad||'',rfc:c.rfc||'',phone:c.whatsapp||''};}
async function savePDF(data){try{if(!data.business.name)throw Error('Configura el nombre del negocio antes de generar el PDF');if(!window.cpDocuments?.savePdf)throw Error('La descarga directa de PDF está disponible en la app de escritorio actualizada');const response=await window.cpDocuments.savePdf(data);if(response?.saved)showToast('PDF guardado','success');else if(response?.error)throw Error(response.error);}catch(e){fail(e);}}
window.cpImprimirCotizacion=async function(id){if(!permission('quotes'))return;const c=cotizacionesDB.find(x=>x.id===id);if(!c)return;await savePDF({kind:'quote',business:c.details?.business||business(),quote:c});};
const resetOps=window.cpResetCommercialEditors;window.cpResetCommercialEditors=function(){resetOps?.();++eventGeneration;++reportVersion;reportUser=null;reportState='idle';reportSales=[];staffEventRows=[];staffEventsReady=false;staffEventUser=null;staffEventId=null;for(const map of [staffMap,expenseMap,appointmentMap,quoteMap])Object.values(map).forEach(id=>$(id).value='');$('ops-cot-lines').innerHTML='';$('ops-cot-itemized').checked=false;$('ops-report-source').textContent='';$('ops-report-summary').innerHTML='';document.querySelectorAll('.report-section').forEach(s=>s.innerHTML='');$('modal-gasto-overlay').classList.remove('open');};
for(const [key,names] of Object.entries({manage_team:['abrirNuevoEmpleado','guardarEmpleado','verDetalleEmpleado','eliminarEmpleado','abrirPagoNomina','guardarPagoNomina'],expenses:['abrirNuevoGasto','guardarGasto','eliminarGasto','exportarGastosExcel'],schedule:['abrirNuevaCita','guardarCita','eliminarCita','toggleCitaHecho','cpExportAgenda'],quotes:['abrirNuevaCotizacion','guardarCotizacion','eliminarCot'],reports:['cpRefreshReports','exportarReporteActualExcel','cpReportPDF']}))for(const name of names){const original=window[name];window[name]=function(...args){if(!permission(key))return;return original.apply(this,args);};}
})();
