*[TTY]: 代表一种“允许用户交互的环境”。如手动执行 packs scan 会弹出选择框；而在非 TTY 环境下不需要等待用户输入。

<!-- Minecraft / 平台 -->
*[MCBE]: Minecraft: Bedrock Edition，基岩版；本项目的目标平台。
*[BDS]: Bedrock Dedicated Server，基岩版官方专用服务器程序。
*[SAPI]: Script API，基岩版官方脚本接口，行为包中运行的 TypeScript/JavaScript 运行时。
*[BP]: Behavior Pack，行为包；本项目在部署时由模块实时组装生成。
*[RP]: Resource Pack，资源包。
*[OP]: Operator，服务器管理员权限等级。
*[UUID]: Universally Unique Identifier，通用唯一标识符，用于标记玩家/实体等。
*[TPS]: Ticks Per Second，服务器每秒逻辑刻数，衡量运行流畅度（满值 20）。
*[OOTB]: Out Of The Box，开箱即用；指平台无需额外业务模块即可自检通过的状态。

<!-- 组件 / 运行时 -->
*[SDK]: Software Development Kit，此处指 @sfmc-sdk 共享开发套件。
*[SFMC]: ScriptsForMinecraftServer，本项目代号。
*[ORM]: Object–Relational Mapping，对象关系映射。
*[SQLite]: 轻量级嵌入式关系型数据库；db-server 基于 node:sqlite 实现。
*[REPL]: Read–Eval–Print Loop，交互式命令行环境；sfmc 的默认入口。
*[CLI]: Command-Line Interface，命令行接口。
*[TUI]: Text-based User Interface，文本终端界面（原 panel/ 已移除）。

<!-- 网络 / 协议 -->
*[API]: Application Programming Interface，应用程序编程接口。
*[REST]: Representational State Transfer，一种 HTTP API 设计风格。
*[HTTP]: HyperText Transfer Protocol，超文本传输协议。
*[WS]: WebSocket，全双工长连接协议；qq-bridge 监听 3002 端口。
*[QQ]: 腾讯 QQ 即时通讯软件；本项目通过桥接实现 MC↔QQ 群聊互通。
*[OneBot]: 聊天机器人应用层协议标准（此处为 OneBot 11）。
*[LLBot]: 实现 OneBot 11 协议的 QQ 机器人框架，负责收发 QQ 群消息。
*[JSON]: JavaScript Object Notation，轻量级数据交换格式；configs/ 配置均为此格式。

<!-- 工具链 -->
*[npm]: Node Package Manager，Node.js 包管理器。
*[esbuild]: 高性能 JavaScript/TypeScript 打包器；用于组装行为包 bundle。
*[TypeDoc]: 从 TypeScript 源码生成 API 文档的工具。
*[CI]: Continuous Integration，持续集成（此处指 GitHub Actions）。

<!-- 代码设计原则 -->
*[SOLID]: 面向对象五大设计原则（SRP/OCP/LSP/ISP/DIP）的合称。
*[SRP]: Single Responsibility Principle，单一职责原则：一个模块只应有一个变化的理由。
*[OCP]: Open–Closed Principle，开闭原则：对扩展开放，对修改关闭。
*[LSP]: Liskov Substitution Principle，里氏替换原则：子类型可替换其基类型而不破坏行为。
*[ISP]: Interface Segregation Principle，接口隔离原则：不应强迫依赖用不到的接口。
*[DIP]: Dependency Inversion Principle，依赖倒置原则：依赖抽象而非具体实现。
*[DI]: Dependency Injection，依赖注入：由外部传入依赖而非内部自行构造。
*[IoC]: Inversion of Control，控制反转：框架/容器接管对象的创建与调用时机。
*[DRY]: Don't Repeat Yourself，不要重复自己：消除重复逻辑，单一事实来源。
*[KISS]: Keep It Simple, Stupid，保持简单：优先选择最直白的实现。
*[YAGNI]: You Aren't Gonna Need It，你不会需要它：不为臆想中的需求提前设计。
*[SoC]: Separation of Concerns，关注点分离：不同职责放到不同模块。
*[LoD]: Law of Demeter，迪米特法则（最少知识原则）：只与直接相关对象通信。
*[POLA]: Principle of Least Astonishment，最小惊讶原则：行为应符合调用者直觉。
*[SSOT]: Single Source of Truth，单一事实来源；如 catalog.json 之于模块清单。
*[TDA]: Tell, Don't Ask，命令而非查询：让对象自行处理而非取出数据外部判断。
*[CQS]: Command–Query Separation，命令查询分离：方法要么改状态要么返回数据，不两者兼具。
*[GRASP]: General Responsibility Assignment Software Patterns，职责分配通用原则集合。
*[ACID]: 数据库事务四特性：原子性、一致性、隔离性、持久性。
