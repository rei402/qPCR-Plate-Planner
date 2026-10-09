# 冻结版测试报告

版本：2.1.2；执行时间：2026-10-02T11:55:36.598Z

## tests.js

122/122 passed

```text
PASS NTC 跟随技术重复 3→2→1→4，容量与反应组一致
PASS NTC 自定义重复不受技术重复变化影响
PASS NTC 跟随模式贯通孔位、Mix、步骤和 CSV
PASS NTC 跟随模式写入项目孔位并与 Tablet Guide 亮孔一致
PASS NTC 旧 JSON same 和数字分别迁移为跟随及自定义
PASS 配色方案至少 6 套，ID 唯一且每套至少 6 色
PASS 默认 Target 颜色与原版一致，技术重复同色
PASS 按 Sample / Target 配色同类相同、异类不同，对照独立
PASS 配色变化只改颜色，不改排板与反应数；384 高饱和保持浅底
PASS 配色 JSON 往返及旧 JSON 默认保持按 Target 原浅色
PASS 96 孔坐标：A1 至 H12，共 96 孔
PASS 384 孔坐标：A1 至 P24，共 384 孔
PASS Sample × assay × 技术重复反应数
PASS 每 assay NTC 反应数
PASS Mix 余量取百分比与最低额外两者较大
PASS Recipe 合计与 Mix / Template 分开
PASS 汇总体积不丢失百分位精度
PASS Reserved 范围和角孔解析
PASS 多板拆分，反应不丢失
PASS 孔位范围压缩
PASS CSV 字段、BOM 和反应行数
PASS CSV 中危险名称不会作为 Excel 公式运行
PASS JSON round trip
PASS 损坏或旧版 JSON 会被拒绝
PASS 重复 Sample 与 gene 名称会阻止生成
PASS 排板没有重复孔
PASS 排板没有漏反应
PASS 排板避开保留孔
PASS 每反应唯一对应一个孔
PASS Case A：96 孔 63 个反应、Mix 和步骤
PASS Case B：384 孔 450 个反应自动分为两板
PASS Case C：超容量分板且每板不超容量
PASS Case D：角孔保留并跨板
PASS Case E：0.1 µL 引物给出警告
PASS Case F：9.5 µL 配方阻止生成
PASS 跨板校准孔加入且 Mix 数量一致
PASS No-RT 与阳性对照按 assay 单独计数
PASS 平衡分板不漏反应并避开保留孔
PASS 三种排板模式均确定性
PASS Premix 默认关闭：旧 Mix 配方与总量不变
PASS SYBR Primer Mix 包含引物和水
PASS Probe Assay Mix 支持探针和其他组分
PASS Premix 包含 Water 时最终 Mix 不再单列 Water
PASS Premix 不含 Water 时最终 Mix 保留 Water
PASS 0.10 µL 引物：关闭时提示单反应，开启后按总吸取量判断
PASS 独立 Mix 总吸取体积低于阈值时仍报警
PASS Premix 组分不能再次进入 Final Mix
PASS Premix 前后反应化学组成与总体积一致
PASS 独立 Mix 可使用单独余量参数
PASS 384 孔启用 Premix 后反应与孔位保持一致
PASS Premix 步骤先配独立 Mix，再配最终 Mix，随后分液
PASS 96 孔 A4 landscape 打印规格
PASS 96 孔 A4 portrait 打印规格
PASS 384 孔 A4 landscape 打印规格
PASS 384 孔 A4 portrait 打印规格
PASS 384 孔双行标签有明确间距且列号对齐
PASS 旧版 v1 JSON 缺少新字段仍可加载并默认横向 / 关闭 Premix
PASS 新版 JSON round trip 保留打印方向与 Premix
PASS 编辑：96 行 C 包含 12 孔
PASS 编辑：384 行 P 包含 24 孔
PASS 编辑：96 列 4 包含 8 孔
PASS 编辑：384 列 22 包含 16 孔
PASS 编辑：A1 至 C3 矩形 9 孔
PASS 编辑：C3 至 A1 反向矩形相同
PASS 编辑：384 全板矩形包含 384 孔
PASS 编辑：96 全板正好 96 孔
PASS 编辑：384 全板正好 384 孔
PASS 编辑：普通点击替换选择
PASS 编辑：Ctrl 点击增加单孔
PASS 编辑：Ctrl 点击移除单孔
PASS 编辑：Cmd 点击与 Ctrl 相同
PASS 编辑：Shift 孔范围从锚点到目标
PASS 编辑：Shift 反方向相同
PASS 编辑：Ctrl+Shift 范围累加
PASS 编辑：行标题单击选整行
PASS 编辑：列标题单击选整列
PASS 编辑：Ctrl 点击部分选中行先补齐整行
PASS 编辑：Ctrl 点击全选行取消整行
PASS 编辑：行 B 至 D 连续范围
PASS 编辑：列 3 至 6 连续范围
PASS 编辑：384 行列 Shift 范围
PASS 编辑：不同类型锚点 Shift 回退为普通点击
PASS 编辑：反选只反转临时选择
PASS 编辑：选择重复孔不会增加 Set 数量
PASS 编辑：选择摘要区分可用和保留
PASS 编辑：设保留只新增被选中的孔
PASS 编辑：恢复可用只移除选中的保留孔
PASS 编辑：撤销恢复原保留集合
PASS 编辑：重做恢复修改后集合
PASS 编辑：无实际变化不增加历史
PASS 编辑：历史最多 50 步且新修改清空 redo
PASS 编辑：selection 不进入 JSON
PASS 编辑：旧 JSON 加载后仍可应用新保留孔
PASS 编辑：修改保留孔后旧排板不可作为新排板
PASS 平板辅助：96 默认变换居中且缩放受限
PASS 平板辅助：384 默认变换独立计算
PASS 平板辅助：重置恢复初始位置
PASS 平板辅助：缩放限制 0.5–2.5
PASS 平板辅助：旋转限制 ±10 度
PASS 平板辅助：平移数值更新
PASS 平板辅助：96 孔几何和四角映射
PASS 平板辅助：384 孔几何和四角映射
PASS 平板辅助：96 当前步骤孔位精确对应亮孔
PASS 平板辅助：384 当前步骤孔位精确对应亮孔
PASS 平板辅助：离板步骤不点亮任何孔
PASS 平板辅助：无效步骤孔位被拒绝
PASS 平板辅助：96 与 384 校准键分离
PASS 平板辅助：不同孔板类型不可误用校准
PASS 平板辅助：屏幕方向变化使保存校准失配
PASS 平板辅助：同屏幕保存校准匹配
PASS 平板辅助：视口尺寸变化需复核锁定
PASS 平板辅助：边界外孔板不可锁定
PASS 平板辅助：双指缩放保持中心
PASS 平板辅助：双指平移不突然跳位
PASS 平板辅助：双指旋转限定小角度
PASS 平板辅助：双指变换保留手势中心对应孔位
PASS 平板辅助：384 亮点不会相互连接
PASS 平板辅助：96/384 初始外框宽度一致但孔距独立
PASS 平板辅助：步骤导航有边界
PASS 平板辅助：步骤导航不修改实验和反应分配
PASS 平板辅助：校准不进入项目 JSON
PASS 平板辅助：调用显示几何不修改保留孔
122/122 passed
```

