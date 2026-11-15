const assert=require('node:assert/strict'),m=require('../business-math.js');
assert.equal(m.quote([{description:'Servicio',qty:2,price:100}],10,16).total,220.4);
assert.throws(()=>m.quote([{description:'',qty:1,price:10}]));assert.throws(()=>m.quote([{description:'A',qty:1,price:10}],11));assert.throws(()=>m.quote([{description:'A',qty:Infinity,price:10}]));
const s=m.sales([{id:1,monto:200},{id:2,monto:50}],[{id:'a',legacy_ticket_id:1,total:200,status:'partially_refunded',refunded_total:20}]);assert.equal(s.length,2);assert.equal(s.reduce((a,r)=>a+r.monto,0),230);
assert.equal(m.sales([{id:1,monto:100}],[{id:'a',legacy_ticket_id:1,total:100,status:'cancelled'}]).length,0);
const a={id:'a',fecha:'2026-11-15',hora:'23:30',details:{responsable:'Ana',duracion:60}},b={id:'b',fecha:'2026-11-16',hora:'00:00',details:{responsable:'ana',duracion:30}};
assert(m.overlap(a,b));assert(!m.overlap(a,{...b,details:{...b.details,responsable:'Otro'}}));assert(!m.overlap(a,{...b,hecho:true}));assert(!m.overlap(a,{...b,details:{...b.details,status:'cancelada'}}));
console.log('MATH_OK: totals, invalid inputs, exact dedup, refunds/cancellation and midnight overlaps');
