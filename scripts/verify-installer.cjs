const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),asar=require('@electron/asar');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist');
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)])}
const files=walk(dist),archives=files.filter(p=>p.endsWith(path.join('resources','app.asar'))||p.endsWith(path.join('Resources','app.asar')));
assert.equal(archives.length,1,'Debe existir un solo paquete por plataforma');
const archive=archives[0],expected=fs.readFileSync(path.join(root,'Facture01.html')),actual=asar.extractFile(archive,'Facture01.html');assert(expected.equals(actual),'El HTML empaquetado debe coincidir con el revisado');
const pkg=JSON.parse(asar.extractFile(archive,'package.json'));assert.equal(pkg.version,require('../package.json').version);assert(asar.extractFile(archive,'main.js').length>0);
for(const forbidden of ['api_nexora.php','BancoNuevo.html','Fortis Capital.html'])assert(!asar.listPackage(archive).includes('/'+forbidden),'Archivo ajeno al producto');
const installers=fs.readdirSync(dist).filter(p=>/\.(exe|dmg)$/.test(p));assert.equal(installers.length,1,'Debe existir un instalador por trabajo');
const name=installers[0],binary=fs.readFileSync(path.join(dist,name));assert(binary.length>1000000);if(name.endsWith('.exe'))assert.equal(binary.subarray(0,2).toString(),'MZ');
const sha256=crypto.createHash('sha256').update(binary).digest('hex');fs.writeFileSync(path.join(dist,name+'.sha256'),sha256+'  '+name+'\n');
fs.writeFileSync(path.join(root,'packaged-app-path.txt'),archive);
const report={version:pkg.version,platform:process.platform,arch:process.arch,sourceCommit:process.env.GITHUB_SHA||null,htmlSha256:crypto.createHash('sha256').update(actual).digest('hex'),installer:name,installerSha256:sha256,installerBytes:binary.length,sourceMatches:true,commercialValidation:'pending',publisherCertificate:false};
fs.writeFileSync(path.join(dist,'verificacion-'+process.platform+'-'+process.arch+'.json'),JSON.stringify(report,null,2));console.log('PACKAGE_OK '+JSON.stringify(report));