## release-tests.js

23/23 frozen release regression tests passed

```text
PASS V2 校准样本位于第一板且所有板覆盖全部 assay，不增加第三板
PASS V2 校准 + 平衡分板仍保持两板与校准覆盖
PASS V2 稀疏矩阵中校准样本缺少的 assay 加入首板校准
PASS V2 逐板 NTC 和阳性重复按本板 assay 覆盖，No-RT 按本板样本覆盖
PASS V2 项目范围对照保持旧数量并支持自定义重复
PASS V2 真实 8/12/16/24 通道批次形状、步距、空隙回退和覆盖
PASS V2 保留断点不作为整列多通道步骤，不加到保留孔
PASS V2 独立体积进入 Mix、模板、NTC 和 JSON 恢复
PASS V2 预混试剂汇总不重复计转移、含实际模板及分开的 NTC 水
PASS V2 保存原孔位修改后精确恢复，显示改动保留执行
PASS V2 修改布局或配方会清空旧执行进度；重开明确清除完成时间
PASS V2 拒绝空、重复、丢失、越界和保留孔的存档映射
PASS V2 旧示例 JSON 原孔位能够恢复，损坏板不被静默重排
PASS V2 校准存档缺首板 assay 覆盖被拒绝，显式重排仍可读取输入
PASS V2 CSV/TSV 中文表头、引号、BOM、重复和不完整表格校验
PASS V2 草稿异常存储可降级，损坏数据不抛未捕获异常
PASS V2 50 个颜色身份无重复；原默认前六色保留
PASS V2 试剂 CSV 安全引用名称、布局 CSV 保存稳定标识和组别
PASS V2 所有组合的反应守恒、Mix 守恒、分液覆盖和往返保存
PASS V2 发布入口、PWA 资源、脚本与图标都存在，无 index 引用
PASS V2 冻结上限阻止过量对照，稀疏矩阵按真实反应数检查
PASS V2 PWA 安装不自动跳过等待，仅显式更新消息激活
PASS V2 特殊名称不读取对象原型作为独立配方
23/23 frozen release regression tests passed
```

