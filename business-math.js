(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CPBusiness=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const round=n=>Math.round((Number(n)+Number.EPSILON)*100)/100;
  function quote(lines,discount=0,tax=0){
    if(!Array.isArray(lines)||!lines.length||lines.length>100)throw Error('Agrega entre 1 y 100 partidas');
    const items=lines.map(l=>{
      const description=String(l.description||'').trim(),qty=Number(l.qty),price=Number(l.price);
      if(!description||description.length>600||!Number.isFinite(qty)||qty<=0||qty>1000000||!Number.isFinite(price)||price<0||price>999999999||Math.abs(price*100-Math.round(price*100))>.00001)throw Error('Revisa descripción, cantidad y precio de las partidas');
      return {description,qty,price,total:round(qty*price)};
    });
    discount=Number(discount);tax=Number(tax);
    const subtotal=round(items.reduce((a,l)=>a+l.total,0));
    if(!Number.isFinite(discount)||discount<0||discount>subtotal||Math.abs(discount*100-Math.round(discount*100))>.00001||!Number.isFinite(tax)||tax<0||tax>100)throw Error('Revisa descuento e impuesto');
    const taxAmount=round((subtotal-discount)*tax/100),total=round(subtotal-discount+taxAmount);
    if(total<=0||total>999999999999.99)throw Error('El total debe ser mayor a cero y estar dentro del límite');
    return {items,subtotal,discount,tax,taxAmount,total};
  }
  function sales(tickets,modern){
    // Enlaces exactos: nunca unir dos compras por nombre, importe o proximidad horaria.
    const links=new Set(modern.filter(s=>s.legacy_ticket_id!=null).map(s=>String(s.legacy_ticket_id)));
    const rows=modern.filter(s=>['completed','partially_refunded','refunded'].includes(s.status)).map(s=>{
      const gross=Math.max(0,Number(s.total)||0),refund=s.status==='refunded'?gross:Math.min(gross,Math.max(0,Number(s.refunded_total)||0));
      return {id:'sale:'+s.id,cliente:s.customer_name,concepto:s.concept,telefono:s.phone,created_at:s.created_at,metodoPago:s.payment_method||'Sin dato',bruto:gross,devoluciones:refund,monto:round(gross-refund),fuente:'Ventas POS'};
    });
    tickets.filter(t=>!links.has(String(t.id))).forEach(t=>rows.push({...t,id:'ticket:'+t.id,bruto:Number(t.monto)||0,devoluciones:0,monto:Number(t.monto)||0,metodoPago:'Sin dato histórico',fuente:'Ticket histórico'}));
    return rows.sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
  }
  function overlap(a,b){
    if((a.id&&a.id===b.id)||a.hecho||b.hecho||a.details?.status==='cancelada'||b.details?.status==='cancelada'||!a.hora||!b.hora)return false;
    const resource=x=>String(x.details?.responsable||'').trim().toLowerCase();
    if(resource(a)!==resource(b))return false;
    const start=x=>Date.parse(x.fecha+'T00:00:00Z')/60000+Number(x.hora.slice(0,2))*60+Number(x.hora.slice(3,5));
    return start(a)<start(b)+Number(b.details?.duracion||30)&&start(b)<start(a)+Number(a.details?.duracion||30);
  }
  return {round,quote,sales,overlap};
});
