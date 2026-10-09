'use strict';
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const root = __dirname, windows = process.env.SystemRoot || 'C:\\Windows';
const candidates = ['Framework64','Framework'].map(arch => path.join(windows,'Microsoft.NET',arch,'v4.0.30319','csc.exe'));
const compiler = candidates.find(file => fs.existsSync(file));
if (!compiler) throw new Error('Windows .NET Framework compiler unavailable; keep the existing release launcher.');
cp.execFileSync(compiler, ['/nologo','/target:winexe','/optimize+','/platform:anycpu',
  '/win32icon:' + path.join(root,'icons','qPCR Plate Planner.ico'),
  '/out:' + path.join(root,'qPCR Plate Planner.exe'), '/reference:System.Windows.Forms.dll', path.join(root,'launcher.cs')],
  { cwd:root, windowsHide:true, stdio:'inherit' });
cp.execFileSync(path.join(root,'qPCR Plate Planner.exe'), ['--self-test'], { cwd:root, windowsHide:true });
console.log('Portable launcher compiled with the qPCR icon; self-test passed.');