## ui-tests.js

28/28 DOM integration tests passed (jsdom; no real browser rendering)

```text
PASS UI 脚本完整加载且初始化没有异常
PASS UI 示例生成、孔位与打印映射一致
PASS UI 多板导航保持项目、布局和执行记录
PASS UI 元信息、配色、打印方向不清空结果；打印更新
PASS UI 完成、返回、重开与继续执行具有持久进度
PASS UI 新增和重置检查单同步 JSON 与打印
PASS UI 导出包含原孔位和执行记录，恢复不重新排板
PASS UI 损坏 JSON 被原子拒绝，当前表单和结果保留
PASS UI 打开文件事件遇损坏 JSON 保留当前布局
PASS UI 打开文件事件恢复存档的真实坐标
PASS UI Excel 粘贴导入和组别信息进入项目
PASS UI 稀疏检测矩阵按选定组合生成
PASS UI 未应用独立配方编辑保持结果，应用后体积贯通步骤与打印
PASS UI 独立 assay 预混选择和余量通过界面贯通配制量
PASS UI 逐板对照与自定义重复可通过 UI 生成
PASS UI 试剂 CSV 和独立打印可实际触发
PASS UI 平板辅助锁定、完成和重开步骤与主页面共享进度
PASS UI 设计修改失效旧结果和进度
PASS UI 未处理旧草稿时返回保存失败且保留原草稿
PASS UI 新页面显式提示草稿；恢复孔位和进度
PASS UI 恢复后冻结版本、入口名和图标正确
PASS UI 存储失败返回 false，恢复后可再次保存且不丢失布局
PASS UI 无 NTC 的检查单在页面与打印标注不适用，JSON 保留原文本
PASS UI 含 NTC 的检查单仍可勾选且打印保留空框
PASS UI 连续输入立即隐藏旧排板，但不逐次运行容量模拟
PASS UI 停止输入后仅执行一次容量预检，结果对应最新输入
PASS UI 主动生成取消待执行预检，已生成容量不被覆盖
PASS UI 浏览器测试入口包含旧版全部 122 项
28/28 DOM integration tests passed (jsdom; no real browser rendering)
```

## lab-layout-tests.js

29/29 lab layout regression tests passed

