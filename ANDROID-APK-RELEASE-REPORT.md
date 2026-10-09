# qPCR Plate Planner v2.1.2 APK 发布记录

日期：2026-10-02（Asia/Shanghai）。

- 安装包：`releases/qPCR Plate Planner v2.1.2.apk`，220,296 字节。
- SHA-256：`fbeda664272ed024831c34cd079264c2b8d765ad9d8d960ab5c40d3af0dedb96`。
- 公开下载页：https://qpcr-plate-planner-ipad-v212.kumalovetutu.chatgpt.site/qPCR%20Plate%20Planner%20Android%20APK.html
- APK 应用 ID：`org.qpcrplateplanner.app`，versionName `2.1.2`，versionCode `20102`，minSdk 26，targetSdk 35。
- Android 自适应图标使用既有孔板图标；无 debug 标记，不申请网络或全盘存储权限。
- 内置 23 个冻结网页资源，计算文件保持原始哈希。HTML 入口只加入 `native-adapter.js`，提供系统保存、打印和常亮通道。
- 原项目 229/229 测试实际重新执行通过。
- 原生策略 16/16、系统桥 6/6、打包页面集成 7/7，共 29/29 新增测试通过。
- Google 官方 aapt2、javac、D8 编译通过；APK Signature Scheme v2/v3 校验通过；zipalign 校验通过；应用图标、启动 Activity、权限与 APK 文件结构检查通过。
- 发布签名证书 SHA-256：`89fbe1df57c93c518a15cef91e33d0b7bc9fbed1ac82b8b9c1bb0e02399acd24`。私钥与密码只保留在构建者本机，未打包或上传。
- 网站源码提交 `3c788acfe02493f27ea8e5800bca33ebbf1e6df8` 已发布成功，访问权限保留为公开。
- 原 v2.1.2 ZIP 及 51 个冻结文件的校验值未变。

测试未包含实体安卓设备或模拟器。实际安装、文件选择器、触控、打印分页、屏幕常亮和孔板校准需要设备复核。安装与迁移说明见 `releases/qPCR Plate Planner v2.1.2 APK 使用说明.md`。
