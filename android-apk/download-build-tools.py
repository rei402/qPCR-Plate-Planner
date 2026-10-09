from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import subprocess, hashlib, zipfile

root=Path(__file__).resolve().parent/'.tools'
size=59878107
checksum='af059bb67cf7786f45ee0db85e2d24985df1b4b6'
archive=root/'build-tools_r35_windows.zip'

def part(index):
    start=size*index//4;end=size*(index+1)//4-1
    filename=root/('build-tools.part'+str(index))
    if filename.exists() and filename.stat().st_size==end-start+1: return filename
    subprocess.run(['curl.exe','--fail','--location','--silent','--show-error','--retry','1','--max-time','180','--range',str(start)+'-'+str(end),'https://dl.google.com/android/repository/build-tools_r35_windows.zip','--output',str(filename)],check=True)
    if filename.stat().st_size!=end-start+1: raise RuntimeError('Unexpected range response size')
    print('Downloaded build-tools segment '+str(index+1)+'/4',flush=True)
    return filename

with ThreadPoolExecutor(max_workers=4) as pool: parts=list(pool.map(part,range(4)))
with archive.open('wb') as output:
    for filename in parts: output.write(filename.read_bytes())
if hashlib.sha1(archive.read_bytes()).hexdigest()!=checksum: raise RuntimeError('Google SDK checksum mismatch')
with zipfile.ZipFile(archive) as source:
    for entry in source.infolist():
        if not (root/entry.filename).resolve().is_relative_to(root.resolve()): raise RuntimeError('Invalid ZIP path')
    source.extractall(root)
print('Google build tools verified and extracted.',flush=True)