```text
PASS LAB 新普通项目默认 QC 与全部对照关闭
PASS LAB 96四样品三Target与单内参完整标准行A-D
PASS LAB 96 R2八样品48孔、一板6标准+2剩余
PASS LAB 无内参八Target填满96的A-H，不空出边缘行
PASS LAB 96 R3 六样品：四标准、两矩形，一板54孔
PASS LAB 96 R2 十样品：六标准、四矩形，一板60孔
PASS LAB 重复数1、2、3、4、5、6、12决定真实列组宽度
PASS LAB 96 顶部A、底部H；矩形主内参首行/末行
PASS LAB 无内参不保留行，多个内参必须明确选择
PASS LAB 普通 assay 行遵循用户当前顺序
PASS LAB 超过8 assay：首8标准，其余不丢失不额外复制内参
PASS LAB 九样品矩形放不下时完整重复条带填空，一板81孔
PASS LAB 保留A2阻挡实际使用列组，剩余空间仍一板
PASS LAB 未使用行中的保留孔不阻挡标准列组
PASS LAB 物理384四分区端点映射
PASS LAB 384五样品优先Q1四个与Q2一个，零剩余
PASS LAB 384十六样品全部标准Q1→Q4
PASS LAB 384十八样品：16标准+2剩余，一板162孔
PASS LAB 384顶部A/I、底部H/P真实映射
PASS LAB 384残余矩形与条带不能跨12/13列或H/I行
PASS LAB 样品优先，三个样品+NTC3位于标准第四列组
PASS LAB QC禁用即使隐藏开关为真，所有有效对照与校准归零
PASS LAB 旧版仅NTC/阳性/NoRT/校准均推断QC启用，保存孔位完整保留
PASS LAB NTC follow/custom切换仍贯通布局与容量
PASS LAB R>12或不可连续保留孔设计明确拒绝，预检也拒绝
PASS LAB 逐板对照与校准可行性不足时退出，无无限新板
PASS LAB 稀疏矩阵、QC、校准、保留孔、不同重复数和上下位置守恒与往返
PASS LAB 确定性：输入不变时容量、孔位、CSV、Mix和颜色保持一致
PASS LAB 保存孔位拒绝散开重复和错误内参行
29/29 lab layout regression tests passed
```

## lab-ui-tests.js

18/18 lab DOM integration tests passed (jsdom; no real browser rendering)

```text
PASS LAB UI 全新页面和新项目默认实验室优先、纵向、鲜明科研，QC关闭
PASS LAB UI 容量预检显示54孔、4标准、2剩余、一板，生成一致
PASS LAB UI 残余S05步骤、主页面高亮与Tablet亮孔完全一致
PASS LAB UI 按样品/Target配色对残余组生效且孔位不变
PASS LAB UI 96十样品R2一板60孔
PASS LAB UI 384十八样品Q1→Q4标准优先，分界、标签与列标题可见
PASS LAB UI 上下位置切换96 A/H及384 A/I与H/P
PASS LAB UI 四种A4方向打印全用最终assignment，含残余说明和列组
PASS LAB UI QC启用仅展开；选择NTC后按R2产生6孔
PASS LAB UI 关闭QC先确认，取消保留结果与controls；确认移除并重新生成
PASS LAB UI 多个内参选择明确，无内参/单内参帮助与禁用状态正确
PASS LAB UI 目标重排序保留ID并按新顺序排布
PASS LAB UI 旧NTC JSON界面推断QC启用，孔位恢复不重排
PASS LAB UI 新策略上下位置、主内参和孔位JSON恢复一致
PASS LAB UI 实验室默认位置与草稿跨页面恢复
PASS LAB UI 旧缓存升级采用三个新默认值，保留其它本机设置
PASS LAB UI 升级后手动选择的模式、打印方向与配色仍能记住
PASS LAB UI 旧项目与草稿恢复保留原显示设置和孔位
18/18 lab DOM integration tests passed (jsdom; no real browser rendering)
```

## review-tests.js

9/9 review regression tests passed

```text
PASS REVIEW 首次保存失败或抛错阻止激活与刷新
PASS REVIEW 显式更新在激活前及刷新前各保存一次
PASS REVIEW 激活期间编辑的最新数据在刷新前保存
PASS REVIEW 刷新前保存失败保留页面，修复存储后可重试
PASS REVIEW 其它标签激活不会刷新当前实验
PASS REVIEW 重复更新点击不重复发送激活消息
PASS REVIEW 消息发送失败或无等待版本不刷新，可重新尝试
PASS REVIEW NTC 按本板实际孔位判断，其他及自定义检查项不变
PASS REVIEW 启动程序搬到中文空格路径后可定位入口；缺文件明确失败
9/9 review regression tests passed
```

DOM 测试使用 jsdom，检查真实 DOM 事件与项目状态。未进行真实浏览器视觉、打印分页截图或实体孔板校准验证。设备相关操作见 README 的人工复核说明。
