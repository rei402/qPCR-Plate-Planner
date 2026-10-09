'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = path.resolve(process.argv[2] || __dirname);
const manifest = JSON.parse(fs.readFileSync(path.join(root,'FREEZE-MANIFEST.json'),'utf8'));
let failed=0;
for(const file of manifest.files) {
  const target=path.resolve(root,file.path);
  if(!target.startsWith(root+path.sep)) throw Error('Invalid manifest path');
  const match=fs.existsSync(target)&&crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex')===file.sha256;
  if(!match) { console.error('CHANGED / MISSING '+file.path); failed++; }
}
console.log(`${manifest.files.length-failed}/${manifest.files.length} frozen files verified (v${manifest.version})`);
if(failed) process.exitCode=1;
