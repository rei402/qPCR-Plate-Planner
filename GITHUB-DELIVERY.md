# GitHub 项目交付

本仓库保存中文 qPCR Plate Planner 的 v2.1.2 冻结源码、测试、Android 原生封装源码、静态部署文件与已生成的交付包。

## 使用工具

- Windows：下载 `releases/qPCR Plate Planner v2.1.2.zip`，完整解压后运行 `qPCR Plate Planner.exe`。
- Android：下载 `releases/qPCR Plate Planner v2.1.2.apk`，支持 Android 8.0 及以上。
- iPad：`releases/qPCR Plate Planner v2.1.2 iPad.zip` 包含 HTTPS 静态托管文件和安装指引；这是网页/PWA 交付包，不是 iOS 原生安装包。
- iPhone / iPad 最新交付：`releases/qPCR Plate Planner v2.1.2 Apple.zip`（2026-10-12），包含冻结资源、可打印 HTML 教程及详细 Markdown 教程；Safari 主屏幕 App 安装步骤见 `APPLE-INSTALL-GUIDE.md`。
- Apple 独立部署包：`releases/qPCR Plate Planner v2.1.2 Apple Deploy.zip`，包含 MIT 许可证和使用本网站相对入口的安装指南；免费 GitHub Pages 部署步骤见 `APPLE-FREE-DEPLOY.md`。
- 公开网页：原托管地址已复现 403，正在迁移至 GitHub Pages；发布分支已准备，启用步骤见 `GITHUB-PAGES-SETUP.md`。在正式地址核验前，不把它标注为可用入口。
- 静态部署文件：`ipad-site/dist/`。其中 `index.html` 仅负责托管首页跳转，软件入口仍为 `qPCR Plate Planner.html`。

安装包旁的 `.sha256.txt` 可用于校验下载内容。历史版本 ZIP 保留用于归档。

## 开发与验证

```sh
npm ci
npm test
node verify-release.js
```

Android 构建说明见 `android-apk/README.md`。运行软件不需要安装开发依赖。当前 APK 尚未在实体安卓设备或模拟器上进行验收，验证范围见 `ANDROID-APK-RELEASE-REPORT.md`。

## 上传范围

个人实验项目 JSON、浏览器草稿、签名密钥及密码、下载的 Android SDK、依赖目录、构建中间文件、快捷方式和托管账户配置不进入仓库。发布 APK 中含公开签名证书，私钥仍仅由发布者本机保管。

`.gitattributes` 保留文件原始字节，以免跨平台换行转换改变冻结文件的校验值。工具功能及冻结文件保持原样。
