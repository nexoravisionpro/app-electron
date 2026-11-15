'use strict';
const PDFDocument=require('pdfkit');
const path=require('node:path');
const math=require('./business-math.js');
const clean=(v,max=4000)=>String(v??'').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').slice(0,max);
const money=n=>'$'+Number(n||0).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2});
function createBusinessPDF(input){
 if(!input||!['quote','report'].includes(input.kind)||!clean(input.business?.name,200).trim())throw Error('Falta el nombre del negocio');
 if(JSON.stringify(input).length>6000000)throw Error('El documento es demasiado grande');
 const doc=new PDFDocument({size:'A4',layout:input.kind==='report'&&input.headers?.length>5?'landscape':'portrait',margin:45,bufferPages:true,info:{Title:input.kind==='quote'?'Cotización':'Reporte administrativo',Author:clean(input.business.name,200)}});
 doc.registerFont('CoreRegular',path.join(__dirname,'fonts','DejaVuSans.ttf'));doc.registerFont('CoreBold',path.join(__dirname,'fonts','DejaVuSans-Bold.ttf'));
 const chunks=[];const result=new Promise((resolve,reject)=>{doc.on('data',c=>chunks.push(c));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);});
 const brand=input.business,W=doc.page.width-90,bottom=doc.page.height-70;let y=0;
 function header(){doc.save().rect(0,0,doc.page.width,9).fill('#1C4ED8').restore();doc.font('CoreBold').fontSize(20).fillColor('#17243B');doc.text(clean(brand.name,200),45,35,{width:W});y=doc.y+8;doc.font('CoreRegular').fontSize(9).fillColor('#56657A');for(const line of [brand.address,[brand.city,brand.rfc&&'RFC: '+brand.rfc].filter(Boolean).join(' · '),brand.phone&&'Tel. '+brand.phone]){if(line){doc.text(clean(line,400),45,y,{width:W});y=doc.y+3;}}y+=12;doc.strokeColor('#DAE2EF').moveTo(45,y).lineTo(45+W,y).stroke();y+=16;}
 function page(){doc.addPage();header();}
 function ensure(h){if(y+h>bottom)page();}
 function paragraph(label,text){if(!text)return;const value=clean(text);doc.font('CoreRegular').fontSize(10);let lines=doc.heightOfString(value,{width:W});if(lines>400){const words=value.match(/.{1,300}/gs)||[];for(let i=0;i<words.length;i++)paragraph(i===0?label:'Continuación',words[i]);return;}ensure(lines+34);doc.font('CoreBold').fillColor('#17243B').fontSize(9).text(label,45,y);y=doc.y+5;doc.font('CoreRegular').fontSize(10).fillColor('#45546B').text(value,45,y,{width:W});y=doc.y+13;}
 function table(headers,rows,widths){
  const tableHead=()=>{doc.font('CoreBold').fontSize(8);const h=Math.max(28,...headers.map((v,i)=>doc.heightOfString(clean(v,80),{width:widths[i]-12})+16));ensure(h);doc.rect(45,y,W,h).fill('#EDF2FA');let x=45;headers.forEach((v,i)=>{doc.fillColor('#273B5B').text(clean(v,80),x+6,y+8,{width:widths[i]-12});x+=widths[i];});y+=h;};
  function chunksFor(text,width){let rest=clean(text),parts=[];doc.font('CoreRegular').fontSize(9);while(rest){let lo=1,hi=rest.length,best=1;while(lo<=hi){const mid=Math.floor((lo+hi)/2);if(doc.heightOfString(rest.slice(0,mid),{width})<=280){best=mid;lo=mid+1;}else hi=mid-1;}parts.push(rest.slice(0,best));rest=rest.slice(best);}return parts.length?parts:[''];}
  tableHead();for(const cells of rows){const parts=cells.map((c,i)=>chunksFor(c,widths[i]-12)),segments=Math.max(...parts.map(p=>p.length));for(let n=0;n<segments;n++){const values=parts.map(p=>p[n]||'');doc.font('CoreRegular').fontSize(9);const h=Math.max(28,...values.map((c,i)=>doc.heightOfString(c,{width:widths[i]-12})+16));if(y+h>bottom){page();tableHead();}let x=45;values.forEach((c,i)=>{doc.font('CoreRegular').fontSize(9).fillColor('#26384F').text(c,x+6,y+8,{width:widths[i]-12});x+=widths[i];});y+=h;doc.strokeColor('#E3E9F2').moveTo(45,y).lineTo(45+W,y).stroke();}}y+=18;
 }
 try{
 header();
 if(input.kind==='quote'){
  const q=input.quote||{},d=q.details||{},amount=Number(q.monto);if(!Number.isFinite(amount)||amount<=0)throw Error('Importe de cotización inválido');
  const calc=d.items?.length?math.quote(d.items,d.discount,d.tax):null;
  if(calc&&Math.abs(calc.total-amount)>.005)throw Error('Las partidas no coinciden con el total guardado');
  doc.font('CoreBold').fontSize(25).fillColor('#1C4ED8').text('COTIZACIÓN',45,y);y=doc.y+10;
  paragraph('Folio / emisión',`${clean(q.id,80)}\nEmitida: ${clean(q.created_at,10)}${q.validez?' · Vigencia: '+clean(q.validez,20):''}`);
  paragraph('Preparada para',`${clean(q.cliente,200)}${q.telefono?'\nTel. '+clean(q.telefono,40):''}${d.email?'\n'+clean(d.email,200):''}${d.address?'\n'+clean(d.address,500):''}${d.rfc?'\nRFC: '+clean(d.rfc,30):''}`);
  paragraph('Concepto',q.concepto);
  const items=calc?calc.items:[{description:q.concepto,qty:1,price:amount,total:amount}];
  table(['Descripción','Cantidad','P. unitario','Importe'],items.map(i=>[i.description,i.qty,money(i.price),money(i.total)]),[W-214,54,80,80]);
  const totals=calc?[['Subtotal',calc.subtotal],['Descuento',-calc.discount],[`Impuesto (${calc.tax}%)`,calc.taxAmount],['TOTAL MXN',calc.total]]:[['TOTAL MXN',amount]];
  ensure(totals.length*23+20);for(const [label,value] of totals){doc.font(label==='TOTAL MXN'?'CoreBold':'CoreRegular').fontSize(label==='TOTAL MXN'?13:10).fillColor('#17243B').text(label,250,y,{width:140}).text(money(value),390,y,{width:W-345,align:'right'});y+=23;}y+=15;
  paragraph('Condiciones de pago y entrega',d.terms);paragraph('Notas',q.notas);paragraph('Estado del documento',q.estado||'pendiente');paragraph('Información del documento','Esta cotización no constituye un CFDI ni un comprobante de pago. Su aceptación no registra un cobro automáticamente.');
 }else{
  if(!Array.isArray(input.headers)||input.headers.length<1||input.headers.length>10||!Array.isArray(input.rows)||input.rows.length>10000)throw Error('Reporte inválido o superior a 10,000 filas');
  doc.font('CoreBold').fontSize(21).fillColor('#1C4ED8').text(clean(input.title,200),45,y,{width:W});y=doc.y+16;paragraph('Periodo',input.subtitle);paragraph('Alcance',input.note);
  table(input.headers,input.rows.map(r=>r.map(c=>typeof c==='number'?c.toLocaleString('es-MX',{maximumFractionDigits:2}):c)),input.headers.map(()=>W/input.headers.length));
 }
 const pages=doc.bufferedPageRange();for(let i=0;i<pages.count;i++){doc.switchToPage(i);const oldBottom=doc.page.margins.bottom;doc.page.margins.bottom=0;doc.font('CoreRegular').fontSize(8).fillColor('#7A8799').text(`Documento generado en Core Point · Página ${i+1} de ${pages.count}`,45,doc.page.height-40,{width:W,align:'center',lineBreak:false});doc.page.margins.bottom=oldBottom;}
 doc.end();return result;
 }catch(error){doc.destroy();throw error;}
}
module.exports={createBusinessPDF};
