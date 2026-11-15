const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');const {JSDOM}=require(process.env.JSDOM_PATH||'/tmp/cp-ops-tests/node_modules/jsdom');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'Facture01.html'),'utf8');
const dom=new JSDOM(html,{url:'https://corepoint.test',runScripts:'outside-only'}),w=dom.window,ctx=dom.getInternalVMContext(),notices=[];
w.matchMedia=()=>({matches:false,addEventListener(){}});w.setTimeout=()=>0;w.setInterval=()=>0;w.requestAnimationFrame=()=>0;w.confirm=()=>true;w.TextEncoder=TextEncoder;w.URL.createObjectURL=()=>'';w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=function(){};w.showToast=(...x)=>notices.push(x);w.cpRequirePermission=()=>true;
const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];for(const i of [5,6,18])vm.runInContext(scripts[i][2],ctx,{filename:'inline-'+i});
w.showToast=(...x)=>notices.push(x);w.cpRequirePermission=()=>true;w._currentUserId='owner-a';w._cfgNegocio={nombreNegocio:'Comercial del Centro',direccion:'Av. Central 25',rfc:'AAA010101AAA'};
const state={queries:[],tables:{},gate:null};
class Query{constructor(table){this.table=table;this.op='select';this.filters=[];this.payload=null;this.single=false;this.cap=Infinity;}select(){return this}eq(k,v){this.filters.push(r=>r[k]===v);return this}is(k,v){return this.eq(k,v)}gt(k,v){this.filters.push(r=>r[k]>v);return this}limit(n){this.cap=n;return this}order(){return this}range(){return this}maybeSingle(){this.single=true;return this}insert(v){this.op='insert';this.payload=v;return this}update(v){this.op='update';this.payload=v;return this}delete(){this.op='delete';return this}then(a,b){return this.run().then(a,b)}async run(){state.queries.push(this);if(state.gate)await state.gate;let rows=(state.tables[this.table]||[]).filter(r=>this.filters.every(f=>f(r))).slice(0,this.cap);if(this.op==='insert')rows=[{id:'saved',...Array.isArray(this.payload)?this.payload[0]:this.payload}];if(this.op==='update')rows=rows.map(r=>({...r,...this.payload}));return {data:this.single?rows[0]||null:rows,error:null};}}
w.sb={from:t=>new Query(t)};
for(const name of ['business-math.js','operations.js'])vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),ctx,{filename:name});
const run=s=>vm.runInContext(s,ctx),el=id=>w.document.getElementById(id),set=(id,v)=>el(id).value=v;

vm.runInContext(fs.readFileSync(path.join(root,"management.js"),"utf8"),ctx,{filename:"management.js"});

w.cpCanOpenView=()=>true;w.cpHasPermission=()=>true;w.cpIsOperationalSession=()=>true;
(async()=>{
w.cpOpenManagement('home');
assert(el('view-gestion').classList.contains('active'),'El router debe activar la vista de gestión al abrir el módulo');
assert.notEqual(w.getComputedStyle(el('view-gestion')).display,'none','La vista de gestión debe estar visible');
for(let i=0;i<15;i++)await new Promise(r=>setImmediate(r));
assert(el('mgmt-content').textContent.trim(),'Debe haber contenido visible o estado de carga');
w.switchView('agenda');assert(el('view-agenda').classList.contains('active'));assert(!el('view-gestion').classList.contains('active'),'Gestión debe ocultarse al salir');
w.cpOpenManagement('suppliers');for(let i=0;i<15;i++)await new Promise(r=>setImmediate(r));assert(el('view-gestion').classList.contains('active'));assert(el('mgmt-content').textContent.includes('Proveedores'));
const custom=w.document.createElement('div');custom.className='view';custom.id='view-qa-navigation';el('view-gestion').parentElement.append(custom);w._switchViewReal('qa-navigation');assert(custom.classList.contains('active'),'El router debe admitir módulos añadidos sin listas desactualizadas');assert(!el('view-gestion').classList.contains('active'));assert.equal(w._switchViewReal('no-existe'),false);assert(custom.classList.contains('active'),'Una ruta inexistente no debe dejar la app vacía');
console.log('NAVIGATION_OK: router real, gestión visible, salida/retorno y módulos dinámicos');dom.window.close();
})().catch(e=>{console.error(e);dom.window.close();process.exit(1)});
