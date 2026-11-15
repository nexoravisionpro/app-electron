const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),pkg=require('../package.json');
assert.equal(pkg.main,'main.js');
assert.equal(pkg.build.appId,'com.nexoravisionpro.corepoint');
const html=fs.readFileSync(path.join(root,'Facture01.html'),'utf8');
for(const marker of ['window.cpLoadCRM','cp_crm_contacts','cp_crm_calls','cp_crm_campaigns','id="login-overlay"','id="view-crm"'])assert(html.includes(marker),marker);
assert(!html.includes('window.cpDesignPreview=true'),'No empaquetar vista ficticia');
let scripts=0;
for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
 if(/\bsrc\s*=|\btype\s*=\s*["'](?:application\/ld\+json|application\/json)/i.test(match[1]))continue;
 new vm.Script(match[2],{filename:'Facture01-inline-'+(++scripts)});
}
new vm.Script(fs.readFileSync(path.join(root,'main.js'),'utf8'),{filename:'main.js'});
for(const file of ['preload.cjs','operations.js','business-math.js','business-pdf.cjs','management.js'])new vm.Script(fs.readFileSync(path.join(root,file),'utf8'),{filename:file});
for(const file of ['preload.cjs','operations.js','operations.css','business-math.js','business-pdf.cjs','management.js','management.css'])assert(pkg.build.files.includes(file),'Incluir '+file+' en el instalador');
assert(scripts>0);console.log('SOURCE_OK '+JSON.stringify({version:pkg.version,scripts}));
