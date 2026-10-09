# qPCR Plate Planner v2.1.2 · Android APK

这是 v2.1.2 冻结网页工具的 Android 安装包。排板、Mix、执行记录、配色与打印内容继续使用冻结版实现，新增系统文件保存、导入、打印及常亮适配。

## 安装和使用

1. 在安卓手机或平板下载 `qPCR Plate Planner v2.1.2.apk`，点击安装。系统要求时，为当前下载工具允许“安装未知应用”，完成后可关闭该授权。
2. 从应用列表点击孔板图标打开。支持 Android 8.0（API 26）及以上；请更新 Android System WebView。首次启动也不需要联网或账号。
3. 点击“加载示例”核对排板；修改设计后重新生成。JSON/CSV 导出会打开系统文件保存器，选定目录并确认保存。
4. “打开项目”使用系统文件选择器导入 JSON，CSV/TSV 样本表仍从原导入入口选择。网页/PWA 与 APK 的本机草稿不共享；迁移时先导出 JSON，再在 APK 中打开。
5. 打印按钮调用 Android 系统打印界面，可选择打印机或“保存为 PDF”。先核对 A4 方向和分页。手机通常不能容纳完整实体孔板；孔板投光辅助请使用足够大的平板并重新校准。

草稿、校准与执行数据保存在应用本机 WebView 数据中。卸载或清除应用数据会删除这些本机记录，请保留导出的 JSON。包不申请联网、相机或全盘存储权限；保存/导入仅使用用户在系统文件选择器中选定的位置。

## 构建与签名

源码在 `android-apk/`，依赖 Python、Pillow、Node.js（项目现有 jsdom）、JDK 17 和 Google Android SDK Build Tools 35 / Platform 35。SDK 下载保存在该目录的 `.tools/`；为兼容安卓工具的中文路径限制，实际编译中间文件使用 `%LOCALAPPDATA%/qPCRPlatePlannerBuild/v2.1.2/`。

```powershell
# 已有其他 JDK 时指定其根目录：
$env:QPCR_JAVA_HOME = 'C:\你的JDK目录'
python android-apk\prepare-sdk.py
# 若单连接下载较慢，可使用分段下载后自动校验：
python android-apk\download-build-tools.py
python android-apk\build-apk.py
```

应用 ID：`org.qpcrplateplanner.app`，versionName：`2.1.2`，versionCode：`20102`。使用独立发布密钥签名，非 debug APK。签名密钥和密码仅保存在构建者本机 `~/.codex/signing/qpcr-plate-planner/`，不包含在发布包或网站中。请备份并保留这两个文件，以便后续版本能覆盖安装而保留用户数据。

冻结 APK 已存在时，构建脚本会拒绝覆盖；下一版应更新版本号并使用同一密钥。

## 验证范围

构建必须通过原生路径/导出策略测试、系统桥 DOM 测试、包内页面与导出集成测试、Google 官方 aapt2/javac/D8 编译、签名与 ZIP 对齐验证，以及 23 个冻结网页资源核对。HTML 入口仅增加原生适配脚本；原排板和计算文件保持不变。

本次未使用实体安卓设备或安卓模拟器验证安装、触控、系统文件选择器、系统打印和屏幕校准。这些设备行为须在实际使用设备上复核。
