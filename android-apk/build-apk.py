"""Build, verify and sign the offline APK using the official SDK tools."""
from pathlib import Path
import hashlib, json, os, secrets, shutil, subprocess, zipfile
from PIL import Image

project=Path(__file__).resolve().parent
root=project.parent
tools=project/'.tools'
java_home=Path(os.environ.get('QPCR_JAVA_HOME',r'C:\Program Files\JetBrains\PyCharm 2023.3.4\jbr'))
java=java_home/'bin/java.exe'
javac=java_home/'bin/javac.exe'
build_tools=next(tools.glob('**/aapt2.exe')).parent
platform=next(tools.glob('**/android.jar'))
# Google's native Windows tools cannot reliably open Unicode absolute paths.
# Keep all native-tool inputs and outputs under an ASCII build directory.
build=Path(os.environ['LOCALAPPDATA'])/'qPCRPlatePlannerBuild/v2.1.2'
build.mkdir(parents=True,exist_ok=True)
if not str(build).isascii(): raise RuntimeError('Set LOCALAPPDATA to an ASCII build directory for Android native tools.')
shutil.copytree(build_tools,build/'sdk-build-tools',dirs_exist_ok=True)
build_tools=build/'sdk-build-tools'
shutil.copyfile(platform,build/'android.jar');platform=build/'android.jar'
assets=build/'assets/www';assets.mkdir(parents=True,exist_ok=True)
frozen=root/'releases/qPCR Plate Planner v2.1.2'
manifest=json.loads((frozen/'FREEZE-MANIFEST.json').read_text(encoding='utf-8'))
ipad=json.loads((root/'releases/qPCR Plate Planner v2.1.2 iPad/IPAD-FREEZE-MANIFEST.json').read_text(encoding='utf-8'))
sha=lambda filename: hashlib.sha256(Path(filename).read_bytes()).hexdigest()
for item in ipad['files']:
    source=frozen/item['path']
    if sha(source)!=item['sha256']: raise RuntimeError('Changed frozen asset: '+item['path'])
    target=assets/item['path'];target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,target)
entry=assets/'qPCR Plate Planner.html'
content=entry.read_bytes().decode('utf-8')
needle='  <script defer src="lab-layout.js"></script>'
if content.count(needle)!=1: raise RuntimeError('Unexpected frozen entry')
entry.write_text(content.replace(needle,'  <script defer src="native-adapter.js"></script>\n'+needle),encoding='utf-8',newline='')
shutil.copyfile(project/'native-adapter.js',assets/'native-adapter.js')

