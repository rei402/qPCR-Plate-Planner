# 中文 qPCR Plate Planner

![工具图标](../icons/icon-192.png)

**面向实验室的 qPCR / RT-qPCR 孔板规划、试剂配制与逐步加样辅助工具。**

qPCR Plate Planner 将样品、目标基因、内参和对照设置转化为可核对的 96 / 384 孔板布局，自动计算各 assay 的 Master Mix 与 Primer / Assay Mix，并提供逐步孔位高亮、可打印操作单和项目记录。中文界面支持 Windows、iPad 网页/PWA 和 Android APK，适合实验室学生与科研人员进行 singleplex qPCR / RT-qPCR 实验准备。

**当前版本：v2.1.2 冻结版。** 核心排板与计算在本机完成，实验数据保存在本机或由用户导出的文件中；本工具不分析 Ct 值或扩增曲线。

## 开始使用

- [打开公开网页版](https://rei402.github.io/qPCR-Plate-Planner/qPCR%20Plate%20Planner.html) · 已迁移至 GitHub Pages，无需登录。
- [iPhone / iPad 主屏幕 App 详细安装教程](../APPLE-INSTALL-GUIDE.md) · [在线安装指南](https://rei402.github.io/qPCR-Plate-Planner/Apple%20%E5%AE%89%E8%A3%85%E6%8C%87%E5%8D%97.html) · [Apple 交付包（2026-10-12，保留原发布资料）](https://github.com/rei402/qPCR-Plate-Planner/raw/refs/heads/main/releases/qPCR%20Plate%20Planner%20v2.1.2%20Apple.zip)
- [Apple 免费部署教程](../APPLE-FREE-DEPLOY.md) · [独立部署包（含 MIT 许可证）](https://github.com/rei402/qPCR-Plate-Planner/raw/refs/heads/main/releases/qPCR%20Plate%20Planner%20v2.1.2%20Apple%20Deploy.zip)：支持自己的 GitHub Pages 或 HTTPS 静态网站。
- [下载 Windows 离线包](https://github.com/rei402/qPCR-Plate-Planner/raw/refs/heads/main/releases/qPCR%20Plate%20Planner%20v2.1.2.zip)：完整解压后双击 `qPCR Plate Planner.exe`。
- [下载 Android APK](https://github.com/rei402/qPCR-Plate-Planner/raw/refs/heads/main/releases/qPCR%20Plate%20Planner%20v2.1.2.apk)：支持 Android 8.0 及以上，首次启动即可离线使用。
- [下载 iPad 网页/PWA 交付包](https://github.com/rei402/qPCR-Plate-Planner/raw/refs/heads/main/releases/qPCR%20Plate%20Planner%20v2.1.2%20iPad.zip)：包含静态托管文件和安装指引。iPad 用户也可通过 Safari 打开公开网页版并添加到主屏幕。

## 主要功能

- **孔板规划**：96 / 384 孔、多种布局模式、样品列组、技术重复和批量保留孔编辑；默认实验室优先布局，主内参固定。
- **对照设计**：Reference gene、NTC Follow / Custom、Positive Control、No-RT、逐板对照与跨板校准。
- **试剂配制**：按 assay / 孔板计算 Master Mix、独立 Primer / Assay Mix、配方余量及全板试剂汇总。
- **操作辅助**：逐步孔位高亮、执行进度记录、Tablet Plate Light Guide 和多通道批次提示。
- **输出与配色**：多套孔板配色、按 Sample / Target 着色、A4 纵向 / 横向打印、CSV / JSON 导入导出。
- **离线使用**：Windows 离线网页、HTTPS PWA 缓存及 Android 本地资源封装；无需实验数据服务器。

## 使用流程

1. 输入或粘贴样品、目标基因与内参，设置技术重复和所需对照。
2. 核对反应配方、保留孔及容量预检，生成孔板和加样方案。
3. 复核孔位与各 assay 的配制量，按逐步加样提示执行。
4. 打印操作单、导出 CSV，保存 JSON 以迁移或恢复项目记录。

## 文档与源码

- [完整使用说明](../README.md)
- [项目交付与开发说明](../GITHUB-DELIVERY.md)
- [Android 构建与安装说明](../android-apk/README.md)
- [冻结清单](../FREEZE-MANIFEST.json) · [测试报告](../TEST-REPORT.md) · [设备检查清单](../DEVICE-CHECKLIST.md)

开发验证：`npm ci` 后运行 `npm test`；运行 `node verify-release.js` 校验冻结文件。最终使用者无需安装 Node.js 或 Python。

APK 已完成构建、签名及自动化验证；实体 Android 设备的安装、系统文件选择、打印和触控仍需按设备检查清单验收。平板孔位投光须先对照实体孔板校准，操作前由实验人员最终核对。

## 许可证

源码采用 [MIT License](../LICENSE)。发布私钥、个人实验记录、依赖目录与构建中间文件不包含在仓库中。
