# qPCR Plate Planner v2.1.2 移动端发布记录

- 发布日期：2026-10-02。
- 公开访问地址：https://qpcr-plate-planner-ipad-v212.kumalovetutu.chatgpt.site
- 站点发布成功；访问策略为 `public`（策略版本 2），无需登录。iPad 使用 Safari，安卓手机使用 Chrome。
- 托管源码提交：`dd6e17f1149365016e4e420b5179da7e69efbb76`。
- 原 v2.1.2 ZIP 保持不变，SHA-256：`48988ca75f44b7c7283fca73adcc514beddc28b92cce085239c641551fb19b52`。
- 23 个网页运行文件与原冻结版逐字节一致；托管根地址使用跳转页，软件入口继续使用 `qPCR Plate Planner.html`。
- iPad/Android 分别提供部署资源、安装与导出说明、文件校验清单及 ZIP 校验值。
- 重新打包后的 6 项检查实际通过：冻结资源一致、主屏幕与离线资源完整、部署目录白名单、96/384 排板与 JSON 恢复、Tablet Guide 全屏/Wake Lock 降级、JSON 导出。
- 原冻结版 229 项测试通过，原 51 个发布文件校验通过；两套移动端 ZIP 的内容逐文件校验通过。
- 实体 iPad/安卓手机的触控、文件下载、主屏幕离线启动、打印分页和孔板校准尚未实测。安装后须在使用设备先完成一次示例与 JSON 往返及离线重开。

网页托管仅提供静态软件资源。实验计算、草稿、校准与执行记录保留在访问者浏览器中；跨设备通过 JSON 迁移。
