# 客户端资源包错误修复 Implementation Plan

> 本计划只描述下一轮修改；在用户确认前不改动世界资源包。建议按阶段执行，每一阶段单独回档、重载和验收。

- [ ] 使用 Subagent-Driven Development 按阶段实施并在每阶段后复核

**Goal:** 清除当前 Content Log 中除 TouHouLittleMaid 外、已定位到 MineCars、Farmer's Delight、DogeLake、Wheat、Slash Blade 与 Improvised Guns 的资源错误，同时尽量保持玩法和视觉表现不变。

**Architecture:** 先固定启用包清单和日志基线，再处理能够确定正确目标的引用错误；对缺失原始资产或陈旧整页 UI 覆盖采用“停用损坏入口”的保守策略。每个包独立备份和验收，禁止跨包猜测性补资源。

**Tech Stack:** Minecraft Bedrock Edition Resource/Behavior Pack JSON、Molang、PowerShell、Content Log。

**Spec:** `D:\WorkPlace\SFMC\BDS\worlds\Bedrock level` 当前实际启用的资源包；旧 Improvised Guns UUID `3841f7bc-e35a-444e-804d-16cfc21d0f26` 已由用户卸载。

## 文件地图

| 模组 | 计划修改位置 | 目的 |
|---|---|---|
| Improvised Guns | `[RP] ImprovisedGuns\entity\firearm_forger.json` | 停用无法解析且无可恢复正文的占位文件 |
| DogeLake | `[RP] [自研] DogeLake!\render_controllers\galaxy_blue.json` | 将误放的客户端实体改为合法 render controller |
| Wheat | `[RP] [自研] [RP] wheat\sounds\sound_definitions.json`、`sounds.json`、`blocks.json` | 处理缺失音乐资产、大小写和格式版本 |
| Slash Blade | `[RP] 抜刀剣アドオン Slash Blade Addon\sounds\sound_definitions.json`、`ui\settings_screen.json` | 修正溺水音效路径并停用过期设置页覆盖 |
| MineCars | `[RP] minecars_rp_V3_4\entity\minecar_bumper.json`、debris 实体与 render controller、相关 geometry | 补齐确定引用，拆分不兼容的共享控制器，处理 locator 冲突 |
| Farmer's Delight | `[RP] pack.name` | 只做回归验证；首轮修复已完成 |

## Task 1：冻结基线并建立可恢复备份

- [ ] 确认 `world_resource_packs.json` 中旧 UUID 不再出现，且当前 Improvised Guns UUID `1d4a303d-68e1-47bc-aa14-56211500e2f3`、版本 `3.0.5` 仍启用。
- [ ] 清空客户端 Content Log，重新进入世界一次，保存新的原始日志；后续只以这份日志判断卸载旧包后的剩余错误，避免修复已自然消失的 `rev:hunting_musket` locator 冲突。
- [ ] 将本轮涉及文件复制到新的时间戳目录 `.sfmc-repair-backup-<timestamp>`，保留相对目录结构和 SHA-256 清单。
- [ ] 验证备份可读且文件数量与清单一致；任何修改前先停止 BDS 或确认世界未在写入。

## Task 2：Improvised Guns 旧包卸载后的收尾

- [ ] 检查新日志中 `rev:hunting_musket` 与 `rev:shadow_hunting_musket` 的 locator 冲突是否已消失；若消失，不再改这两个实体。
- [ ] 将当前包内 `entity\firearm_forger.json` 重命名为 `entity\firearm_forger.json.disabled`。该文件只是带 `__error__` 的 99 字节生成占位符，备份中也没有有效客户端实体正文，不能据此臆造定义。
- [ ] 保留 firearm forger 的方块、geometry、terrain texture 和语言条目，不改玩法侧定义。
- [ ] 重载验证：锻造台方块仍能放置、显示和交互；日志不再报告 `firearm_forger.json` 解析失败；若方块显示受影响，立即从备份恢复该文件并把此项标为需要上游原包。

## Task 3：DogeLake Galaxy 渲染控制器

- [ ] 用合法 `render_controllers` 文档替换 `render_controllers\galaxy_blue.json` 中误放的 `minecraft:client_entity`：注册 `controller.render.dogelake.galaxy_blue`，使用 `Geometry.default`、`Material.default`、`Texture.default`。
- [ ] 不改正确的 `entity\galaxy_blue.json`；其 `doge_grid` material、`geometry.dogelake.gird_red` geometry 和 `animation.dogelake.gird_red` animation 均保留。
- [ ] JSON 全量解析后进服生成/观察 galaxy_blue，确认模型、纹理和动画正常，日志中不再出现 render controller 根节点错误。

## Task 4：Wheat 缺失音乐资产与格式警告

