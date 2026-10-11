# qPCR Plate Planner · Apple 主屏幕 App 交付记录

- 交付日期：2026-10-12；发布者：rei402。
- 核心版本：v2.1.2 稳定冻结版。本次增加 iPhone / iPad 安装教程与 Apple 交付包，没有升级排板或计算算法。
- 安装方式：在 Safari 打开软件页面，分享 → 添加到主屏幕；若系统显示“作为网页 App 打开”，将它开启。
- 软件入口：https://qpcr-plate-planner-ipad-v212.kumalovetutu.chatgpt.site/qPCR%20Plate%20Planner.html
- 在线教程：https://qpcr-plate-planner-ipad-v212.kumalovetutu.chatgpt.site/qPCR%20Plate%20Planner%20Apple%20%E5%AE%89%E8%A3%85%E6%95%99%E7%A8%8B.html
- 新包：`releases/qPCR Plate Planner v2.1.2 Apple.zip`；SHA-256：`f35cd74eadcabd554c1c0cea2465945e7197669ee9b6349ef5c4cc4df4ad0a0c`。
- 包内包含 23 个冻结运行文件、静态入口跳转、完整 Markdown 教程、可打印 HTML 教程、图标及逐文件校验清单。

## 实际运行的验证

- `npm test`：229/229 原有回归测试通过。
- `node apple-package-tests.js`：6/6 通过，覆盖运行资源逐字节一致、ZIP 与清单一致、教程安装目标、缓存安装后断网请求、96/384 原孔位恢复、JSON 下载与草稿。
- `node ipad-package-tests.js`：6/6 通过。发布目录白名单加入已存在的 Android 下载文件与本次 Apple 教程，仍拒绝其他文件。
- `node verify-release.js`：51/51 冻结文件校验通过。
- 原 Windows ZIP、原 iPad ZIP 与 APK 的 SHA-256 均保持不变。

离线检查使用 Service Worker 模拟，交互检查使用 jsdom。未进行实体 iPhone / iPad 的主屏幕安装、Safari 触控、系统文件保存、系统打印和孔板投光实测。使用设备应按教程先完成示例、JSON 保存/恢复和断网冷启动，再安排正式实验。

网页 App 不是 IPA / App Store 原生安装包。ZIP 用于部署或备份，设备安装使用软件 HTTPS 入口。实验记录保存在设备或用户导出的 JSON 中，跨设备迁移不依赖自动云同步。
