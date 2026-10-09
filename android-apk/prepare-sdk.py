"""Download only the required Android tools from Google's SDK repository."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import hashlib, urllib.request, zipfile, time

root = Path(__file__).resolve().parent / '.tools'
root.mkdir(exist_ok=True)
packages = [
    ('build-tools_r35_windows.zip', 'af059bb67cf7786f45ee0db85e2d24985df1b4b6'),
    ('platform-35_r02.zip', '0bb560a90a7a2cbd0dd8348224d518b638fe7949'),
    ('platform-tools_r37.0.1-win.zip', 'e03e78b1d80b396f1c3358e31251cb31740e1110'),
]

def prepare(package):
    name, checksum = package
    archive = root / name
    if not archive.exists() or hashlib.sha1(archive.read_bytes()).hexdigest() != checksum:
        for attempt in range(3):
            try:
                with urllib.request.urlopen('https://dl.google.com/android/repository/' + name, timeout=90) as response, archive.open('wb') as target:
                    while chunk := response.read(1024 * 1024):
                        target.write(chunk)
                if hashlib.sha1(archive.read_bytes()).hexdigest() != checksum:
                    raise RuntimeError('SDK checksum mismatch: ' + name)
                break
            except Exception:
                if attempt == 2: raise
                time.sleep(1)
    with zipfile.ZipFile(archive) as source:
        for entry in source.infolist():
            destination = (root / entry.filename).resolve()
            if not destination.is_relative_to(root.resolve()): raise RuntimeError('Invalid archive path')
        source.extractall(root)
    print('Verified and extracted: ' + name, flush=True)

with ThreadPoolExecutor(max_workers=3) as executor:
    list(executor.map(prepare, packages))