- [ ] 采用默认保守方案：从 `sounds\sound_definitions.json` 删除 `music.trumpet.zero`、`music.accordion.zero`、`music.NOKIA.zero`、`music.symphony.zero` 四个指向不存在音频文件的定义，并从 `sounds.json` 删除对应事件绑定。结果是四种音乐装置暂时静音，但不会持续请求不存在的文件。
- [ ] 不使用其他音频冒充原曲，也不凭空创建空 `.ogg`。若用户随后提供四个原始音频，则改走“恢复资产”方案：放回 `sounds\music\`、统一事件名为全小写、category 设为 `music`，并恢复事件绑定。
- [ ] 在 `blocks.json` 顶层加入 `"format_version": "1.1.0"`，保持当前引擎此前采用的兼容默认版本，不顺带迁移方块 schema。
- [ ] 验证 Wheat 方块可加载；日志中不再出现四项 missing sound/category/case 警告和 `blocks.json` 缺少版本警告。

## Task 5：Slash Blade 音效与过期设置页

- [ ] 将四个 `sounds/damage/drown1..4` 引用改为实际存在的 `sounds/mob/player/hurt/drown1..4`。
- [ ] 将整页旧版 `ui\settings_screen.json` 重命名为 `.json.disabled`。该文件覆盖原版设置页且引用已移除的 `vr_button`、`vr_section`；停用整页比只删两个控件更能避免版本升级后继续污染原版 UI。
- [ ] 验证四个音效文件存在且 JSON 可解析；进入设置页确认使用当前原版布局；测试拔刀剑物品、模型与核心操作，确认模组并不依赖该设置页覆盖。
- [ ] 若模组确有自定义设置项依赖此文件，则回档，并改为只删除 `vr_button`、`vr_section` 两个陈旧控件后复测。

## Task 6：MineCars 第二轮确定性引用修复

- [ ] 在 `entity\minecar_bumper.json` 增加 `geometry.rocket -> geometry.minecar_rocket` 与 `texture.rocket -> textures/entity/overlays/rocket`，与同包普通矿车的 `controller.render.rocket` 契约保持一致。
- [ ] 对 `balloon_debris`、`chest_debris`、`shooter_debris` 分别建立实体专用 render controller；每个控制器只枚举该实体实际声明、且行为包 mark variant 能到达的 Geometry/Texture/Material key，不再共享要求更多 `v1..v8` key 的控制器。
- [ ] 修改三个客户端实体指向各自控制器；对每个 mark variant 逐一生成实体，确认碎片模型正确，且日志不再报告缺失 `Geometry.v*`、`Texture.v*`、`Material.v*`。
- [ ] 针对 `mc:harvester_data_storage`、`mc:railplacer_data_storage` 的 `exhaust` locator 冲突，先在实际命中的 geometry 变体中比较同名 locator 坐标：坐标相同则从子骨骼删除重复项；坐标不同则重命名子 locator，并同步唯一的粒子引用。不得直接删除有不同坐标的 locator。
- [ ] 生成两种数据存储实体并观察排烟位置；确认 locator conflict 消失且粒子未偏移。

## Task 7：Farmer's Delight 首轮修复回归

- [ ] 确认 `sounds/block/skillet/add_food2` 存在且 sound definition 只引用该实际文件。
- [ ] 确认开发测试实体保持为 `entity\test.json.disabled`，正式实体和配方未引用它。
- [ ] 在游戏内使用平底锅加食材，确认音效正常；日志不再出现旧 `add_food` 路径和 test entity 错误。

## Task 8：总体验证与交付

- [ ] 对所有本轮修改包执行递归 JSON 解析；预期本轮修改文件 0 个语法错误。MineCars BP 中既存的 JSON5/注释文件单独列出，不借本轮静默格式化。
- [ ] 静态搜索确认旧错误串为 0：`sounds/damage/drown`、四个缺失 Wheat 音频路径、DogeLake render controller 中的 `minecraft:client_entity`、启用状态下的 `firearm_forger.json` 占位符。
- [ ] 重启 BDS、客户端重新进服并覆盖主要实体/方块/UI 场景，保存修复后 Content Log，与 Task 1 基线按“错误签名 + 次数”对比。
- [ ] 只把 TouHouLittleMaid 错误和仍未能归属的新错误列入下一阶段；若本计划引入新错误，先按包回档，不进入下一阶段。
- [ ] 输出变更清单、备份目录、修复前后错误计数和仍存错误归属。世界目录不是当前 Git 仓库，不执行提交；如用户需要版本化，再单独建立补丁归档。

## 审阅时需要确认的两项行为变化

1. Wheat：默认让四个缺失源文件的音乐装置静音；若要保留音乐，执行前必须取得四个原始 `.ogg`。
2. Slash Blade：默认停用整个旧版设置页覆盖；如需保留其中的自定义设置，只做两个 VR 控件的最小删除。

## 执行方式

- **Subagent-Driven（推荐）：** 当前会话按 Task 逐项实施，每一阶段完成静态复核后再进入下一项。
- **Inline Agent：** 当前会话连续执行全部任务，最后统一进服验收；速度较快，但定位回归的粒度较粗。
- **Stop：** 仅保留此计划，暂不实施。
