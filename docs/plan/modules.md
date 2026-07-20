为一个模块化系统设计包管理器，核心在于**“定义清晰的可加载单元”**。

包管理器定位为 **“模块编排器”**，而不是“依赖下载器”。它负责的是**插件的生命周期管理（安装、加载、启动、卸载）**，以及**跨模块通信**
---

### 🧩 1. 核心契约

一个“包”应当是一个**自包含的文件夹**，包含以下结构：

```
modules/
├── economy/
│   ├── manifest.json          # 包描述文件（必须）
│   ├── dist/                  # 编译后的 JS（支持 SEA 加载）
│   ├── schema.sql             # 数据库表结构（可选）
│   ├── routes/                # HTTP 路由扩展（可选）
│   └── config.json            # 默认配置（会被合并到主配置）
└── lands/
    └── ...
```

**`manifest.json` 的关键字段**：

```json
{
  "id": "economy",
  "version": "1.0.0",
  "main": "dist/index.js",          // 模块入口
  "dependencies": {
	// 其他模块 例如必须的核心模块 数据库管理模块
  },
  "assets":{// 非必选项
	"resource_pack":"此处填写uuid，包管理器会自动在此模块内查找含有对应uuid的资源包"
	//行为包
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"] // 通常包含模块源码等内容 
}
```

---

### ⚙️ 2. 核心功能模块设计

| 功能模块 | 职责 | 对应现有代码 |
| :--- | :--- | :--- |
| **发现与索引** | 扫描 `modules/` 目录，读取 `manifest.json`，建立模块索引。 | 可复用 `routes/modules.js` 中的 `loadModuleCatalog` 逻辑。 |
| **生命周期控制** | `install`、`enable`、`disable`、`uninstall`、`update`。 | 扩展现有的 `updateModuleState` 函数，使其能执行真实的文件复制/删除。 |
| **依赖解析** | 检查模块间依赖，防止循环依赖，并确保加载顺序正确。 | 新增 `topologicalSort` 函数，按依赖顺序加载。 |
| **资源隔离** | 如果模块有独立的 `node_modules`，模块间共享根依赖，避免重复打包。 | 结合 Monorepo 结构，依赖提升到根目录。 |

---

### 🖥️ 3. 命令行接口（CLI）设计

在 `sfmc` CLI 中增加子命令(同时也注册到系统)：

```bash
# 列出所有可用模块
mod list

# 从远程仓库安装（例如从 GitHub Release 下载 .zip） 同时mod i具有与常见包管理器类似的能力 能检查模块依赖进行更新 安装 移除等操作
mod install|i --repo https://api.sfmc.com/modules

# 启用/禁用（不卸载，只是不再加载）
mod enable lands
mod disable lands

# 升级模块
mod update <economy>

# 创建新模块骨架（脚手架）
mod scaffold my-module
```

---

### 🔌 4. 运行时加载逻辑

在 `sfmc`（面板）启动时，执行以下流程：

1. **扫描** `modules/` 目录，读取所有 `manifest.json`。
2. **拓扑排序**：根据 `dependencies` 确定加载顺序（如 `core` → `economy` → `shop`）。
3. **动态导入**：使用 `await import('./modules/economy/dist/index.js')` 加载模块（在 SEA 中，模块文件需在 `assets` 中或磁盘上）。
4. **安装资源**：如果模块包含资源包或行为包，需要安装相关资源到服务器目录
5. **注册钩子**：调用模块导出的 `init` 函数，传入 `logger`、`db` 实例等上下文。

**针对 `db-server` 的扩展**：如果模块需要扩展 API 路由，可以在 `init` 中调用 `app.use('/api/module', router)`。但这需要你在 `db-server` 中提供一个**路由注册中心**。

---

### 🚀 5. 模块间通信（高级特性）

模块间的通信应遵循**事件驱动**或**通过数据库松耦合**：

- **事件驱动**：模块 A 广播 `player:login` 事件，模块 B（如 `economy`）监听该事件并奖励金币。
- **数据库解耦**：模块 A 在 `sfmc_messages` 表中插入一条记录，模块 B 轮询或通过触发器处理。
 同时提供各种统一接口 一并内置在核心模块

---

### 💡 落地建议

1. **复用已有结构**：你的 `routes/modules.js` 和 `module-lock.json` 已经做了模块的“启用/禁用”逻辑。只需将其从“配置开关”升级为“物理文件加载”。

2. **初始化脚本**：在 `install` 时，自动执行 `schema.sql`（用你现有的 `db.exec` 创建表）。

3. **热加载问题**：在 SEA 中，`require`/`import` 是静态的，无法轻易热替换。建议**重启面板**才生效，或者仅在开发模式下支持热加载（通过监控文件变化）。

4. **远程仓库**：最简单的方式是**使用 GitHub Releases**。每个模块发布一个 `module.zip`，`sfmc module install` 直接下载解压到 `modules/` 目录。无需搭建复杂的 npm 注册表。

5.将目前面板与所有插件都拆分开 减少主题体积 容易维护

---

- 包 = 文件夹 + `manifest.json`
- 安装 = 下载 ZIP → 解压到 `modules/`
- 加载 = 按拓扑顺序 `import` 并调用 `init`
- 状态 = 通过修改 `module-lock.json` 实现启用/禁用
