# iPhone / iPad 主屏幕 App：免费部署教程

qPCR Plate Planner v2.1.2 的 Apple 主屏幕 App、源码和安装教程已公开发布在 [rei402/qPCR-Plate-Planner](https://github.com/rei402/qPCR-Plate-Planner)。任何人都可下载、修改和部署；请按 MIT License 保留版权和许可证。作者署名为 rei402。

## 下载哪个包

- 自己使用或查看安装教程：[Apple 交付包](https://github.com/rei402/qPCR-Plate-Planner/raw/refs/heads/main/releases/qPCR%20Plate%20Planner%20v2.1.2%20Apple.zip)。
- 部署到自己的网站：[Apple 独立部署包](https://github.com/rei402/qPCR-Plate-Planner/raw/refs/heads/main/releases/qPCR%20Plate%20Planner%20v2.1.2%20Apple%20Deploy.zip)。包含 23 个冻结运行文件、首页跳转、本网站安装指引、MIT 许可证、部署教程及文件校验清单。

独立部署包的安装按钮使用相对地址，会打开部署者自己的工具页面。它不依赖原发布者的托管账户或原网站地址。

## 方案 A：使用免费的 GitHub Pages

GitHub Free 支持公开仓库的 GitHub Pages。这个工具是静态 HTML / CSS / JavaScript，无需服务器、数据库、Apple 开发者账号或构建命令。免费使用平台自带的 github.io 地址；自定义域名可自行选择，不是必需项。

### 第一步：建立自己的公开仓库

1. 登录你的 GitHub 账号，点击右上角“＋”→ New repository。
2. 仓库名称可填写 `qpcr-apple-app`，选择 Public。
3. 可以勾选 Add a README，然后点击 Create repository。包内 LICENSE 需要保留；如另选许可证，应先确认与 MIT 的条件兼容。

### 第二步：上传部署文件

1. 下载“Apple 独立部署包”并解压。
2. 打开解压后的 `网页部署文件` 文件夹。
3. 在自己的仓库点击 Add file → Upload files。
4. 将这个文件夹**里面的文件和 icons 文件夹**一起拖到上传区域，保持 icons 内部结构。上传后，仓库根目录应直接出现 `index.html`、`qPCR Plate Planner.html`、`manifest.json`、`sw.js`、`LICENSE` 和 `icons/`。
5. 点击 Commit changes。不要只上传 ZIP，也不要把整个 `网页部署文件` 文件夹作为外层目录上传。

软件的正式入口仍是 `qPCR Plate Planner.html`。`index.html` 只负责从网站首页跳转到这个入口。

### 第三步：开启 GitHub Pages

1. 打开自己仓库的 Settings → Pages。
2. 在 Build and deployment 的 Source 中选择 Deploy from a branch。
3. Branch 选择 `main`，目录选择 `/(root)`，点击 Save。若自己的默认分支名称不同，就选择实际放置网页文件的那个分支。
4. 等待 GitHub 显示部署成功；可在 Actions 中检查 Pages 构建状态。
5. 使用 Pages 页面显示的网站地址，通常是 `https://你的用户名.github.io/qpcr-apple-app/`。
6. 页面会自动跳转到工具。正式入口通常是 `https://你的用户名.github.io/qpcr-apple-app/qPCR%20Plate%20Planner.html`。

上述地址中的“你的用户名”和仓库名需要替换为自己的值。部署等待时间由 GitHub 决定，不应把出现 404 的首次尝试视为安装完成。

### 第四步：在 iPhone / iPad 安装

1. 用 Safari 打开自己的工具网站，确认已进入实验输入页面。
2. 分享 → 添加到主屏幕；若显示“作为网页 App 打开”，将它开启。
3. 保留工具名 qPCR Plate Planner，点击添加。
4. 从主屏幕图标在线打开并生成一次示例，再断网重开验证。
5. 同站点的 `Apple 安装指南.html` 包含简明安装说明；完整操作教程见项目的 `APPLE-INSTALL-GUIDE.md`，使用时把软件入口替换为自己的网址。

## 方案 B：已有实验室 HTTPS 静态网站

把 `网页部署文件` 内部的全部内容复制到网站根目录，或同一个子目录（例如 `/qpcr/`）。文件目录结构和名称保持不变，开启 HTTPS。

使用该目录下 `qPCR%20Plate%20Planner.html` 的完整地址。Service Worker、manifest 和主屏幕入口均使用相对路径，可以部署在 GitHub Pages 的项目子目录。避免把脚本、图标和 HTML 分放在不同目录。

其他静态托管平台也可使用这个目录。是否免费、额度和访问条件以部署平台的实际套餐为准。

## 部署后的检查

- 确认网站无需登录即可打开，页面有自己的孔板图标。
- 在 Safari 生成 96 / 384 孔示例，检查 Mix、打印和逐步加样。
- 添加到主屏幕后保持联网首次加载，随后断网冷启动确认缓存可用。
- 保存 JSON，并重新打开它确认孔位和记录能恢复；文件保存与打印仍需在实际设备上检查。
- 保留部署目录中的 LICENSE。不要上传个人实验 JSON、浏览器草稿、签名私钥或密码。

软件计算和实验记录保留在用户设备；托管平台可能记录访问软件资源的请求。跨设备迁移通过导出的 JSON 文件完成。

## 更新与维护

本包冻结核心为 v2.1.2。原 Apple 包和其它历史包保持不变。更新自己的站点前，提醒使用者保存 JSON 并结束当前加样；不同网址之间的草稿和校准不应假定共享。

GitHub Pages 公开仓库免费托管按当前平台规则提供，并受平台使用限制影响。本工具不收部署授权费用。

## 官方参考

- [GitHub Pages 免费公开仓库支持与静态托管说明](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [配置 Pages 分支与根目录](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [MIT 许可证](LICENSE)

发布者：rei402。
