# 公开网页版迁移：启用 GitHub Pages

2026-10-12 已复现原公开链接返回 HTTP 403 / Cloudflare 1010。原站点虽配置为 public，实际请求仍被平台防护拦截。GitHub 教程、源码及下载包的公网访问正常，不等于原托管软件网页可用。

为提供独立公开入口，已在本仓库准备 `gh-pages` 发布分支。该分支只包含 27 个静态文件，包含全部 23 个冻结运行文件、首页跳转、MIT License、主屏幕安装指南和 `.nojekyll`。正式软件入口仍使用 `qPCR Plate Planner.html`；主分支与历史交付包保持完整。

**当前状态：已启用并发布。** 2026-10-12 已使用未登录的 HTTPS 请求实际核验软件入口返回 HTTP 200（22139 字节）。下方设置步骤用于维护或重新配置，当前无需重复操作。

## 仓库所有者完成一次设置

1. 使用 rei402 登录 GitHub，打开 [本仓库的 Pages 设置](https://github.com/rei402/qPCR-Plate-Planner/settings/pages)。
2. Source 选择 **Deploy from a branch**。
3. Branch 选择 **gh-pages**，目录选择 **/(root)**。
4. 点击 **Save**，等待 GitHub Pages 部署完成。
5. 页面显示部署成功后，通知维护者核验软件 HTML、全部资源和离线入口，再更新仓库首页的正式链接。

当前连接的 GitHub 插件可上传文件及创建分支，没有启用或修改 GitHub Pages 的管理接口。因此发布文件已经准备完毕，这一次仓库设置需由所有者操作。

## 正式访问地址

软件入口已实际核验 HTTP 200：

[打开公开网页版](https://rei402.github.io/qPCR-Plate-Planner/qPCR%20Plate%20Planner.html)

```text
网站首页：https://rei402.github.io/qPCR-Plate-Planner/
软件入口：https://rei402.github.io/qPCR-Plate-Planner/qPCR%20Plate%20Planner.html
Apple 安装指南：https://rei402.github.io/qPCR-Plate-Planner/Apple%20%E5%AE%89%E8%A3%85%E6%8C%87%E5%8D%97.html
```

## 用户数据迁移

若旧站点上有实验记录，先在仍能打开旧站点的设备上导出 JSON，再在新网址打开项目。旧域名与新域名的草稿和校准不自动共享，主屏幕图标需要从新软件入口单独添加。不要先清理旧网站数据或删除旧图标。

## 后续发布

后续维护发布分支时，保持网页文件和图标的相对路径，并先检查冻结资源。仅更新仓库 README 不会自动生成软件网站。启用 Pages 后，发布分支变化由 GitHub 自动部署；状态可在 Actions / Pages 中查看。

参考：[GitHub 官方 Pages 分支设置说明](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)。