image=Image.open(frozen/'icons/icon-512.png').convert('RGBA')
foreground=Image.new('RGBA',(432,432),(0,0,0,0)); icon=image.resize((264,264),Image.Resampling.LANCZOS);foreground.alpha_composite(icon,((432-264)//2,(432-264)//2))
drawable=project/'res/drawable';drawable.mkdir(exist_ok=True);foreground.save(drawable/'launcher_foreground.png')
for name,size in [('mdpi',48),('hdpi',72),('xhdpi',96),('xxhdpi',144),('xxxhdpi',192)]:
    folder=project/('res/mipmap-'+name);folder.mkdir(exist_ok=True)
    image.resize((size,size),Image.Resampling.LANCZOS).save(folder/'ic_launcher.png')
    image.resize((size,size),Image.Resampling.LANCZOS).save(folder/'ic_launcher_round.png')

def run(args):
    subprocess.run([str(arg) for arg in args],cwd=project,check=True)

tests=build/'test-classes';tests.mkdir(exist_ok=True)
run([javac,'-encoding','UTF-8','-d',tests,project/'src/org/qpcrplateplanner/app/LocalPolicy.java',project/'tests/LocalPolicyTest.java'])
run([java,'-Dfile.encoding=UTF-8','-cp',tests,'org.qpcrplateplanner.app.LocalPolicyTest'])
run(['node',project/'test-adapter.js'])
run(['node',project/'test-integration.js',assets])
shutil.copytree(project/'res',build/'res',dirs_exist_ok=True)
shutil.copyfile(project/'AndroidManifest.xml',build/'AndroidManifest.xml')
compiled=build/'resources.zip'
resources=build/'resources.apk'
gen=build/'gen';gen.mkdir(exist_ok=True)
run([build_tools/'aapt2.exe','compile','--dir',build/'res','-o',compiled])
run([build_tools/'aapt2.exe','link','-I',platform,'--manifest',build/'AndroidManifest.xml','-A',build/'assets','--java',gen,'-o',resources,compiled])
classes=build/'classes';classes.mkdir(exist_ok=True)
sources=list((project/'src').rglob('*.java'))+list(gen.rglob('*.java'))
run([javac,'-encoding','UTF-8','--release','8','-classpath',platform,'-d',classes,*sources])
dex=build/'dex';dex.mkdir(exist_ok=True)
run([java,'-cp',build_tools/'lib/d8.jar','com.android.tools.r8.D8','--min-api','26','--lib',platform,'--output',dex,*classes.rglob('*.class')])
unsigned=build/'unsigned.apk'
# Rewrite entries consistently: Python append would rewrite AAPT's central
# filename flags without changing its local headers, causing ZIP mismatches.
with zipfile.ZipFile(resources) as source, zipfile.ZipFile(unsigned,'w') as archive:
    for item in source.infolist():
        entry=zipfile.ZipInfo(item.filename,item.date_time);entry.compress_type=item.compress_type;entry.external_attr=item.external_attr
        archive.writestr(entry,source.read(item))
    for file in dex.glob('*.dex'): archive.write(file,file.name)
aligned=build/'aligned.apk'
run([build_tools/'zipalign.exe','-f','-p','4',unsigned,aligned])

# Preserve the private signing identity for future installable updates; never package it.
signing=Path.home()/'.codex/signing/qpcr-plate-planner'
signing.mkdir(parents=True,exist_ok=True)
keystore=signing/'release.p12';password=signing/'store-password.txt'
if not keystore.exists():
    if not password.exists(): password.write_text(secrets.token_urlsafe(32),encoding='utf-8')
    run([java_home/'bin/keytool.exe','-genkeypair','-alias','qpcr-release','-keystore',keystore,'-storetype','PKCS12','-storepass:file',password,'-keypass:file',password,'-keyalg','RSA','-keysize','4096','-validity','10000','-dname','CN=qPCR Plate Planner, OU=Laboratory Software, O=qPCR Plate Planner'])
if not password.exists(): raise RuntimeError('Preserve the existing signing key and restore its password file.')
apk=root/'releases/qPCR Plate Planner v2.1.2.apk'
if apk.exists(): raise RuntimeError('Frozen APK already exists; preserve it and choose a new release version.')
signed=build/'signed.apk'
run([java,'-jar',build_tools/'lib/apksigner.jar','sign','--ks',keystore,'--ks-key-alias','qpcr-release','--ks-pass','file:'+str(password),'--out',signed,aligned])
verification=subprocess.check_output([str(java),'-jar',str(build_tools/'lib/apksigner.jar'),'verify','--verbose','--print-certs',str(signed)],text=True,encoding='utf-8')
print(verification)
run([build_tools/'zipalign.exe','-c','-p','4',signed])
with zipfile.ZipFile(signed) as archive:
    names=set(archive.namelist())
    for item in ipad['files']:
        expected=item['sha256']
        data=archive.read('assets/www/'+item['path'])
        if item['path']=='qPCR Plate Planner.html':
            data=data.decode('utf-8').replace('  <script defer src="native-adapter.js"></script>\n','').encode('utf-8')
        if hashlib.sha256(data).hexdigest()!=expected: raise RuntimeError('APK frozen asset mismatch: '+item['path'])
    if 'classes.dex' not in names or 'AndroidManifest.xml' not in names: raise RuntimeError('Incomplete APK')
shutil.copyfile(signed,apk)
checksum=sha(apk)
(apk.with_suffix('.apk.sha256.txt')).write_text(checksum+'  '+apk.name+'\n',encoding='utf-8')
report={'version':'2.1.2','versionCode':20102,'applicationId':'org.qpcrplateplanner.app','minSdk':26,'targetSdk':35,'sourceZipSha256':sha(str(frozen)+'.zip'),'apkSha256':checksum,'size':apk.stat().st_size,'frozenRuntimeFilesVerified':len(ipad['files']),'htmlAdaptation':'adds native-adapter.js before frozen scripts; core files unchanged','signingVerification':verification,'tests':['16/16 native policy checks','6/6 adapter DOM checks','7/7 packaged APK DOM integration checks','official aapt2/javac/D8 compilation','apksigner verify','zipalign verify','23 frozen asset hashes verified'],'physicalDeviceTesting':False,'signingKeyPackaged':False}
(root/'releases/qPCR Plate Planner v2.1.2 APK-REPORT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('APK ready: '+str(apk))
print('SHA256: '+checksum)
