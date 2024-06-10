/*--------------------------------
  _______ __  __ ______                    _   _       _ 
 |__   __|  \/  |  ____|                  | | (_)     | |
    | |  | \  / | |__   ___ ___  ___ _ __ | |_ _  __ _| |
    | |  | |\/| |  __| / __/ __|/ _ \ '_ \| __| |/ _` | |
    | |  | |  | | |____\__ \__ \  __/ | | | |_| | (_| | |
    |_|  |_|  |_|______|___/___/\___|_| |_|\__|_|\__,_|_|
                  Produced by Timiya
    TMEssential is distributed under the GPLv3 License

该插件由提米吖创作
未经允许禁止擅自修改或者发售
该插件仅在[gitee,MineBBS,MCWeBBS]仓库发布
禁止二次发布插件
----------------------------------*/
//LiteLoaderScript Dev Helper
/// <reference path="c:\Users\Administrator\.vscode\extensions\moxicat.llscripthelper-2.1.5/dts/llaids/src/index.d.ts"/> 


let TMET_RunPath = "./plugins/TMEssential.js";
const TMET_LogDir = "./logs/TMEssential/{1}";
const TMET_ErrorLogDir = "./logs/Error/{1}";
const TMET_CfgDir = "./plugins/Timiya/config/{1}";
const TMET_DataDir = "./plugins/Timiya/data/{1}";
const TMET_LangDir = "./plugins/Timiya/lang/{1}";
const TMET_DebugLogPath = "./logs/TMETDebug.log";

let LLMoney_ConfigPath = "./plugins/LLMoney/money.json";

let IsQuickJs = true;
let ServerIsStarted = false;

//#region Configs
let _Configs = {
    "TMET": {//预释放配置文件（勿改）
        "Enable": true,
        "AutoUpdate": {
            "Enable": true,
            "AutoReload": true
        },
        "SelectForm": {
            "Subsection": 40
        },
        "Language": {
            "Default": "zh_CN",
            "Cmd": "language"
        },
        "TPA": {
            "Enable": true,
            "ExpirationTime": 40,
            "ConsumeMoney": 0
        },
        "WARP": {
            "Enable": true,
            "ConsumeMoney": 0
        },
        "Back": {
            "Enable": true,
            "MaxSave": 5,
            "SaveToFile": true,
            "InvincibleTime": 5,
            "ConsumeMoney": 0
        },
        "Home": {
            "Enable": true,
            "MaxHome": 3,
            "SaveRequiredMoney": 0,
            "GoHomeRequiredMoney": 0,
            "DelHomeBackOffMoney": 0
        },
        "Money": {
            "Enable": true,
            "MoneyType": "score",
            "MoneyName": "money",
            "PayTaxRate": 0.0,
            "HistoryLength": 10,
            "MaxRankingQuantity": 100,
            "MoneyChangeMsg": true,
            "PlayerInitialMoney": 0
        },
        "Notice": {
            "Enable": true,
            "JoinOpenNotice": true,
            "NoticeTitle": "hello",
            "NoticeText": "test"
        },
        "Shop": {
            "Enable": true
        },
        "DynamicMotd": {
            "Enable": true,
            "Time": 5,
            "MotdList": [
                "test",
                "test2"
            ]
        },
        "TPR": {
            "Enable": true,
            "MaxXZCoordinate": 10000,
            "MinXZCoordinate": -10000,
            "ConsumeMoney": 0
        },
        "RefreshChunk": {
            "Enable": true,
            "ConsumeMoney": 0
        },
        "FarmLandProtect": {
            "Enable": true,
            "Type": 0
        },
        "UseLog": {
            "Enable": true,
            "Conf": {
                "API": false,
                "Language": true,
                "TPA": true,
                "WARP": true,
                "Back": true,
                "Home": true,
                "Money": true,
                "Notice": true,
                "Shop": true,
                "DynamicMotd": false,
                "TPR": true,
                "RefreshChunk": true,
                "FarmLandProtect": false
            }
        }
    },
    "SHOP": {//预释放商店实例文件（勿改）
        "Buy": [
            {
                "name": "xx分类",
                "type": "group",
                "image": "textures/items/book_portfolio.png",
                "data": [
                    {
                        "name": "空气",
                        "type": "exam",
                        "image": "",
                        "data": {
                            "type": "minecraft:air",
                            "aux": 0,
                            "remark": "test",
                            "money": 11
                        }
                    },
                    {
                        "name": "bread",
                        "type": "exam",
                        "image": "textures/items/bread.png",
                        "data": {
                            "type": "minecraft:bread",
                            "aux": 0,
                            "remark": "a bread",
                            "money": 2
                        }
                    }
                ]
            },
            {
                "name": "air",
                "type": "exam",
                "data": {
                    "type": "minecraft:air",
                    "aux": 0,
                    "remark": "air",
                    "money": 11
                }
            }
        ],
        "Sell": [
            {
                "name": "xx分类",
                "type": "group",
                "image": "textures/items/book_portfolio.png",
                "data": [
                    {
                        "name": "空气",
                        "type": "exam",
                        "image": "",
                        "data": {
                            "type": "minecraft:air",
                            "aux": 0,
                            "remark": "111",
                            "money": 11
                        }
                    },
                    {
                        "name": "bread",
                        "type": "exam",
                        "image": "textures/items/bread.png",
                        "data": {
                            "type": "minecraft:bread",
                            "aux": 0,
                            "remark": "bread",
                            "money": 1
                        }
                    }
                ]
            },
            {
                "name": "redstone",
                "type": "exam",
                "image": "textures/items/redstone_dust.png",
                "data": {
                    "type": "minecraft:redstone",
                    "aux": 0,
                    "remark": "redstone",
                    "money": 11
                }
            }
        ]
    },
    "DefaultLangPack": {
        "langPack.author": "提米吖",
        "langPack.description": "这是一个默认中文语言包",
        "error.message.title": "捕获到未处理错误: {1}",
        "error.message.not.bug": "此错误不为bug!将不会收集错误信息!",
        "error.message.parse.error": "错误!文件 {1} 无法反序列化为JS对象!",
        "error.message.parse.error.tip": "请检查文件格式是否正确或文件编码是否为UTF8!",
        "error.message.collect.success": "错误堆栈信息已输出至 {1},请将此文件发送至此插件开发者",
        "config.reload.error.file.empty": "原文件 <{1}> 消失！",
        "vec4.construct.param.error": "构造 \"Vector4\" 时, 所提供的 {1} 参数类型错误,该参数应该是数字类型!\n关键字: {2}",
        "cmd.register.fail": "命令: {1} 注册失败!请检查此命令是否被其他插件注册!",
        "select.form.label": "§l§a请输入关键词进行搜索",
        "select.form.switch": "---§l§b我选好了(开启之后提交可选择完成)",
        "select.form.slider.title": "§l§e请选择页码({1}/{2})",
        "select.form.label.selects": "§l§b已选择: {1}",
        "money.scoreboard.notfound": "检测到 <money> 记分板不存在,已自动创建",
        "money.description": "经济系统",
        "command.not.allow.entity": "§c实体禁止执行此命令!",
        "command.not.allow.simulation.player": "§c模拟玩家禁止执行此命令!",
        "command.not.allow.console.gui": "终端无法开启GUI!请输入其他命令!",
        "command.not.allow.console.gui1": "§c此GUI无法在非玩家对象打开!请输入完整的命令!",
        "command.not.allow.perm": "§c权限不足!无法执行!",
        "command.not.allow.not.player": "§c此命令无法通过非玩家对象执行!",
        "money.notfound.player.info": "§c没有找到该玩家的信息!",
        "money.operation.completed": "§b操作成功!",
        "money.pay.input.number.error": "§c付款金额不可为负数!",
        "money.pay.success": "§b向玩家 {1} 付款成功!此次税费: {2} {3}",
        "money.pay.fail": "§c付款失败!请检查选择玩家是否存在或你的余额是否足够!",
        "command.target.not.player": "§c选择器内没有玩家!",
        "money.notfound.player.info1": "§c未找到玩家 {1} 的信息",
        "money.query.self": "§b你还剩余: §e{1} §f{2}",
        "money.query.other": "§a玩家: §e{1} §b还剩余: §e{2} §f{3}",
        "command.target.only.one.player": "§c此命令的玩家选择器要选择一个玩家!",
        "money.main.gui.button.pay": "§l§a转账",
        "money.main.gui.button.top": "§l§e查看排行榜",
        "money.main.gui.button.hist": "§l§b查看流水账",
        "money.main.gui.button.op.fast.mgr": "§l§dOP快捷管理",
        "form.please.select": "§l§b请选择...",
        "form.give.up": "§b表单已放弃",
        "money.select.player.gui.step.slider.online": "§l§a在线玩家",
        "money.select.player.gui.step.slider.offline": "§l§b离线玩家",
        "money.select.player.gui.label": "§l§b请选择从哪选择玩家对象",
        "money.select.player.gui.step.slider.title": "§l§a请划动",
        "money.select.player.gui2.content": "§l§b请选择一个玩家...",
        "money.select.player.gui2.select.error": "§c只能选择一个玩家!",
        "money.select.player.gui2.select.error.player.info.lost": "§c无法操作数据丢失玩家!",
        "money.admin.form.label": "§l§b当前选择玩家:§e {1}§b,\nTA的余额: §e {2} §f{3}",
        "money.admin.form.add.mode.switch.title": "§l§a开启为添加(减少)模式,关闭为设置模式",
        "money.admin.form.input.title": "§l§b请务必输入数字",
        "money.form.input.error": "§c请输入数字!",
        "money.pay.form.label": "§b当前选择玩家: §e{1}§b,\n你的余额: §e{2}§b,\nTA的余额: §e{3}§b,\n单位: §f{4}§b,\n转账税率: §e{5}",
        "money.pay.form.input.title": "请输入转账金额",
        "money.pay.form.note.input.title": "请输入转账原因",
        "money.check.history.admin.form.content": "检测到OP权限!请选择执行操作:",
        "money.check.history.admin.form.check.other": "查询其他人的账单信息",
        "money.check.history.admin.form.check.self": "查询自己的账单信息",
        "money.check.history.notfound": "§c没有相关的账单信息!",
        "money.check.history.form.line.info": "{1}.§b时间: §e{2}§b, 转账人: §e{3}§b, 收款人: §e{4}§b, 值: §a{5}§b, 附加说明: §f{6}",
        "money.check.history.form.select.player": "当前查询玩家: {1}",
        "money.tax.sync.tip": "检测到TMET税率与LLMoney设置不相同!自动更正TMET税率为LLMoney值!",
        "money.change.tip": "§b经济变动:您现在拥有: §e{1} §f{2},§b变动值: {3}",
        "money.init.tip": "§b初始经济: {1} §f{2}已发放",
        "tpa.cmd.description": "请求传送至他人(成功后消耗 {1} 经济)",
        "tpa.ui.false": "§b请求UI已关闭",
        "tpa.ui.true": "§b请求UI已开启",
        "tpahere.cmd.description": "请求他人传送至自己(成功后消耗 {1} 经济)",
        "tpaaccept.cmd.description": "同意传送请求",
        "tpadeny.cmd.description": "拒绝传送请求",
        "tpa.timeout.from.player.tip": "§c你发给玩家 §e{1} §c的TPA请求已过期",
        "tpa.timeout.to.player.tip": "§c玩家 §e{1} §c发给你的TPA请求已过期",
        "tpahere.timeout.from.player.tip": "§c你发给玩家 §e{1} §c的TPA请求已过期",
        "tpahere.timeout.to.player.tip": "§c玩家 §e{1} §c发给你的TPA请求已过期",
        "tpa.gui.type.to": "我传送过去",
        "tpa.gui.type.here": "TA传送过来",
        "tpa.gui.form.select.player.title": "§l§b请选择一个玩家",
        "tpa.gui.form.select.tpa.type.title": "§l§a请选择TPA类型",
        "tpa.gui.form.label.title": "§l§b成功后消耗 {1} 经济",
        "command.notfound.player": "§c没有找到玩家对象",
        "tpa.select.player.has.request.tip": "§c对方有一个未处理的TPA(Here)请求,无法发起请求",
        "tpa.self.request.not.process.title": "§l§d请求未处理",
        "tpa.self.request.not.process.content": "§l§b你有还有一个TPA(Here)请求没有处理,\n发起人: §e{1}§e,\n目标人: §e{2}",
        "tpa.self.request.not.process.button.give.up.and.send.this.request": "放弃上一次请求并发起这一次请求",
        "tpa.self.request.not.process.button.give.up.this.request.and.wait.last.request": "继续等待并放弃这次请求",
        "tpa.self.request.not.process.res.wait.tip": "§b正在等待...",
        "tpa.request.here.string": "Here",
        "tpa.request.success": "§b你成功的向玩家 §e{1} §b发起了TPA{2}请求,/tpadeny取消请求",
        "tpa.request.to.player.tip": "§b玩家 §e{1} §b向你发送了一个TPA{2}请求,/tpaaccept同意请求,/tpadeny拒绝请求",
        "tpa.request.to.player.form.title": "§l§dTPA(Here)请求",
        "tpa.request.to.player.form.content": "§l§b玩家 §e{1} §b向你发送了一个TPA{2}请求\n(消耗对方 {3} 经济)\n请选择:",
        "tpa.request.to.player.form.button.accept": "同意请求",
        "tpa.request.to.player.form.button.deny": "拒绝请求",
        "tpa.process.notfound.request": "§c您还没有待处理的TPA(Here)请求",
        "tpa.accept.from.player.lost": "§c玩家对象丢失!",
        "tpa.accept.fail.money.to.player.tip": "§cTPA(Here)失败!原因: 对方经济不足!",
        "tpa.accept.fail.money.from.player.tip": "§cTPA(Here)失败,请检查经济",
        "tpa.accept.success.from.player.tip": "§b玩家 §e{1} §b接受了你的TPA请求",
        "tpa.accept.success.to.player.tip": "§b你接受了玩家 §e{1} §b的TPA请求",
        "tpahere.accept.success.from.player.tip": "§b玩家 §e{1} §b接受了你的TPAHere请求",
        "tpahere.accept.success.to.player.tip": "§b你接受了玩家 §e{1} §b的TPAHere请求",
        "tpa.deny.self.request.self.tip": "§b你已取消发起的TPA(Here)请求",
        "tpa.deny.self.request.to.player.tip": "§b对方取消了发给你的TPA(Here)请求",
        "tpa.deny.other.tpa.to.player.tip": "§c你拒绝了玩家 §e{1} §c的TPA请求",
        "tpa.deny.other.tpa.from.player.tip": "§c玩家 §e{1} §c拒绝了你的TPA请求",
        "tpa.deny.other.tpahere.to.player.tip": "§c你拒绝了玩家 §e{1} §c的TPAhere请求",
        "tpa.deny.other.tpahere.from.player.tip": "§c玩家 §e{1} §c拒绝了你的TPAHere请求",
        "tpa.left.to.player.tip": "§b玩家 §e{1} §b发给你的TPA(Here)请求因为对方退出游戏而被强制取消",
        "tpa.left.from.player.tip": "§b你发给玩家 §e{1} §b的TPA(Here)请求因为对方退出游戏而被强制取消",
        "warp.cmd.description": "WARP命令",
        "warp.ls.list.empty": "§b当前没有可用传送点",
        "warp.ls.msg": "§b当前传送点有: §r{1}",
        "warp.add.fail.has": "§c添加失败,已经有这个传送点了!",
        "warp.add.success": "§b传送点(\"{1}§r§l§b\")创建成功",
        "warp.go.fail.notfound": "§c传送点(\"{1}§c\")不存在",
        "warp.go.fail.money": "§c传送失败,请检查经济!",
        "warp.go.success": "§b传送到传送点(\"{1}§r§l§b\")成功",
        "warp.go.fail.error": "§c传送失败,原因未知!请联系管理员!",
        "warp.del.fail.notfound": "§c传送点(\"{1}§r§l§c\")不存在",
        "warp.del.success": "§c传送点(\"{1}§r§l§c\")删除成功",
        "warp.main.gui.button.add": "§l§b添加传送点",
        "warp.main.gui.button.go": "§l§a前往传送点",
        "warp.main.gui.button.del": "§l§c删除传送点",
        "warp.main.gui.content": "§l§b表单选项如下，请选择一个:",
        "warp.go.gui.list.empty": "§c传送点列表为空",
        "warp.go.gui.content": "§l§b表单选项如下，请选择一个\n§a此过程需要消耗 §e{1} §f{2} §a您还剩余 §e{3} §f{4}",
        "warp.add.gui.input.title": "§l§a输入你想创建的WARP名字",
        "warp.del.gui.list.empty": "§c传送点列表为空",
        "warp.del.gui.content": "§l§c选择一个WARP名字进行删除",
        "home.cmd.description": "Home主命令",
        "homeas.cmd.description": "管理玩家的家",
        "homeas.main.gui.content": "§l§b请选择一个玩家管理",
        "homeas.main.gui.res.fail.only.select.one.player": "§c只能选择一个玩家!",
        "home.main.gui.button.add": "§l§b添加家",
        "home.main.gui.button.go": "§l§a前往家",
        "home.main.gui.button.del": "§l§c删除家",
        "home.main.gui.content": "§l§b请选择操作",
        "home.as.main.gui.add.content": "\n当前选择玩家: §e{1}",
        "home.add.fail.max.limit": "§c家数量已满 {1}个 !无法继续添加!",
        "home.add.form.input.title": "§l§b输入你要创建家的名字",
        "home.add.form.input.title1": "\n§a此过程需要消耗 §e{1} §f{2} §a您还剩余: §e{3} §f{4}",
        "home.as.add.form.input.title": "\n当前选择玩家: §e{1}",
        "home.add.fail.name.is.exists": "§c添加家失败!原因: 这个家名称已存在!",
        "home.add.fail.money": "§c添加家失败!原因: 经济不足!",
        "home.add.success": "§b添加家(\"{1}§r§l§b\")成功",
        "home.go.list.empty": "§c这里还没有数据呢,请添加一个再来吧!",
        "home.go.form.content": "§l§b请选择一个家进行传送",
        "home.go.form.content1": "\n§a此过程需要消耗 §e{1} §f{2} §a您还剩余 §e{3} §f{4}",
        "home.as.go.form.content": "\n当前选择玩家: §e{1}",
        "home.go.fail.notfound": "§c前往家失败!原因: 这个家不存在!",
        "home.go.fail.money": "§c前往家失败!原因: 经济不足!",
        "home.go.success": "§b前往家(\"{1}§r§l§b\")成功",
        "home.del.list.empty": "§c这里还没有数据呢,请添加一个再来吧!",
        "home.del.form.content": "§l§c请选择一个家进行删除",
        "home.del.form.content1": "\n§a此过程需要回退 §e{1} §f{2} §a您还剩余 §e{3} §f{4}",
        "home.as.del.form.content": "\n§b当前选择玩家: §e{1}",
        "home.del.fail.notfound": "§c删除家失败!原因: 这个家不存在!",
        "home.del.success": "§c删除家(\"{1}§r§l§c\")成功",
        "home.ls.list.empty": "§c查询失败!现在没有找到任何家!",
        "home.ls.success": "§b查询成功!家列表: {1}",
        "back.cmd.description": "回到上一次暴毙点(消耗 {1} 经济)",
        "back.not.death.info": "§c您目前还无死亡记录",
        "back.fail.money": "§c传送置暴毙点失败,请检查余额!",
        "back.success": "§b返回到时间为 {1} 的暴毙点成功!",
        "back.fail.error": "§c传送失败,原因未知!请联系管理员!",
        "death.cmd.description": "查看死亡记录",
        "death.not.death.info": "§c您目前还无死亡记录!",
        "death.form.line": "{1}/{2}: 地点:{3} 时间:{4}",
        "back.die.tip": "§b你暴毙了,你的暴毙点:({1},{2},{3},{4}),时间:{5} 使用/back可返回死亡地点",
        "notice.cmd.description": "查看公告",
        "notice.auto.display.false": "§a设置成功!下次加入游戏后将不再展示更改前的公告!",
        "notice.auto.display.true": "§a设置成功!下次加入游戏后将自动展示公告!",
        "notice_op.cmd.description": "修改公告",
        "notice_op.is.continue.form.button.continue": "§l§b继续编辑",
        "notice_op.is.continue.form.button.cancel": "§l§a退出编辑并保存修改",
        "notice_op.is.continue.form.content": "{1}§r\n§l§b请选择:",
        "notice_op.is.continue.form.res.cancel.tip": "§b保存成功!",
        "notice_op.modify.title.form.input.title": "§l§b请更改公告标题",
        "notice_op.modify.title.success": "§l§b标题修改成功!",
        "notice_op.del.line.form.label": "§l§c请选择要删除的内容",
        "notice_op.modify.content.form.label": "§l§b请修改...",
        "notice_op.modify.content.form.add.line.switch.title": "§l§a添加一行(开启后提交不保存当前修改)",
        "notice_op.modify.content.form.del.line.switch.title": "§l§b打开删除面板(开启后提交不保存当前修改)",
        "notice_op.modify.content.success": "§l§b公告内容修改完成!",
        "notice_op.main.gui.button.set.title": "§l§a设置标题",
        "notice_op.main.gui.button.set.content": "§l§b设置内容",
        "notice_op.main.gui.content": "§l§b请选择编辑内容:",
        "notice.form.auto.display.switch.title": "§l§a下次公告更改前不再提醒",
        "shop.cmd.description": "系统商店",
        "shop.display.exam": "商品",
        "shop.display.group": "分类",
        "shop.main.gui.button.buy": "买入",
        "shop.main.gui.button.sell": "卖出",
        "shop.main.gui.content": "§l§b请选择操作方式:",
        "shop.config.error": "§c商店配置错误",
        "shop.form.back.last.page": "§l§d返回上一页",
        "shop.buy.form.content": "§l§b请选择购买物品",
        "shop.buy.form.buttons": "{1}§r\n{2}",
        "shop.buy.form2.content": "§l§b详情信息:\n物品:§a{1}§b,\n特殊值:§a{2}§b,\n金额:§a{3}/一个§b,\n你的剩余金额:§a{4}§b,\n备注:{5},\nTips:请输入正数",
        "shop.buy.form2.input.title": "请输入购买物品数量",
        "shop.buy.form2.res.input.error": "§c请输入正数",
        "shop.buy.fail.money": "§c购买失败!原因: 经济不足",
        "shop.buy.success": "§b购买成功!",
        "shop.buy.fail.rea": "§c购买失败!原因: {1}",
        "shop.buy.error": "§c商店出现错误!请联系游戏管理员!",
        "shop.sell.form.content": "§l§b请选择回收物品",
        "shop.sell.form.buttons": "{1}§r\n{2}",
        "shop.sell.form2.content": "§l§b详情信息:\n物品:§a{1}§b,\n特殊值:§a{2}§b,\n金额:§a{3}/一个§b,\n你的剩余金额:§a{4}§b,\n你剩余的物品数量:§a{6}§b,\n备注:{5},\nTips:请输入正数",
        "shop.sell.form2.input.title": "请输入回收物品数量",
        "shop.sell.form2.res.input.error": "§c请输入正数",
        "shop.sell.success": "§b回收成功!",
        "shop.sell.fail.count.not.enough": "物品数量不足",
        "shop.sell.fail.rea": "§c回收失败!原因: {1}",
        "shop.sell.error": "§c商店出现错误!请联系游戏管理员!",
        "tpr.cmd.description": "随机传送(消耗 {1} 经济)",
        "tpr.fail.money": "§c随机传送失败!请检查经济!",
        "tpr.load.chunk.tip": "§b正在加载区块...",
        "tpr.found.safe.pos.tip": "§b正在寻找安全坐标...",
        "tpr.fail.notfound.safe.pos": "§c未能tpr成功!未能找到安全坐标!请重试!",
        "tpr.success": "§a已将您传送置§e({1},{2},{3},{4})",
        "refresh.chunk.cmd.description": "重载区块(消耗 {1} 经济)",
        "refresh.chunk.fail.money": "§c刷新区块失败!原因: 经济不足",
        "refresh.chunk.success": "§b刷新区块成功!",
        "auto.update.has.new.version": "发现新版本: {1},正在尝试下载...",
        "auto.update.download.fail.code": "下载失败!状态码: {1}",
        "auto.update.download.fail.rea": "下载失败!原因: 返回值错误!",
        "auto.update.download.fail.size": "下载失败!原因: 安全检测: 返回值大小小于30KB!",
        "auto.update.download.success": "下载成功! 大小: {1}KB",
        "auto.update.download.success.website.restart.tip": "下载站规定,此次更新必须重启!请重启更新!",
        "auto.update.download.success.auto.reload.tip": "正在更新...",
        "auto.update.download.success.tip": "下载成功!请重启更新!",
        "write.use.log.title": "时间,维度,主体,XYZ,事件,数据",
        "tmet.cmd.description": "文件操作",
        "tmet.reloaddata.success": "操作成功",
        "tmet.not.allow.default.lang.pack": "不可操作默认语言包!",
        "tmet.load.lang.pack.fail": "加载语言包 <{1}> 失败!可能是语言包路径没此语言包,或文件名输入不完整,或是此语言包已被加载?",
        "tmet.load.lang.pack.success": "语言包 <{1}> 加载成功!",
        "tmet.unload.lang.pack.fail": "卸载语言包 <{1}> 失败!可能是语言包没有被加载?",
        "tmet.unload.lang.pack.success": "语言包 <{1}> 卸载成功!",
        "tmet.reload.lang.pack.fail": "重载语言包 <{1}> 失败!可能是语言包没有被加载?",
        "tmet.reload.lang.pack.success": "语言包 <{1}> 重载成功!",
        "tmet.ls.lang.pack": "语言包列表: {1}"
    }
};
//#endregion


let _Version = new class {
    constructor() {
        this._ver = [1, 5, 6];
        this._isBeta = false;
    }
    getVersionString() {
        return this._ver.join(".") + (this._isBeta ? "(Beta)" : "");
    }
    getVersionNumber() {
        return Number(this._ver.join(""));
    }
    getVersionArray() {
        return [this._ver[0], this._ver[1], this._ver[2]];
    }
    isBeta() {
        return this._isBeta;
    }
}();

//#region Environment
//没错,我有病
Array.prototype.find = function (fn) {
    let l = this.length, i = 0;
    while (i < l) {
        if (!!fn(this[i], i, this)) {
            return [this[i], i];
        }
        i++;
    }
    return undefined;
};
Array.prototype.forEach = function (fn) {
    let l = this.length, i = 0;
    while (i < l) {
        fn(this[i], i, this);
        i++;
    }
};
Object.prototype.forEach = function (fn) {
    let keys = Object.keys(this);
    keys.forEach((key) => {
        fn(this[key], key, this);
    });
}
Map.prototype.forEach = function (fn) {
    let entries = new Map(this).entries(),
        entrie = entries.next();
    while (!entrie.done) {
        fn(entrie.value[1], entrie.value[0], this);
        entrie = entries.next();
    }
};
Map.prototype.find = function (fn) {
    let entries = new Map(this).entries(),
        entrie = entries.next();
    while (!entrie.done) {
        if (!!fn(entrie.value[1], entrie.value[0], this)) {
            return entrie.value;
        };
        entrie = entries.next();
    }
    return undefined;
}
Number.prototype.toFull = function (num = 0) {
    let str = this.toString();
    while (str.length < num) {
        str = `0${str}`;
    }
    return str;
}


/**
 * 加强版获取类型
 * @param {any} any 任何类型
 * @returns {("Object"|"Array"|"Number"|"String"|"Undefined"|"Null"|"Boolean"|"Map")}
 */
function typeOfEx(any) {
    let type = {
        "[object Object]": "Object",
        "[object Array]": "Array",
        "[object Number]": "Number",
        "[object String]": "String",
        "[object Undefined]": "Undefined",
        "[object Null]": "Null",
        "[object Boolean]": "Boolean",
        "[object Map]": "Map"
    }[Object.prototype.toString.call(any)];
    return type;
}

/**
 * @param  {...(string|number)} args 
 * @returns {string}
 */
function getColor(...args) {
    return "\u001b[" + args.join(";") + "m";
}
/**
 * @param {string} OriText 
 * @param  {...string} args 
 * @returns {string}
 * @example
 * AutoReplace("{2}{1},{3}",1,2,3): "21,3"
 */
function AutoReplace(OriText, ...args) {
    let Index = 0;
    while (args.length != 0) {
        Index++;
        let thisArg = args.shift();
        if (thisArg != undefined) {
            OriText = OriText.replace(`{${Index}}`, thisArg);
        }
    }
    return OriText;
}

/**
 * @param {Error} err 
 */
function ErrorMsg(err) {
    try {
        let Message = err.message;
        let StackStr = err.stack;
        let FullStackStr = "";
        if (IsQuickJs) {
            Message = `${err.name}: ${Message}`;
            FullStackStr = `${Message}\n${StackStr}`;
        } else { FullStackStr = StackStr };
        logger.error(AutoReplace(Tr(null, "error.message.title"), FullStackStr));
        if (Message.indexOf("NotBug:") != -1) {
            logger.error(Tr(null, "error.message.not.bug"));
            return;
        }
        let NowInfo = {
            "time": system.getTimeStr(),
            "version": _Version.getVersionString(),
            "stack": FullStackStr,
            "fs": {},
            // 2023/05/05 这段不需要了
            // "langPacks": {},
            "TMET": File.readFrom(TMET_RunPath),
        };
        let isError = true;
        try {
            fs.forEach((jc, name) => {
                try {
                    NowInfo.fs[name] = JSON.parse(jc._TextCache);
                } catch (e) {
                    throw jc._Path;
                }
            });
            LangFs.forEach((jc, name) => {
                try {
                    // 2023/05/05 这段不需要了
                    // NowInfo.langPacks[name] =
                    JSON.parse(jc._TextCache);
                } catch (e) {
                    throw jc._Path;
                }
            });
        } catch (e) {//Process: No Code Error
            if (typeof (e) == "string") {
                isError = false;
                logger.error(AutoReplace(Tr(null, "error.message.parse.error"), e));
                logger.error(Tr(null, "error.message.parse.error.tip"));
            }
        }
        if (isError) {//Process: Code Error
            let TO = system.getTimeObj();
            let outputPath = AutoReplace(TMET_ErrorLogDir, `${TO.Y}-${TO.M}-${TO.D}-${TO.h}-${TO.m}-${TO.s}-${TO.ms}.TMETError`);
            File.writeTo(outputPath, JSON.stringify(NowInfo));
            logger.info(AutoReplace(Tr(null, "error.message.collect.success"), outputPath));
        }
    } catch (_) {
        let _Log = (typeof (log) == "undefined" ? (a) => { console.log(a) } : log);
        _Log(AutoReplace("{1}TMET无法在此环境运行!{2}", getColor(1, 31), getColor(0)));
    }
}

let TMListen = new class {
    constructor() {
        this._Events = new Map();
        this._TMETEvents = new Map();
        this._NextId = 0;
    }
    /**
     * @param {string} eventName 
     * @param {?("mc"|"TMET")} type
     * @returns {(...args:any[])=>boolean}
     */
    RegEvent(eventName, type = "mc") {
        logger.debug(`EventMgr::Reg ${type} Event: ${eventName}`);
        let ProcessEvent = (...args) => {
            let time = Date.now();
            let res = true;
            (type == "mc" ? this._Events.get(eventName) : this._TMETEvents.get(eventName)).forEach((func) => {
                try {
                    let res1 = func(...args);
                    if (typeof (res1) == "boolean") {
                        res = (!!res ? res1 : res);
                    }
                } catch (e) {
                    ErrorMsg(e);
                    return false;
                }
            });
            if (eventName != "onTick") {
                logger.debug(`RunEvent ${eventName}(${type}) Time: ${Date.now() - time}`);
            }
            return res;
        };
        if (type == "mc") {
            if (!this._Events.has(eventName)) { this._Events.set(eventName, new Map()); }
        } else {
            if (!this._TMETEvents.has(eventName)) { this._TMETEvents.set(eventName, new Map()); }
        }
        return ProcessEvent;
    }
    /**
     * @param {string} eventName 
     * @param {(...args:any[])=>boolean|undefined} func 
     * @param {?("mc"|"TMET")} type
     * @returns {string|null}
     */
    listen(eventName, func, type = "mc") {
        /**
         * @type {Map<string,(...args:any[])=>boolean|undefined>|null}
         */
        let ListenMap = (type == "mc" ? this._Events : this._TMETEvents).get(eventName);
        if (ListenMap == null) {
            ListenMap = new Map();
            (type == "mc" ? this._Events : this._TMETEvents).set(eventName, ListenMap);
        }
        let id = (this._NextId++).toString();
        ListenMap.set(id, func);
        logger.debug(`EventMgr::Add ${type} Event: ${eventName}, ID: ${id}`);
        return id;
    }
    /**
     * @param {string} id 
     * @param {?("mc"|"TMET")} type
     * @returns {boolean}
     */
    unListen(id, type = "mc") {
        let entrie = (type == "mc" ? this._Events : this._TMETEvents).find((ListenMap, eventName) => {
            if (ListenMap.has(id)) {
                ListenMap.delete(id);
                logger.debug(`EventMgr::Del ${type} Event: ${eventName}, ID: ${id}`);
                return true;
            }
            return false;
        });
        return (entrie == null ? false : true);
    }
}();

let TickTask = new class {
    constructor() {
        this._TaskList = [];
    }
    _RunTask() {
        let TL = this._TaskList;
        this._TaskList = [];
        while (TL.length != 0) {
            try {
                TL.shift()();
            } catch (e) {
                ErrorMsg(e);
            }
        }
    }
    /**
     * @param {Function} func 
     */
    addTask(func) {
        this._TaskList.push(func);
    }
}();

class JsonConfigFileClass {
    /**
     * 
     * @param {string} path 
     * @param {string} defaultStr 
     */
    constructor(path, defaultStr = "{}") {
        this._Path = path;
        // this._TimeStamp = 0;
        let fileText = File.readFrom(path);
        if (fileText == null) {
            fileText = defaultStr;
            // this._saveData(JSON.parse(fileText));
            File.writeTo(this._Path, fileText);
        }
        this._TextCache = fileText;
        this._isTasking = false;
        this._isDestroy = false;
        this.IsError = false;
    }
    _getCache() {
        if (this._isDestroy) { throw new Error(`JsonConfigFileClass::_GetCache: Illegal use of destroyed object <${this._Path}>!`); }
        // let nowTime = Date.now();
        // if ((nowTime - this._TimeStamp) > 500) {
        //     this._Cache = JSON.parse(this._TextCache);
        //     this._TimeStamp = nowTime;
        // }
        if (this._Cache == null) {
            try {
                this._Cache = JSON.parse(this._TextCache);
            } catch (e) {
                this.IsError = true;
                throw e;
            }
        }
        return this._Cache;
    }
    _saveData(obj) {
        if (this._isDestroy) { throw new Error(`JsonConfigFileClass::_SaveData: Illegal use of destroyed object <${this._Path}>!`); }
        this._Cache = obj;
        if (!this._isTasking) {
            this._isTasking = true;
            TickTask.addTask(() => {
                this._TextCache = JSON.stringify(this._Cache, null, 2);
                File.writeTo(this._Path, this._TextCache);
                this._isTasking = false;
            });
        }
        return true;
    }
    init(key, content) {
        try {
            let cache = this._getCache();
            let oldData = cache[key];
            if (oldData == undefined) {
                cache[key] = content;
                this._saveData(cache);
            }
            return oldData;
        } catch (e) {
            ErrorMsg(e);
            return undefined;
        }
    }
    get(key, defaultD = null) {
        try {
            let cache = this._getCache();
            let res = cache[key];
            return (res == null ? defaultD : res);
        } catch (e) {
            ErrorMsg(e);
            return undefined;
        }
    }
    getKeys() {
        try {
            let cache = this._getCache();
            return Object.keys(cache);
        } catch (e) {
            ErrorMsg(e);
            return [];
        }
    }
    set(key, content) {
        try {
            let cache = this._getCache();
            cache[key] = content;
            return this._saveData(cache);
        } catch (e) {
            ErrorMsg(e);
            return false;
        }
    }
    delete(key) {
        try {
            let cache = this._getCache();
            if (cache[key] == undefined) { return false; }
            delete cache[key];
            return this._saveData(cache);
        } catch (e) {
            ErrorMsg(e);
            return false;
        }
    }
    reload() {
        try {
            if (this._isDestroy) { throw new Error(`JsonConfigFileClass::Reload: Illegal use of destroyed object <${this._Path}>!`); }
            let fileText = File.readFrom(this._Path);
            if (fileText == null) {
                throw new Error(`NotBug: ${AutoReplace(Tr(null, "config.reload.error.file.empty"), this._Path)}`);
            }
            this._saveData(JSON.parse(fileText));
            this.IsError = false;
            // this._TextCache = fileText;
            // this._TimeStamp = 0;
            return true;
        } catch (e) {
            ErrorMsg(e);
            return false;
        }
    }
    close() {
        try {
            if (this._isDestroy) { throw new Error(`JsonConfigFileClass::Close: Illegal use of destroyed object <${this._Path}>!`); }
            // let cache = this._getCache();
            // this._isDestroy = true;
            // return this._saveData(cache);
            this.IsError = false;
        } catch (e) {
            ErrorMsg(e);
            return false;
        }
    }
    getPath() {
        try {
            if (this._isDestroy) { throw new Error(`JsonConfigFileClass:GetPath: Illegal use of destroyed object <${this._Path}>!`); }
            return this._Path;
        } catch (e) {
            ErrorMsg(e);
            return undefined;
        }
    }
    read() {
        try {
            if (this._isDestroy) { throw new Error(`JsonConfigFileClass::Read: Illegal use of destroyed object <${this._Path}>!`); }
            // return JSON.stringify(this._getCache(), null, 2);
            return this._TextCache;
        } catch (e) {
            ErrorMsg(e);
            return "";
        }
    }
    write(content) {
        try {
            if (this._isDestroy) { throw new Error(`JsonConfigFileClass::Write: Illegal use of destroyed object <${this._Path}>!`); }
            this._TextCache = content;
            // this._TimeStamp = 0;
            File.writeTo(this._Path, content);
            this._Cache = JSON.parse(content);
            this.IsError = false;
            // this._getCache();
            return true;
        } catch (e) {
            ErrorMsg(e);
            return false;
        }
    }
}
//#endregion

/**
 * @type {Map<string,JsonConfigFileClass}
 */
let fs = new Map();

/**
 * @type {Map<string,JsonConfigFileClass}
 */
let LangFs = new Map();
let LangEnumMgr = new class {
    constructor() { this._LangPacks = []; this._Tasks = []; }
    /**
     * 
     * @param {(LangNames:string[])=>void} func 
     */
    addTask(func) {
        func(this._LangPacks);
        this._Tasks.push(func);
    }
    _T() {
        this._Tasks.forEach((func) => {
            try {
                func(this._LangPacks);
            } catch (e) { ErrorMsg(e); }
        });
    }
    /**
     * @param {string} LangName 
     */
    add(LangName) {
        if (this._LangPacks.indexOf(LangName) == -1) {
            this._LangPacks.push(LangName);
            this._T();
            return true;
        } else { return false; }
    }
    /**
    * @param {string} LangName 
    */
    del(LangName) {
        let index = this._LangPacks.indexOf(LangName);
        if (index == -1) { return false; }
        this._LangPacks.splice(index, 1);
        this._T();
        return true;
    }
};

let GlobalCache = {
    "DebugMode": false,
    "PlayerState": new Map(),//属于基础里的,收集玩家列表用这个
    "defaultLangNotLoadIsTip": false,
    "FileCache": new class {
        constructor() {
            this._Caches = {};
            this._Path = AutoReplace(TMET_DataDir, "TMETCache");
        }
        get(name) {
            return this._Caches[name];
        }
        set(name, val) {
            return this._Caches[name] = val;
        }
        _SaveToFile() {
            return File.writeTo(this._Path, JSON.stringify(this._Caches));
        }
        _TryReadFile() {
            if (File.exists(this._Path)) {
                this._Caches = JSON.parse(File.readFrom(this._Path));
                return File.delete(this._Path);
            } else {
                return false;
            }
        }
    }(),
    "LL3ForceLoad": false
};

//#region Tools

/**
 * @param {string} text 
 * @param {?boolean} hasColor
 * @returns {string}
 */
function addLogo(text, hasColor = true) {//请不要改我的标识!
    let Logos = [
        "§l§6[-TMET-]",
        "§l§d<TMET::DevMode>"
    ];
    let txt = `${Logos[(GlobalCache.DebugMode ? 1 : 0)]} §f${text}`;
    if (hasColor) {
        return txt;
    } else {
        let arr = txt.split("§"), resArr = [];
        arr.forEach((str) => {
            resArr.push(str.substring(1));
        });
        return resArr.join("");
    }
}

function ST(pl, text) {
    if (pl == null) { return; }
    pl.tell(text, 0);
}

GlobalCache.RunCmdNoOutput = {
    "IsExecuting": false,
    "Output": []
};
/**
 * @param {string} cmd 
 */
function runCmdNoOutput(cmd) {
    GlobalCache.RunCmdNoOutput.IsExecuting = true;
    mc.runcmd(cmd);
    GlobalCache.RunCmdNoOutput.IsExecuting = false;
    let out = GlobalCache.RunCmdNoOutput.Output;
    GlobalCache.RunCmdNoOutput.Output = [];
    return out;
}

/**
 * @param {CommandOrigin} ori 
 * @returns {("other"|"cb"|"op"|"pl"|"notop"|"console"|"entity")}
 */
function getOriginLevel(ori) {
    let res = "other";
    switch (ori.typeName) {
        case "MinecartCommandBlock":
        case "CommandBlock": {
            res = "cb";
            break;
        }
        case "Entity": {
            res = "entity"
            break;
        }
        case "Virtual": {
            res = "op";
            break;
        }
        case "Server": {
            res = "console";
            break;
        }
        case "Player": {
            if (ori.player.permLevel == 0) {
                res = "notop";
            } else {
                res = "op";
            }
            break;
        }
    }
    return res;
}

/**
 * 发送选择表单
 * @param {Player} pl 
 * @param {SelectFormData} selectFormData 
 */
function sendSelectForm(pl, selectFormData) {
    let nf = mc.newCustomForm();
    nf.setTitle(selectFormData.title);
    nf.addLabel(selectFormData.content);
    nf.addInput(Tr(pl, "select.form.label"), "(String)", selectFormData.searchContent);
    nf.addSlider(AutoReplace(Tr(pl, "select.form.slider.title"), selectFormData.nowPage, selectFormData.pageLength), 1, selectFormData.pageLength, 1, selectFormData.nowPage);
    nf.addLabel(AutoReplace(Tr(pl, "select.form.label.selects"), selectFormData.getNowSelect().join(",")));
    selectFormData.pageContent.forEach((val) => {
        nf.addSwitch(val, selectFormData.buttonIsPress(val));
    });
    nf.addSwitch(Tr(pl, "select.form.switch"), false);
    pl.sendForm(nf, (pl, args) => {
        if (args == null) {
            selectFormData.callback(pl, null);
            return;
        }
        args.shift();//content
        let [search, page, isOK] = [args.shift(), (args.shift() - 1), args.pop()];
        args.shift()
        if (page < 0) { page = 0; }
        if (page == selectFormData.pageLength) {
            page -= 1;
        }
        let select = [];
        let unSelect = [];
        args.forEach((bool, i) => {
            if (bool) {
                select.push(i);
            } else {
                unSelect.push(i);
            }
        });
        selectFormData.calculation(search, select, unSelect, page, isOK);
        if (isOK) {
            selectFormData.callback(pl, selectFormData.getNowSelectIds());
        } else {
            sendSelectForm(pl, selectFormData);
        }
    });
}

/**
 * 选择表单数据
 */
class SelectFormData {
    /**
     * 切段
     * @param {string[]} arr 
     * @param {number} num 
     * @returns {string[][]}
     */
    static splitArr(arr, num) {
        let newArr = [[]];
        let i = 0, l = arr.length, i2 = 0, num1 = 0;
        while (i < l) {
            if (newArr[i2] == null) {
                newArr[i2] = [];
            }
            newArr[i2].push(arr[i]);
            num1 += 1;
            if (num1 >= num) {
                i2 += 1;
                num1 = 0;
            }
            i += 1;
        }
        return newArr;
    }

    /**
     * @param {string} title 
     * @param {string} content 
     * @param {string[]} buttons 
     * @param {number} pageNum 
     * @param {(pl:Player,nowSelect:string[]|null)=>void} cb
     */
    constructor(title, content, buttons, pageNum, cb) {
        this._title = title;
        this._content = content;
        /** 页面长度 */
        this._pageNum = pageNum
        /** 源数据 */
        this._buttons = buttons;
        /** 
         * 已选择数据 
         * @type {Set<string>}
         * */
        this._nowSelect = new Set();

        /** 上一次搜索 */
        this._lastSearch = "";

        /** 显示数据 */
        this._showData = SelectFormData.splitArr(buttons, pageNum);
        /** 当前页面引索位置 */
        this._nowPage = 0;
        /** 页面总长度 */
        this._pageLength = this._showData.length;
        this._callback = cb;
    }
    get title() { return this._title; }
    get content() { return this._content; }
    get searchContent() { return this._lastSearch; }

    get nowPage() { return (this._nowPage + 1); }
    get pageContent() {
        return this._showData[this._nowPage];
    }
    get pageLength() { return this._pageLength; }

    get callback() { return this._callback; }
    setTitle(title) {
        this._title = title;
        return true;
    }
    setContent(content) {
        this._content = content;
        return true;
    }
    /**
     * 进行页面数据计算
     * @param {string} search 搜索数据
     * @param {number[]} selects 已选择数据
     * @param {number[]} unSelects 取消选择数据
     * @param {number} page 页面索引
     * @param {boolean} isOK 是否选择完成 
     */
    calculation(search, selects, unSelects, page, isOK) {
        selects.forEach((index) => {
            let val = this._showData[this._nowPage][index];
            this._nowSelect.add(val);
        });
        unSelects.forEach((index) => {
            let val = this._showData[this._nowPage][index];
            this._nowSelect.delete(val);
        });
        if (isOK) { return; }
        search = search.trim();//去除前后空格
        if (this._lastSearch != search) {
            this._lastSearch = search;
            this._nowPage = 0;

            if (search == "") {//恢复默认
                this._showData = SelectFormData.splitArr(this._buttons, pageNum);
                this._pageLength = this._showData.length;
                return;
            }

            let searchRes = {}, lowSearch = search.toLowerCase();//小写搜索
            this._buttons.forEach((val, i) => {
                let res = val.toLowerCase().indexOf(lowSearch);
                if (res != -1) {
                    searchRes[val] = res;
                }
            });

            this._showData = SelectFormData.splitArr(
                Object.keys(searchRes).sort((a, b) => {
                    return (searchRes[a] - searchRes[b]);
                }),
                this._pageNum);
            this._pageLength = this._showData.length;
        } else {
            this._nowPage = page;
        }
    }
    /**
     * 内容是否已被选定
     * @param {string} data
     */
    buttonIsPress(data) {
        return this._nowSelect.has(data);
    }
    getNowSelect() {
        return [...this._nowSelect];
    }
    getNowSelectIds() {
        let ids = [];
        [...this._nowSelect].forEach((v) => {
            ids.push(this._buttons.indexOf(v));
        });
        return ids;
    }
}

/**
 * @param {Array<any>} _this 
 * @param {number} i 
 */
function SafeDeleteArray(_this = [], i) {
    let Link = _this[i];
    TickTask.addTask(() => {
        let nowIndex = _this.indexOf(Link);
        _this.splice(nowIndex, 1);
    });
}

class Vector4 {
    /**
     * @param {(FloatPos|IntPos|{"x":number."y":number,"z":number,"dimid":number})} pos 
     * @param {?string} keyword
     */
    static PosToVec4(pos, keyword) {
        return new Vector4(pos.x, pos.y, pos.z, pos.dimid, keyword);
    }
    /**
     * @param {number} X 
     * @param {number} Y 
     * @param {number} Z 
     * @param {number} DIMID
     * @param {?string} keyword
     */
    constructor(X, Y, Z, DIMID, keyword = "U") {
        if (typeof (X) != "number") {
            throw new Error(`NotBug: ${AutoReplace(Tr(null, "vec4.construct.param.error"), "x", keyword)}`);
        }
        if (typeof (Y) != "number") {
            throw new Error(`NotBug: ${AutoReplace(Tr(null, "vec4.construct.param.error"), "y", keyword)}`);
        }
        if (typeof (Z) != "number") {
            throw new Error(`NotBug: ${AutoReplace(Tr(null, "vec4.construct.param.error"), "z", keyword)}`);
        }
        if (typeof (DIMID) != "number") {
            throw new Error(`NotBug: ${AutoReplace(Tr(null, "vec4.construct.param.error"), "dimid", keyword)}`);
        }
        this._x = X; this._y = Y; this._z = Z; this._dimid = DIMID;
    }
    toPos() {
        return new FloatPos(this._x, this._y, this._z, this._dimid);
    }
    toDecimalPlaces(num) {
        let floor = Math.floor;
        return new Vector4(floor((this._x) * (num * 10)) / (num * 10), floor((this._y) * (num * 10)) / (num * 10), floor((this._z) * (num * 10)) / (num * 10), this._dimid)
    }
    get x() { return this._x; }
    get y() { return this._y; }
    get z() { return this._z; }
    get dimid() { return this._dimid; }
    get dim() { return this.toPos().dim; }
    set x(a) {
        if (typeof (a) != "number") {
            throw new Error("Failed to modify parameter x! Reason: the value provided is not a number");
        }
        this._x = a;
    }
    set y(a) {
        if (typeof (a) != "number") {
            throw new Error("Failed to modify parameter y! Reason: the value provided is not a number");
        }
        this._y = a;
    }
    set z(a) {
        if (typeof (a) != "number") {
            throw new Error("Failed to modify parameter z! Reason: the value provided is not a number");
        }
        this._z = a;
    }
    set dimid(a) {
        if (typeof (a) != "number") {
            throw new Error("Failed to modify parameter dimid! Reason: the value provided is not a number");
        }
        this._dimid = a;
    }
    /**
     * @param {Vector4} vec4 
     */
    isSame(vec4) {
        let str1 = vec4.toString();
        let str2 = this.toString();
        return (str1 == str2);
    }
    toString() {
        return `Vector4(${this._x},${this._y},${this._z},${this._dimid})`;
    }
    toObject() {
        return {
            "x": this._x,
            "y": this._y,
            "z": this._z,
            "dimid": this._dimid
        };
    }
}

let TMCmd = new class {
    constructor() {
        this._regTasks = [];
        this._isInit = false;
    }
    /**
     * @param {string} cmd 
     * @param {string} desc 
     * @param {(PermType|undefined)} perm 
     * @param {(number|undefined)} flag
     * @param {((nc:Command)=>void|undefined)} func
     */
    register(cmd, desc, perm = PermType.Any, flag = 0x80, func = () => { }) {
        let regTask = () => {
            logger.debug(`Cmd: ${cmd} register...`);
            let nc = mc.newCommand(cmd, desc, perm, flag);
            if (!nc) {
                logger.error(AutoReplace(Tr(null, "cmd.register.fail"), cmd));
            } else { func(nc); }
        };
        if (ServerIsStarted) {
            regTask();
        } else {
            if (!this._isInit) {
                this._isInit = true;
                TMListen.listen("onServerStarted", () => {
                    this._regTasks.forEach((func, i) => {
                        func();
                        SafeDeleteArray(this._regTasks, i);
                    });
                });
            }
            this._regTasks.push(regTask);
        }
    }
}();

/**
 * 向玩家发送一个模式表单(修复表单冲突)
 * @param {Player} pl 
 * @param {string} title 
 * @param {string} content 
 * @param {string} but1 
 * @param {string} but2 
 * @param {(pl: Player, result: boolean)=>void} cb 
 */
function SendModalFormToPlayer(pl, title, content, but1, but2, cb) {
    return pl.sendSimpleForm(title, content, [but1, but2], ["", ""], (pl, id) => {
        if (id == null) { return; }
        cb(pl, (id == 0));
    });
}

/**
 * 判断是否为模拟玩家
 * @param {Player} pl 
 */
function isSimulatedPlayer(pl) {
    if (pl == null) { return true; }
    let isSimPl = pl.isSimulatedPlayer();
    if (isSimPl == null || isSimPl) {
        return true;
    }
    return false;
}

//#endregion

//#region Lang-Pre
/**
 * @param {?Player} pl 
 * @param {string} key 
 * @returns 
 */
let Tr = (pl, key) => {
    if (!GlobalCache.defaultLangNotLoadIsTip) {
        GlobalCache.defaultLangNotLoadIsTip = true;
        logger.warn("I18N is not load! Use built-in LangPack!");
    }
    return _Configs.DefaultLangPack[key];
};
//#endregion

let Modules = new class {
    constructor() {
        this._Exports = {};
        this._RegExportApi("getVersion", () => {
            return {
                "major": _Version._ver[0],
                "minor": _Version._ver[1],
                "revision": _Version._ver[2],
                "isBeta": _Version.isBeta()
            };
        });
    }
    /**
     * @param {string} name 
     * @param {(...args:any[])=>any} func 
     * @returns {boolean}
     */
    _RegExportApi(name, func) {
        this._Exports[name] = func;
        return true;
    }
    /**
     * @param {string} name 
     * @returns {((...args:any)=>any|null)}
     */
    getApi(name) {
        return this._Exports[name];
    }
    LoadI18N() {
        (() => {
            let Event_SwitchLangPackExample = TMListen.RegEvent("onSwitchLangPack", "TMET");
            function InitI18NSystem() {
                fs.set("LangSetting", new JsonConfigFileClass(AutoReplace(TMET_DataDir, "langsetting.json")));
                /**
                 * @type {(pl:?Player,key:string)=>string}
                 */
                Tr = (pl, key) => {
                    let xuid = (pl != null ? pl.xuid : "");
                    let TMETDefault = fs.get("TMET").get("Language")["Default"];
                    let LangName = (!xuid ? TMETDefault : fs.get("LangSetting").get(xuid, TMETDefault));
                    let isError = LangFs.get(LangName).IsError;
                    if (!LangFs.has(LangName) || isError) {
                        LangName = "zh_CN";
                        if (!LangFs.has(LangName) || isError) {
                            if (!GlobalCache.defaultLangNotLoadIsTip) {
                                GlobalCache.defaultLangNotLoadIsTip = true;
                                logger.warn("Default LangPack: zh_CN not Read! Use built-in LangPack!");
                            }
                            return _Configs.DefaultLangPack[key];
                        }
                    }
                    return LangFs.get(LangName).get(key, key);
                };
                LoadAllLangPack();
                RegLanguageCmd();
            }

            function RegLanguageCmd() {
                TMCmd.register(fs.get("TMET").get("Language")["Cmd"], "switch language", PermType.Any, 0x80, (nc) => {
                    LangEnumMgr.addTask((LangPacks) => {
                        nc.setSoftEnum("LangNameEnum", LangPacks);
                    });
                    nc.mandatory("LangName", ParamType.SoftEnum, "LangNameEnum", "LangName", 1);
                    nc.mandatory("LangNameString", ParamType.String);
                    nc.overload([]);
                    nc.overload(["LangName"]);
                    nc.overload(["LangNameString"])
                    nc.setCallback((_cmd, ori, out, res) => {
                        let pl = ori.player, isPlayer = true;
                        if (!pl) {
                            isPlayer = false;
                        }
                        let oriLevel = getOriginLevel(ori);
                        let hasColor = (oriLevel == "console" ? false : true);
                        if (!isPlayer && ori.entity != null) {
                            out.error(addLogo("§cThe entity prohibits the execution of this command!", hasColor));
                            return;
                        }
                        if (pl != null && isSimulatedPlayer(pl)) {
                            out.error(addLogo("§cSimulated players are prohibited from executing this command!", hasColor));
                            return;
                        }
                        let LangName = (res.LangName || res.LangNameString);
                        if (LangName == null) {
                            if (!isPlayer) {
                                out.error(addLogo("§cConsole cannot open GUI! Please enter the complete command!", hasColor));
                            } else {
                                SwitchLangPackGui(pl);
                            }
                            return;
                        }
                        if (!LangFs.has(LangName)) {
                            out.error(addLogo(AutoReplace("§cLangPack not found: {1}", LangName)));
                        } else {
                            if (!Event_SwitchLangPackExample((isPlayer ? pl.xuid : ""), LangName)) {
                                return;
                            }
                            if (isPlayer) {
                                fs.get("LangSetting").set(pl.xuid, LangName);
                            } else {
                                let TMETCfg = fs.get("TMET");
                                let LangCfg = TMETCfg.get("Language");
                                LangCfg["Default"] = LangName;
                                TMETCfg.set("Language", LangCfg);
                            }
                            out.success(addLogo(AutoReplace("§bLangPack switched to {1}", LangName), hasColor));
                        }
                    });
                    nc.setup();
                });
            }

            /**
             * @param {Player} pl 
             */
            function SwitchLangPackGui(pl) {
                let nf = mc.newCustomForm();
                nf.setTitle("§l§dSelectLangPack");
                let arr = [], nowSel = -1;
                let xuid = pl.xuid;
                let TMETDefault = fs.get("TMET").get("Language")["Default"];
                let LangName = (!xuid ? TMETDefault : fs.get("LangSetting").get(xuid, TMETDefault));
                if (!LangFs.has(LangName)) {
                    LangName = "zh_CN";
                }
                LangFs.forEach((_J, key) => {
                    if (LangName == key) {
                        nowSel = arr.length;
                    }
                    arr.push(key);
                });
                nf.addDropdown("§l§bPlease select a language pack", arr, nowSel);
                pl.sendForm(nf, (pl, args) => {
                    if (args == null) {
                        ST(pl, addLogo("§bForm abandoned"));
                        return;
                    }
                    let sel = arr[args[0]];
                    pl.runcmd(`/${fs.get("TMET").get("Language")["Cmd"]} ${sel}`);
                });
            }

            function LoadAllLangPack() {
                try {
                    let lang = new JsonConfigFileClass(AutoReplace(TMET_LangDir, "zh_CN.json"), JSON.stringify(_Configs.DefaultLangPack, null, 2));
                    LangFs.set("zh_CN", lang);
                    lang._getCache();
                    if (lang.get("langPack.author") == null) {
                        throw new Error("Old LangPack!!!");
                    }
                } catch (e) {
                    if (e.message.indexOf("Old LangPack!!!") != -1) {
                        logger.warn("zh_CN LangPack is old data!");
                    } else {
                        logger.error("zh_CN LangPack is damaged!");
                    }
                    logger.info("Auto fix zh_CN LangPack...");
                    LangFs.get("zh_CN").write(JSON.stringify(_Configs.DefaultLangPack, null, 2));
                }
                UpdateDefaultLangPack();
                PrintLangPackMsg("zh_CN");
                LangEnumMgr.add("zh_CN");
                logger.info("Standard LangPack zh_CN has been read!");
                let files = File.getFilesList(AutoReplace(TMET_LangDir, ""));
                files.forEach((name) => {
                    LoadLangPack(name, true);
                });
            }

            /**
             * @param {string} name 名称
             * @param {string} isAutoMode 是否是自动加载模式,非自动加载模式会自动修正大小写(API不准修改此参数!)
             * @returns {-1|0|1} -1表示失败0表示不是标准包1表示标准包
             */
            function LoadLangPack(name, isAutoMode = false) {
                name = name.trim();
                if (name.toLowerCase() == "zh_cn.json") { return -1; }
                let TmpArr = name.split(".");
                if (TmpArr.pop() != "json") { return -1; };
                let FileName = TmpArr.join(".");
                if (!isAutoMode) {
                    let res = File.getFilesList(AutoReplace(TMET_LangDir, "")).find((FileName1) => {
                        if (FileName1.toLowerCase() == name.toLowerCase()) {
                            name = FileName1;
                            FileName = (() => {
                                let tmp = FileName1.split(".");
                                tmp.pop();
                                return tmp.join(".");
                            })();
                            return true;
                        } else { return false; }
                    });
                    if (!res) { return -1; }
                }
                let LangPath = AutoReplace(TMET_LangDir, name);
                try {
                    let arr = [];
                    LangFs.forEach((_J, name) => { arr.push(name.toLowerCase()); });
                    if (arr.indexOf(FileName.toLowerCase()) != -1) { return -1; }
                    LangFs.set(FileName, new JsonConfigFileClass(LangPath));
                    let iss = isStandardLangPack(FileName);
                    if (iss) {
                        logger.info(`Standard LangPack: ${FileName} Read!`);
                    } else {
                        logger.warn(`Non-Standard LangPack: ${FileName} Read!`);
                    }
                    PrintLangPackMsg(FileName);
                    LangEnumMgr.add(FileName);
                    return (iss ? 1 : 0);
                } catch (e) {
                    LangFs.delete(FileName);
                    logger.error("The LangPack: ", FileName, " Failed To Read");
                    return -1;
                }
            }

            /**
             * @param {string} name 
             */
            function UnloadLangPack(name) {
                name = name.trim();
                if (name.toLowerCase() == "zh_cn.json") { return false; }
                let TmpArr = name.split(".");
                if (TmpArr.pop() != "json") { return false; };
                let FileName = TmpArr.join(".");
                let arr = [], arr2 = [];
                LangFs.forEach((_J, name) => { arr.push(name.toLowerCase()); arr2.push(name); });
                let index = arr.indexOf(FileName.toLowerCase());
                if (index == -1) { return false; }
                let LName = arr2[index];
                LangEnumMgr.del(LName);
                let res = LangFs.delete(LName);
                return res;
            }

            function PrintLangPackMsg(name) {
                let LP = LangFs.get(name);
                logger.info(`LangPack Name: ${name}`)
                logger.info(`LangPack Author: ${LP.get("langPack.author", "Unknown")}`);
                logger.info(`LangPack Description: ${LP.get("langPack.description", "Unknown")}`);
            }

            function isStandardLangPack(name) {
                let LP = LangFs.get(name);
                let Keys = LP.getKeys();
                let NotHas = [];
                LangFs.get("zh_CN").getKeys().forEach((key) => {
                    if (Keys.indexOf(key) == -1) {
                        NotHas.push(key);
                    }
                });
                if (NotHas.length == 0) {
                    return true;
                } else {
                    logger.debug(`LangPack: ${name} missing data: \n[\n${NotHas.join(",\n")}\n]`);
                    return false;
                }
            }

            function UpdateDefaultLangPack() {
                let LangPack = LangFs.get("zh_CN");
                /**
                 * @param {string} key 
                 */
                let DEL = (key) => { LangPack.delete(key); return DEL; };
                // DEL("reload.chunk.cmd.description")
                //     ("reload.chunk.fail.money")
                //     ("reload.chunk.success");
                _Configs.DefaultLangPack.forEach((val, key) => {
                    let res = LangPack.get(key);
                    if (res == null || res != val) {
                        LangPack.set(key, val);
                        logger.info("LangPack: zh_CN auto repair: ", key);
                    }
                });
            }

            Modules._RegExportApi("setLangPack", (xuid, LangName) => {
                if (!LangFs.has(LangName)) { return false; }
                if (xuid == "") {
                    let TMETCfg = fs.get("TMET");
                    let LangCfg = TMETCfg.get("Language");
                    LangCfg["Default"] = LangName;
                    TMETCfg.set("Language", LangCfg);
                } else {
                    fs.get("LangSetting").set(xuid, LangName);
                }
                return true;
            });
            Modules._RegExportApi("getLangPackList", () => {
                let arr = [];
                LangFs.forEach((_J, name) => {
                    arr.push({
                        "name": name,
                        "author": _J.get("langPack.author"),
                        "description": _J.get("langPack.description")
                    });
                });
                return arr;
            });
            Modules._RegExportApi("loadLangPack", (name) => {
                return LoadLangPack(name);
            });
            Modules._RegExportApi("unloadLangPack", (name) => {
                return UnloadLangPack(name);
            });

            InitI18NSystem();
        })();
        return true;
    }
    LoadMoney() {
        (() => {
            let Event_MoneyChangeExample = TMListen.RegEvent("onMoneyChange", "TMET");
            let Event_MoneyPayExample = TMListen.RegEvent("onMoneyPay", "TMET");

            let isLLMoney = false;

            function MoneyLoad() {
                let MoneyCfg = fs.get("TMET").get("Money");
                let MoneyType = MoneyCfg["MoneyType"];
                fs.set("MoneyData", new JsonConfigFileClass(AutoReplace(TMET_DataDir, "offlineMoney.json", "{}")));
                switch (MoneyType) {
                    case "score": {
                        if (MoneyCfg["HistoryLength"] != 0) {
                            fs.set("History", new JsonConfigFileClass(AutoReplace(TMET_DataDir, "history.json")));
                        }
                        TMListen.listen("onScoreChanged", function (pl, num, name, _disName) {
                            if (isSimulatedPlayer(pl)) { return true; }
                            let offData = fs.get("MoneyData");
                            if (offData == null || name != "money") { return true; }
                            let offMoney = offData.get(pl.xuid);
                            if (offMoney != num) {
                                WriteUseLog("Money-Change-Score", pl, `${offMoney}->${num}`);
                                setMoney(pl.realName, num, "set");
                            }
                        });
                        TickTask.addTask(() => {
                            let ScoreBoard = mc.getScoreObjective("money");
                            if (ScoreBoard == null) {
                                logger.info(Tr(null, "money.scoreboard.notfound"));
                                mc.newScoreObjective("money", "money");
                            }
                        });
                        RegMoneyCmd();
                        break;
                    }
                    case "llmoney": {
                        TMListen.listen("onPlayerCmd", (pl, cmd) => {
                            if (isSimulatedPlayer(pl)) { return true; }
                            let lower = cmd.toLowerCase();
                            lower = (lower[0] == "/" ? lower.substring(1) : lower);
                            if (lower.indexOf("money") == 0) {
                                switch ((lower.substring(5) || "").trim()) {
                                    case "": {
                                        MoneyMainGui(pl);
                                        return false;
                                    }
                                    case "add":
                                    case "reduce":
                                    case "set": {
                                        if (pl.permLevel != 0) {
                                            MoneySetGui(pl);
                                            return false;
                                        }
                                    }
                                    case "pay": {
                                        MoneyPayGui(pl);
                                        return false;
                                    }
                                }
                            }
                        });
                        TMListen.listen("onLLMoneyMoneyChanged", Money_onLLMoneyMoneyChanged);
                        // setInterval(() => {//同步在线玩家LLMoney
                        //     GlobalCache.PlayerState.forEach((bool, xuid) => {
                        //         if (bool) {
                        //             let name = data.xuid2name(xuid);
                        //             let llmoneyVal = money.get(xuid);
                        //             let pluginVal = fs.get("MoneyData").get(xuid, 0);
                        //             if (llmoneyVal != pluginVal) {
                        //                 WriteUseLog("Money-Change-LLMoney", mc.getPlayer(xuid), `${pluginVal}->${llmoneyVal}`);
                        //                 setMoney(name, llmoneyVal);
                        //             }
                        //         }
                        //     });
                        // }, 2000);
                        fs.set("llmoneyConf", new JsonConfigFileClass(LLMoney_ConfigPath, "{}"));
                        isLLMoney = true;
                        break;
                    }
                    default: {
                        throw new TypeError(`NotBug: \n    未知的MoneyType:"${MoneyType}"! 它必选为"score"或者"llmoney"\n    Unknown MoneyType:"${MoneyType}"! It must be selected as "score" or "llmoney"`);
                    }
                }
                TMListen.listen("onJoin", Money_onJoin);
            }

            function RegMoneyCmd() {
                TMCmd.register("money", Tr(null, "money.description"), PermType.Any, 0x80, (nc) => {
                    nc.setEnum("MoneyOPEnum1", ["add", "reduce", "set"]);
                    nc.setEnum("MoneyOPEnum2", ["query", "hist"]);
                    nc.setEnum("MoneyOPEnum3", ["top", "gui"]);
                    nc.setEnum("MoneyOPEnum4", ["pay"]);
                    nc.mandatory("MoneyOP1", ParamType.Enum, "MoneyOPEnum1", "MoneyOP1", 1);
                    nc.mandatory("MoneyOP2", ParamType.Enum, "MoneyOPEnum2", "MoneyOP2", 1);
                    nc.mandatory("MoneyOP3", ParamType.Enum, "MoneyOPEnum3", "MoneyOP3", 1);
                    nc.mandatory("MoneyOP4", ParamType.Enum, "MoneyOPEnum4", "MoneyOP4", 1);
                    nc.optional("playerName", ParamType.String);
                    nc.optional("target", ParamType.Player);
                    nc.optional("num", ParamType.Int);
                    nc.optional("note", ParamType.Message);
                    nc.overload([]);
                    nc.overload(["MoneyOP1", "target", "num"]);
                    nc.overload(["MoneyOP1", "playerName", "num"]);
                    nc.overload(["MoneyOP2", "target"]);
                    nc.overload(["MoneyOP2", "playerName"]);
                    nc.overload(["MoneyOP3"]);
                    nc.overload(["MoneyOP4", "target", "num", "note"]);
                    nc.overload(["MoneyOP4", "playerName", "num", "note"]);
                    nc.setCallback((_cmd, ori, out, res) => {
                        try {
                            let pl = ori.player, isPlayer = true;
                            if (!pl) {
                                isPlayer = false;
                            }
                            let type = (res.MoneyOP1 || res.MoneyOP2 || res.MoneyOP3 || res.MoneyOP4 || "gui");
                            let oriLevel = getOriginLevel(ori);
                            let hasColor = (oriLevel == "console" ? false : true);
                            if (!isPlayer && ori.entity != null) {
                                out.error(addLogo(Tr(pl, "command.not.allow.entity"), hasColor));
                                return;
                            }
                            if (pl != null && isSimulatedPlayer(pl)) {
                                out.error(addLogo(Tr(pl, "command.not.allow.simulation.player"), hasColor));
                                return;
                            }
                            switch (type) {
                                case "gui": {
                                    if (isPlayer) {
                                        MoneyMainGui(pl);
                                    } else {
                                        out.error(addLogo(Tr(pl, "command.not.allow.console.gui"), hasColor));
                                    }
                                    break;
                                }
                                case "set":
                                case "reduce":
                                case "add": {
                                    let playerNames = (res.playerName != null ? [res.playerName] : []);
                                    if (res.target != null) {
                                        res.target.forEach((pl) => { playerNames.push(pl.realName) });
                                    }
                                    let val = res.num;
                                    if (oriLevel == "other" || oriLevel == "notop") {
                                        out.error(addLogo(Tr(pl, "command.not.allow.perm"), hasColor));
                                        return;
                                    }
                                    if (playerNames.length == 0 || val == null) {
                                        if (isPlayer) {
                                            MoneySetGui(pl);
                                        } else {
                                            out.error(addLogo(Tr(pl, "command.not.allow.console.gui"), hasColor));
                                        }
                                    } else {
                                        val = (type == "add" || type == "set" ? val : -val);
                                        playerNames.forEach((playerName) => {
                                            let hasMoney = getMoney(playerName);
                                            if (hasMoney == null) {
                                                out.error(addLogo(Tr(pl, "command.not.allow.console.gui"), hasColor));
                                            } else {
                                                if (setMoney(playerName, (type != "set" ? (hasMoney + val) : val))) {
                                                    WriteUseLog(AutoReplace("Money-{1}", (type == "set" ? "Set" : "Add")), pl, `->${playerName}(${val})`);
                                                    out.success(addLogo(Tr(pl, "money.operation.completed"), hasColor));
                                                }
                                            }
                                        });
                                    }
                                    break;
                                }
                                case "pay": {
                                    let playerNames = (res.playerName != null ? [res.playerName] : []);
                                    if (res.target != null) {
                                        res.target.forEach((pl) => { playerNames.push(pl.realName) });
                                    }
                                    let val = res.num;
                                    let note = (res.note || "pay");
                                    if (playerNames.length == 0 || val == null) {
                                        if (isPlayer) {
                                            MoneyPayGui(pl);
                                        } else {
                                            out.error(addLogo(Tr(pl, "command.not.allow.console.gui"), hasColor));
                                            return;
                                        }
                                    } else {
                                        if (val < 0) {
                                            out.error(addLogo(Tr(pl, "money.pay.input.number.error")));
                                            return;
                                        }
                                        playerNames.forEach((playerName) => {
                                            let feeOrBool = tranMoney(pl.realName, playerName, val, note);
                                            if (typeof (feeOrBool) == "number") {
                                                WriteUseLog("Money-Pay", pl, `->${playerName}(${val}-${feeOrBool})`);
                                                out.success(addLogo(AutoReplace(Tr(pl, "money.pay.success"), playerName, feeOrBool, fs.get("TMET").get("Money")["MoneyName"])));
                                            } else {
                                                out.error(addLogo(Tr(pl, "money.pay.fail")));
                                            }
                                        });
                                    }
                                    break;
                                }
                                case "top": {
                                    if (isPlayer) {
                                        MoneyTopGui(pl);
                                    } else {
                                        out.error(addLogo(Tr(pl, "command.not.allow.console.gui"), hasColor));
                                    }
                                    break;
                                }
                                case "query": {
                                    let playerNames = (res.playerName != null ? [res.playerName] : (isPlayer ? [pl.realName] : []));
                                    if (res.target != null) {
                                        res.target.forEach((pl) => { playerNames.push(pl.realName) });
                                    }
                                    if (playerNames.length == 0) {
                                        out.error(addLogo(Tr(pl, "command.target.not.player"), hasColor));
                                        return;
                                    }
                                    playerNames.forEach((playerName) => {
                                        let hasVal = getMoney(playerName);
                                        if (hasVal == null) {
                                            out.error(addLogo(AutoReplace(Tr(pl, "money.notfound.player.info1"), playerName), hasColor));
                                            return;
                                        }
                                        let txt = "", MoneyName = fs.get("TMET").get("Money")["MoneyName"];
                                        if (isPlayer && playerName == pl.realName) {
                                            txt = AutoReplace(Tr(pl, "money.query.self"), hasVal, MoneyName);
                                        } else {
                                            txt = AutoReplace(Tr(pl, "money.query.other"), playerName, hasVal, MoneyName);
                                        }
                                        WriteUseLog("Money-Query", pl, `->${playerName}(${hasVal})`);
                                        out.success(addLogo(txt, hasColor));
                                    });
                                    break;
                                }
                                case "hist": {
                                    let playerNames = (res.playerName != null ? [res.playerName] : []);
                                    if (res.target != null) {
                                        res.target.forEach((pl) => { playerNames.push(pl.realName) });
                                    }
                                    if (playerNames.length > 1) {
                                        out.error(addLogo(Tr(pl, "command.target.only.one.player")));
                                        return;
                                    }
                                    if (isPlayer) {
                                        MoneyHistoryList(pl, (playerNames.length != 0 ? playerNames[0] : null), out);
                                    } else {
                                        out.error(addLogo(Tr(pl, "command.not.allow.console.gui"), hasColor));
                                    }
                                }
                            }
                        } catch (e) {
                            ErrorMsg(e);
                            out.error(addLogo("错误: Command running error, please contact administrator!", false));//不需要翻译
                        }
                    });
                    nc.setup();
                });
            }

            /**
             * @param {Player} pl 
             */
            function MoneyMainGui(pl) {
                let buttons = [
                    Tr(pl, "money.main.gui.button.pay"),
                    Tr(pl, "money.main.gui.button.top"),
                    Tr(pl, "money.main.gui.button.hist")
                ];
                if (pl.permLevel != 0) { buttons.push(Tr(pl, "money.main.gui.button.op.fast.mgr")); }
                pl.sendSimpleForm("§l§dMoneyGui", Tr(pl, "form.please.select"), buttons, new Array(buttons.length).fill(""), (pl, id) => {
                    if (id == null) {
                        ST(pl, addLogo(Tr(pl, "form.give.up")));
                        return;
                    }
                    switch (id) {
                        case 0: {
                            pl.runcmd("/money pay");
                            break;
                        }
                        case 1: {
                            pl.runcmd("/money top");
                            break;
                        }
                        case 2: {
                            pl.runcmd("/money hist");
                            break;
                        }
                        case 3: {
                            pl.runcmd("/money set");
                        }
                    }
                });
            }

            /**
             * @param {Player} pl 
             * @param {string} title 
             * @param {(pl:Player,info:{"name":string,"loss":boolean})} cb 
             */
            function MoneySelectPlayer(pl, title, cb) {
                let StepSliders = [
                    Tr(pl, "money.select.player.gui.step.slider.online"),
                    Tr(pl, "money.select.player.gui.step.slider.offline")
                ];
                let nf = mc.newCustomForm();
                nf.setTitle(title);
                nf.addLabel(Tr(pl, "money.select.player.gui.label"));
                nf.addStepSlider(Tr(pl, "money.select.player.gui.step.slider.title"), StepSliders);
                pl.sendForm(nf, (pl, args) => {
                    if (args == null) {
                        ST(pl, addLogo(Tr(pl, "form.give.up")));
                        return;
                    }
                    /**
                     * @type {Array<{"name":string,"loss":boolean}>}
                     */
                    let list = [];
                    let buttons = [];
                    switch (args[1]) {
                        case 0: {
                            GlobalCache.PlayerState.forEach((_bool, xuid) => {
                                let name = data.xuid2name(xuid);
                                list.push({ "name": name, "loss": false });
                                buttons.push(name);
                            });
                            break;
                        }
                        case 1: {
                            let obj = JSON.parse(fs.get("MoneyData").read());
                            obj.forEach((_val, key) => {
                                let name = data.xuid2name(key);
                                list.push({ "name": (name || key), "loss": !name });
                                buttons.push((name || key));
                            });
                            break;
                        }
                    }
                    let sfd = new SelectFormData(title, Tr(pl, "money.select.player.gui2.content"), buttons, fs.get("TMET").get("SelectForm")["Subsection"], (pl, ids) => {
                        if (ids == null) {
                            ST(pl, addLogo(Tr(pl, "form.give.up")));
                            return;
                        }
                        if (ids.length != 1) {
                            ST(pl, addLogo(Tr(pl, "money.select.player.gui2.select.error")));
                            return;
                        }
                        let info = list[ids[0]];
                        if (info.loss) {
                            ST(pl, addLogo(Tr(pl, "money.select.player.gui2.select.error.player.info.lost")));
                            return;
                        }
                        cb(pl, info);
                    });
                    sendSelectForm(pl, sfd);
                });
            }

            /**
             * @param {Player} pl 
             */
            function MoneySetGui(pl) {
                MoneySelectPlayer(pl, "§l§dMoneyAdmin", (pl, info) => {
                    let nf = mc.newCustomForm();
                    nf.setTitle("§l§dMoneyAdmin");
                    nf.addLabel(AutoReplace(Tr(pl, "money.admin.form.label"), info.name, getMoney(info.name), fs.get("TMET").get("Money")["MoneyName"]));
                    nf.addSwitch(Tr(pl, "money.admin.form.add.mode.switch.title"), false);
                    nf.addInput(Tr(pl, "money.admin.form.input.title"), "(String)");
                    pl.sendForm(nf, (pl, args) => {
                        if (args == null) {
                            ST(pl, addLogo(Tr(pl, "form.give.up")));
                            return;
                        }
                        let [setMode, input] = [!args[1], args[2]];
                        if (!(/^-?\d+$/).test(input)) {
                            ST(pl, addLogo(Tr(pl, "money.form.input.error")));
                            return;
                        }
                        if (setMode) {
                            pl.runcmd(`/money set "${info.name}" ${input}`);
                        } else {
                            if (input > 0) {
                                pl.runcmd(`/money add "${info.name}" ${input}`);
                            } else {
                                pl.runcmd(`/money reduce "${info.name}" ${-input}`);
                            }
                        }
                    });
                });
            }

            /**
             * @param {Player} pl 
             */
            function MoneyPayGui(pl) {
                MoneySelectPlayer(pl, "§l§dMoneyPay", (pl, info) => {
                    let nf = mc.newCustomForm();
                    nf.setTitle("§l§dMoneyPay");
                    nf.addLabel(AutoReplace(Tr(pl, "money.pay.form.label"),
                        info.name, getMoney(pl.realName), getMoney(info.name), fs.get("TMET").get("Money")["MoneyName"], getPayTax().toFixed(2)));
                    nf.addInput(Tr(pl, "money.pay.form.input.title"), "(+Number)");
                    if (!isLLMoney) {
                        nf.addInput(Tr(pl, "money.pay.form.note.input.title"), "(String)", "pay");
                    }
                    pl.sendForm(nf, (pl, args) => {
                        if (args == null) {
                            ST(pl, addLogo(Tr(pl, "form.give.up")));
                            return;
                        }
                        let num = args[1];
                        if (!(/^-?\d+$/).test(num)) {
                            ST(pl, addLogo(Tr(pl, "money.form.input.error")));
                            return;
                        }
                        pl.runcmd(`/money pay "${info.name}" ${num}${!!args[2] ? " " + args[2] : ""}`);
                    });
                });
            }

            /**
             * @param {Player} pl 
             */
            function MoneyTopGui(pl) {
                let allData = JSON.parse(fs.get("MoneyData").read());
                let MoneyCfg = fs.get("TMET").get("Money");
                let MaxRankingQuantity = MoneyCfg["MaxRankingQuantity"], MoneyName = MoneyCfg["MoneyName"];
                /**
                 * @type {Array<{"name":string,"money":number,"loss":boolean}>}
                 */
                let list = [];
                allData.forEach((_val, xuid) => {
                    let name = data.xuid2name(xuid);
                    if (!name) {
                        list.push({ "name": xuid, "money": _val, "loss": true });
                        return;
                    }
                    let HasMoney = getMoney(name);
                    list.push({ "name": name, "money": HasMoney, "loss": true });
                });
                list.sort((a, b) => { return (b.money - a.money); });
                /** @type {string[]} */
                let arr = [];
                let i = 0;
                list.find((obj) => {
                    if (MaxRankingQuantity < 0 || i < MaxRankingQuantity) {
                        arr.push(`§b${(i + 1)}.§e${obj.name} §a${obj.money} §f${MoneyName}`);
                    } else { return true; }
                    i++;
                    return false;
                });
                // let nf = mc.newCustomForm();
                // nf.setTitle("§l§dMoneyRanking");
                let realName = pl.realName;//防动态获取
                let selfData = list.find((obj) => {
                    if (obj.name == realName) {
                        return true;
                    } else {
                        return false;
                    }
                });
                // if (selfData != null) {
                //     nf.addLabel(`§b${(selfData[1] + 1)}.§e${selfData[0].name} §a${selfData[0].money} §f${MoneyName}`);
                // }
                let sfd = new SelectFormData("§l§dMoneyRanking", `Top ${MaxRankingQuantity}:`, arr, fs.get("TMET").get("SelectForm")["Subsection"], () => { });

                sendSelectForm(pl, sfd);

                // nf.addLabel(arr.join("\n"));
                // pl.sendForm(nf, (_p, _a) => { });
                WriteUseLog("Money-LookTop", pl, "");
            }

            /**
             * @param {Player} pl 
             * @param {?string} playerName
             * @param {?CommandOutput} out
             */
            function MoneyHistoryList(pl, playerName = null, out) {
                if (pl.permLevel == 0 && playerName == null) {
                    playerName = pl.realName;
                } else if (pl.permLevel == 0) {
                    out.error(addLogo(Tr(pl, "command.not.allow.perm")));
                    return;
                }
                if (playerName == null) {
                    pl.sendModalForm("§l§dMoneyHistory", Tr(pl, "money.check.history.admin.form.content"), Tr(pl, "money.check.history.admin.form.check.other"), Tr(pl, "money.check.history.admin.form.check.self"), (pl, bool) => {
                        if (bool) {
                            MoneySelectPlayer(pl, "§l§dMoneyHistory", (pl, info) => {
                                pl.runcmd(`/money hist "${info.name}"`);
                            });
                        } else {
                            pl.runcmd(`/money hist "${pl.realName}"`);
                        }
                    });
                } else {
                    let xuid = data.name2xuid(playerName);
                    if (!xuid) {
                        out.error(addLogo(Tr(pl, "money.notfound.player.info")));
                        return;
                    }
                    let histList = getHistory(xuid);
                    if (histList == null || histList.length == 0) {
                        out.error(addLogo(Tr(pl, "money.check.history.notfound")));
                        return;
                    }
                    let arr = [], lineInfo = Tr(pl, "money.check.history.form.line.info");
                    histList.forEach((obj, i) => {
                        let timeObj = new Date(obj.time * 1000);
                        let timeStr = AutoReplace("{1}/{2}/{3} {4}:{5}:{6}",
                            timeObj.getFullYear(),
                            (timeObj.getMonth() + 1),
                            timeObj.getDate(),

                            timeObj.getHours().toFull(2),
                            timeObj.getMinutes().toFull(2),
                            timeObj.getSeconds().toFull(2)
                        );
                        arr.push(AutoReplace(lineInfo,
                            (i + 1),
                            timeStr,
                            (data.xuid2name(obj.from) || obj.from),
                            (data.xuid2name(obj.to) || obj.to),
                            obj.money,
                            obj.note
                        ));
                    });
                    let nf = mc.newCustomForm();
                    // nf.setTitle("§l§dMoneyHistory");
                    // nf.addLabel(AutoReplace(Tr(pl, "money.check.history.form.select.player"), playerName));
                    // nf.addLabel(arr.join("\n"));
                    // pl.sendForm(nf, (_p, _a) => { });
                    let sfd = new SelectFormData("§l§dMoneyHistory", AutoReplace(Tr(pl, "money.check.history.form.select.player"), playerName), arr, fs.get("TMET").get("SelectForm")["Subsection"], () => { });
                    sendSelectForm(pl, sfd);
                    WriteUseLog("Money-LookHistory", pl, `->${playerName}`);
                }
            }

            /**
             * @param {string} xuid 
             * @param {string} toXuid 
             * @param {number} val 
             * @param {string} note 
             * @returns 
             */
            function addHistory(xuid, toXuid, val, note = "pay") {
                let MoneyCfg = fs.get("TMET").get("Money");
                if (MoneyCfg["MoneyType"] != "score" || MoneyCfg["HistoryLength"] == 0) {
                    return false;
                }
                let History = fs.get("History");
                if (History == null) { return false; }
                let HistoryData = History.get(xuid, []);
                let Obj = {
                    "from": xuid,
                    "to": toXuid,
                    "money": val,
                    "time": Math.floor(Date.now() / 1000),
                    "note": note
                }
                if (typeOfEx(HistoryData) != "Array") {
                    HistoryData = [Obj];
                } else { HistoryData.unshift(Obj); }
                if (MoneyCfg["HistoryLength"] < 0) {
                    while (MoneyCfg["HistoryLength"] < HistoryData.length) {
                        HistoryData.pop();
                    }
                }
                History.set(xuid, HistoryData);
                return true;
            }

            /**
             * @param {string} xuid 
             * @param {?number} time 
             * @returns {(null|Array<{"from":string,"to":string,"money":number,"time":number,"note":string}>)}
             */
            function getHistory(xuid, time = -1) {
                let nowTime = Math.floor(Date.now() / 1000);
                let History = fs.get("History");
                if (History == null) { return null; }
                /**
                 * @type {(null|Array<{"from":string,"to":string,"money":number,"time":number,"note":string})}
                 */
                let HistoryData = History.get(xuid, []);
                if (typeOfEx(HistoryData) != "Array") { return null; }
                if (HistoryData.length == 0) { return []; }
                HistoryData.sort((a, b) => { return b.time - a.time; });
                if (time <= -1) {
                    return HistoryData;
                }
                let arr = [];
                HistoryData.find((o, i) => {
                    if ((nowTime - o.time) <= time) {
                        arr.push(HistoryData[i]);
                    } else { return true; }
                    return false;
                });
                return arr;
            }

            /**
             * @param {string} xuid 
             * @returns {boolean}
             */
            function clearHistory(xuid) {
                let History = fs.get("History");
                return History.delete(xuid);
            }

            /**
             * @param {Player} pl 
             * @param {number} num
             */
            function AutoFixScoreBug(pl, num) {
                let ScoreBoard = mc.getScoreObjective("money");
                if (ScoreBoard == null) {
                    mc.newScoreObjective("money", "money");
                }
                let out = runCmdNoOutput(`scoreboard players set "${pl.name}" money ${num}`);
                logger.debug(`FixScoreBug::CmdOutput: ${out}`);
                return true;
            }

            /**
             * @returns {number}//float
             */
            function getPayTax() {
                let tax = 0.0;
                switch (fs.get("TMET").get("Money")["MoneyType"]) {
                    case "score":
                        tax = fs.get("TMET").get("Money")["PayTaxRate"];
                        break;
                    case "llmoney":
                        tax = fs.get("llmoneyConf").get("pay_tax", 0.0);
                        let conf = fs.get("TMET").get("Money");
                        if (conf.PayTaxRate != tax) {
                            logger.warn(Tr(null, "money.tax.sync.tip"));
                            conf.PayTaxRate = tax;
                            fs.get("TMET").set("Money", conf);
                        }
                        break;
                }
                return +tax;
            }

            /**
             * @param {string} realName 
             * @param {number} val 
             * @param {?("init"|"set"|"sync")} type
             * @param {?boolean} isTarn
             * @param {?string} note
             * @returns {(boolean|null)}
             */
            function setMoney(realName, val, type = "set", isTarn = false, note = "") {
                try {
                    if (!type) { type = "set"; }
                    if (isTarn == null) { isTarn = false; }
                    if (typeof (realName) != "string" || typeof (val) != "number") {
                        return false;
                    }
                    let TMETCfg = fs.get("TMET");
                    if (!TMETCfg.get("Money")["Enable"]) {
                        return true;
                    }
                    let MoneyData = fs.get("MoneyData");
                    if (MoneyData == null) { return false; }
                    let MoneyType = TMETCfg.get("Money")["MoneyType"];
                    let PlayerXuid = data.name2xuid(realName);
                    if (!!PlayerXuid) {
                        let OldVal = MoneyData.get(PlayerXuid, null);
                        if (OldVal == val && type != "join") {//旧值等于新值
                            return true;
                        }

                        if (!isTarn) {
                            if (!Event_MoneyChangeExample(PlayerXuid, val, type, note) && type != "sync") {
                                return false;
                            }
                        }

                        let pl = mc.getPlayer(PlayerXuid);
                        if (pl != null) {//在线操作
                            MoneyData.set(PlayerXuid, val);
                            switch (MoneyType) {
                                case "score": {
                                    let scoreOldVal = pl.getScore("money");
                                    if (scoreOldVal == null) {
                                        logger.debug(`LLSE:PlayerClass::GetScore API Error! Player: ${realName} money set to 0!`);
                                        AutoFixScoreBug(pl, 0);
                                    }
                                    pl.setScore("money", val);
                                    if (val != 0 && pl.getScore("money") != val) {
                                        logger.debug(`LLSE:PlayerClass::SetScore API Error! Player: ${realName} money set to ${val}!`);
                                        AutoFixScoreBug(pl, val);
                                    }
                                    if (TMETCfg.get("Money")["MoneyChangeMsg"]) {
                                        switch (type) {
                                            case "sync":
                                            case "set": {
                                                ST(pl, addLogo(AutoReplace(Tr(pl, "money.change.tip"), val, TMETCfg.get("Money")["MoneyName"], ((val - scoreOldVal) || val - +OldVal))));
                                                break;
                                            }
                                            case "init": {
                                                ST(pl, addLogo(AutoReplace(Tr(pl, "money.init.tip"), val, TMETCfg.get("Money")["MoneyName"])));
                                                break;
                                            }
                                        }
                                    }
                                    if (!isTarn) {//add history
                                        let Val = ((val - scoreOldVal) || val - +OldVal);
                                        switch (type) {
                                            case "set": {
                                                addHistory(PlayerXuid, "", Val, (note || "System::Set"));
                                                break;
                                            }
                                            case "init": {
                                                addHistory(PlayerXuid, "", Val, `System::Init`);
                                                break;
                                            }
                                        }
                                    }
                                    break;
                                }
                                case "llmoney": {
                                    let LLMVal = money.get(PlayerXuid), DV = (val - LLMVal);
                                    if (LLMVal != val) {
                                        let ToMode = (DV >= 0 ? false : true);
                                        money.trans(...(ToMode ? [PlayerXuid, ""] : ["", PlayerXuid]), (ToMode ? -DV : DV), (note || "System::Set"));
                                    }
                                    if (TMETCfg.get("Money")["MoneyChangeMsg"]) {
                                        switch (type) {
                                            case "sync":
                                            case "set": {
                                                ST(pl, addLogo(AutoReplace(Tr(pl, "money.change.tip"), val, TMETCfg.get("Money")["MoneyName"], (val - OldVal))));
                                                break;
                                            }
                                            case "init": {
                                                ST(pl, addLogo(AutoReplace(Tr(pl, "money.init.tip"), val, TMETCfg.get("Money")["MoneyName"])));
                                                break;
                                            }
                                        }
                                    }
                                    break;
                                }
                            }
                            return true;
                        } else {//离线操作
                            switch (MoneyType) {
                                case "score": {
                                    MoneyData.set(PlayerXuid, val);
                                    if (!isTarn) {//add history
                                        let Val = (val - OldVal);
                                        switch (type) {
                                            case "set": {
                                                addHistory(PlayerXuid, "", Val, (note || "System::Set"));
                                                break;
                                            }
                                        }
                                    }
                                    break;
                                }
                                case "llmoney": {
                                    let LLMVal = money.get(PlayerXuid), DV = (val - LLMVal);
                                    if (LLMVal != val) {
                                        let ToMode = (DV >= 0 ? false : true);
                                        money.trans(...(ToMode ? [PlayerXuid, ""] : ["", PlayerXuid]), (ToMode ? -DV : DV), (note || "System::Set"));
                                    }
                                    break;
                                }
                            }
                            return true;
                        }
                    } else {
                        return false;
                    }
                    return false;
                } catch (e) {
                    ErrorMsg(e);
                    return null;
                }
            }

            /**
             * @param {string} realName 
             * @returns {(null|number)}
             */
            function getMoney(realName) {
                try {
                    if (typeof (realName) != "string") {
                        return null;
                    }
                    let TMETCfg = fs.get("TMET");
                    if (!TMETCfg.get("Money")["Enable"]) {
                        return 0;
                    }
                    let MoneyData = fs.get("MoneyData");
                    if (MoneyData == null) { return null; }
                    let MoneyType = TMETCfg.get("Money")["MoneyType"];
                    let PlayerXuid = data.name2xuid(realName);
                    if (!!PlayerXuid) {
                        let pl = mc.getPlayer(PlayerXuid);
                        if (pl != null) {
                            switch (MoneyType) {
                                case "score": {
                                    let scoreVal = pl.getScore("money");
                                    if (scoreVal == null) {
                                        let offData = +MoneyData.get(PlayerXuid, TMETCfg.get("Money")["PlayerInitialMoney"]);
                                        logger.debug(`LLSE:PlayerClass::GetScore API Error! Player: ${realName} money set to ${offData}!`);
                                        AutoFixScoreBug(pl, offData);
                                        scoreVal = offData;
                                    }
                                    return scoreVal;
                                }
                                case "llmoney": {
                                    let llmoneyVal = money.get(PlayerXuid);
                                    if (llmoneyVal == null) {
                                        let offData = +MoneyData.get(PlayerXuid, TMETCfg.get("Money")["PlayerInitialMoney"]);
                                        money.set(PlayerXuid, offData);
                                        llmoneyVal = offData;
                                    }
                                    return llmoneyVal;
                                }
                            }
                        } else {
                            switch (MoneyType) {
                                case "score": {
                                    return MoneyData.get(PlayerXuid, TMETCfg.get("Money")["PlayerInitialMoney"]);
                                }
                                case "llmoney": {
                                    let llmoneyVal = money.get(PlayerXuid);
                                    if (llmoneyVal == null) {
                                        let llmoneyDef = fs.get("llmoneyConf").get("def_money", 0);
                                        let offData = +MoneyData.get(PlayerXuid, llmoneyDef);
                                        money.set(PlayerXuid, offData);
                                        llmoneyVal = offData;
                                    }
                                    return llmoneyVal;
                                }
                            }
                        }
                    } else {
                        logger.debug(`Money::GetMoney Fail: The xuid of player ${realName} is not valid!`);
                    }
                    return null;
                } catch (e) {
                    ErrorMsg(e);
                    return null;
                }
            }

            /**
             * @param {string} realName 
             * @param {string} toRealName 
             * @param {number} val 
             * @param {?string} note 
             * @returns {(boolean|number)}
             */
            function tranMoney(realName, toRealName, val, note = "pay") {
                if (typeof (realName) != "string" || typeof (toRealName) != "string" || typeof (val) != "number" || typeof (note) != "string") {
                    return false;
                }
                let TMETCfg = fs.get("TMET");
                if (!TMETCfg.get("Money")["Enable"]) {
                    return false;
                }
                if ((/(^[1-9]\d*$)/).test(String(val))) {
                    let [pl1Xuid, pl2Xuid] = [data.name2xuid(realName), data.name2xuid(toRealName)];
                    if (!pl1Xuid || !pl2Xuid) {
                        return false;
                    }
                    let pl1HasMoney = getMoney(realName);
                    let pl2HasMoney = getMoney(toRealName);//只是一种安全检查
                    if (typeof (pl1HasMoney) == "number" && typeof (pl2HasMoney) == "number") {
                        if (val == 0) { return 0; }
                        if (pl1HasMoney >= val) {
                            let fee = Math.floor((val * +getPayTax()));
                            if (!Event_MoneyPayExample(pl1Xuid, pl2Xuid, val, fee, note)) {
                                return false;
                            }
                            switch (TMETCfg.get("Money")["MoneyType"]) {
                                case "score": {
                                    setMoney(realName, (pl1HasMoney - val), "set", true);
                                    setMoney(toRealName, (getMoney(toRealName) + val - fee), "set", true);
                                    logger.debug(`Money::TarnMoney ${realName} to ${toRealName} Val:${val}-${fee}`);
                                    addHistory(pl1Xuid, pl2Xuid, val, note);
                                    addHistory(pl2Xuid, pl1Xuid, val, note);
                                    break;
                                }
                                case "llmoney": {
                                    money.trans(pl1Xuid, pl2Xuid, val, note);
                                    if (!!fee) {
                                        money.trans(pl2Xuid, "", fee, "money pay fee");
                                    }
                                    if (TMETCfg.get("Money")["MoneyChangeMsg"]) {
                                        let [pl1, pl2] = [mc.getPlayer(pl1Xuid), mc.getPlayer(pl2Xuid)];
                                        let MoneyName = TMETCfg.get("Money")["MoneyName"];
                                        let changeTip = Tr(pl, "money.change.tip");
                                        if (!!pl1) {
                                            ST(pl1, addLogo(AutoReplace(changeTip, getMoney(realName), MoneyName, (-val))));
                                        }
                                        if (!!pl2) {
                                            ST(pl2, addLogo(AutoReplace(changeTip, getMoney(toRealName), MoneyName, (val - fee))))
                                        }
                                    }
                                    break;
                                }
                            }
                            return fee;
                        }
                    }
                }
                return false;
            }

            Modules._RegExportApi("getMoney", getMoney);
            Modules._RegExportApi("setMoney", setMoney);
            Modules._RegExportApi("tranMoney", tranMoney);
            Modules._RegExportApi("getPayTax", getPayTax);
            Modules._RegExportApi("getHistory", getHistory);
            Modules._RegExportApi("clearHistory", clearHistory);
            Modules._RegExportApi("getMoneyName", () => { return fs.get("TMET").get("Money")["MoneyName"]; });
            Modules._RegExportApi("getMoneyType", () => { return fs.get("TMET").get("Money")["MoneyType"]; });



            /**
             * @param {Player} pl 
             */
            function Money_onJoin(pl) {
                if (isSimulatedPlayer(pl)) { return true; }
                let MoneyCfg = fs.get("TMET").get("Money");
                let MoneyData = fs.get("MoneyData");
                let offData = MoneyData.get(pl.xuid);
                let InitVal = MoneyCfg["PlayerInitialMoney"];
                switch (MoneyCfg["MoneyType"]) {
                    case "score": {
                        let scoreVal = pl.getScore("money");
                        if (scoreVal == null) {
                            AutoFixScoreBug(pl, 0);
                        }
                        if (typeOfEx(offData) == "Number") {//No Init
                            if (scoreVal != offData) {
                                setMoney(pl.realName, offData, "sync");
                            }
                        } else {//Init?
                            if (scoreVal == 0) {//Init!
                                setMoney(pl.realName, InitVal, "init") && WriteUseLog("Money-Init", pl, InitVal);
                            } else {//Soft
                                MoneyData.set(pl.xuid, scoreVal);
                                WriteUseLog("Money-Sync-Score", pl, scoreVal);
                            }
                        }
                        break;
                    }
                    case "llmoney": {
                        let llmoneyVal = money.get(pl.xuid);
                        if (llmoneyVal != offData) {
                            setMoney(pl.realName, llmoneyVal, "sync");
                            WriteUseLog("Money-Sync-LLMoney", pl, llmoneyVal);
                        }
                        break;
                    }
                }
            }

            /**
             * @param {string} xuid 玩家xuid
             * @param {number} moneyVal 
             */
            function Money_onLLMoneyMoneyChanged(xuid, moneyVal) {
                setMoney(data.xuid2name(xuid), moneyVal, "sync", false, "");
            }

            MoneyLoad();
        })();
        return true;
    }
    LoadTPA() {
        (() => {
            let Event_TPARequestExample = TMListen.RegEvent("onTPARequest", "TMET");
            let Event_TPAAcceptExample = TMListen.RegEvent("onTPAAccept", "TMET");
            let Event_TPADenyExample = TMListen.RegEvent("onTPADeny", "TMET");
            let Event_TPATimeoutExample = TMListen.RegEvent("onTPATimeout", "TMET");


            function TPALoad() {
                GlobalCache.TPACache = [];
                fs.set("TPASet", new JsonConfigFileClass(AutoReplace(TMET_DataDir, "tpasetting.json"), "{}"));
                RegTPACmd();
                TMListen.listen("onLeft", TPA_onLeft);
                setInterval(TPALoopCheck, 500);
            }

            function RegTPACmd() {
                TMCmd.register("tpa", AutoReplace(Tr(null, "tpa.cmd.description"), fs.get("TMET").get("TPA")["ConsumeMoney"]), PermType.Any, 0x80, (nc) => {
                    nc.setEnum("TPA_OPEnum1", ["gui", "ui"]);
                    nc.setEnum("TPA_OPEnum2", ["to"]);
                    nc.mandatory("TPA_OP1", ParamType.Enum, "TPA_OPEnum1", "TPA_OP1", 1);
                    nc.mandatory("TPA_OP2", ParamType.Enum, "TPA_OPEnum2", "TPA_OP2", 1);
                    nc.optional("target", ParamType.Player);
                    nc.overload([]);
                    nc.overload(["TPA_OP1"]);
                    nc.overload(["TPA_OP2", "target"]);
                    nc.setCallback((_cmd, ori, out, res) => {
                        try {
                            let pl = ori.player;
                            let oriLevel = getOriginLevel(ori);
                            let hasColor = (oriLevel == "console" ? false : true);
                            if (pl == null) {
                                out.error(addLogo(Tr(pl, "command.not.allow.not.player"), hasColor));
                                return;
                            } else {
                                if (isSimulatedPlayer(pl)) {
                                    out.error(addLogo(Tr(pl, "command.not.allow.simulation.player"), hasColor));
                                    return;
                                }
                            }
                            let type = (res.target == null ? (res.TPA_OP1 || "gui") : "tpa");
                            switch (type) {
                                case "gui": {
                                    TPA_Gui(pl, false);
                                    break;
                                }
                                case "tpa": {
                                    if (res.target.length != 1) {
                                        out.error(addLogo(Tr(pl, "command.target.only.one.player")));
                                        return;
                                    }
                                    TPA_Request(pl, res.target[0], out, false);
                                    break;
                                }
                                case "ui": {
                                    let TPASet = fs.get("TPASet");
                                    let bool = TPASet.get(pl.xuid, true);
                                    if (bool) {
                                        TPASet.set(pl.xuid, false);
                                        out.success(addLogo(Tr(pl, "tpa.ui.false")));
                                    } else {
                                        TPASet.set(pl.xuid, true);
                                        out.success(addLogo(Tr(pl, "tpa.ui.true")));
                                    }
                                    WriteUseLog("TPA-UI", pl, !bool);
                                    break;
                                }
                            }
                        } catch (e) {
                            ErrorMsg(e);
                            out.error(addLogo("错误: Command running error, please contact administrator!", false));//不需要翻译
                        }
                    });
                    nc.setup();
                });

                TMCmd.register("tpahere", AutoReplace(Tr(null, "tpahere.cmd.description"), fs.get("TMET").get("TPA")["ConsumeMoney"]), PermType.Any, 0x80, (nc) => {
                    nc.setEnum("TPAHere_OPEnum1", ["to"]);
                    nc.mandatory("TPAHere_OP1", ParamType.Enum, "TPAHere_OPEnum1", "TPAhere_OP1")
                    nc.optional("target", ParamType.Player);
                    nc.overload([]);
                    nc.overload(["TPAHere_OP1", "target"]);
                    nc.setCallback((_cmd, ori, out, res) => {
                        try {
                            let pl = ori.player;
                            let oriLevel = getOriginLevel(ori);
                            let hasColor = (oriLevel == "console" ? false : true);
                            if (pl == null) {
                                out.error(addLogo(Tr(pl, "command.not.allow.not.player"), hasColor));
                                return;
                            } else {
                                if (isSimulatedPlayer(pl)) {
                                    out.error(addLogo(Tr(pl, "command.not.allow.simulation.player"), hasColor));
                                    return;
                                }
                            }
                            let type = (res.target == null ? "gui" : "tpa");
                            switch (type) {
                                case "gui": {
                                    TPA_Gui(pl, true);
                                    break;
                                }
                                case "tpa": {
                                    if (res.target.length != 1) {
                                        out.error(addLogo(Tr(pl, "command.target.only.one.player")));
                                        return;
                                    }
                                    TPA_Request(pl, res.target[0], out, true);
                                    break;
                                }
                            }
                        } catch (e) {
                            ErrorMsg(e);
                            out.error(addLogo("错误: Command running error, please contact administrator!", false));//不需要翻译
                        }
                    });
                    nc.setup();
                });

                TMCmd.register("tpaaccept", Tr(null, "tpaaccept.cmd.description"), PermType.Any, 0x80, (nc) => {
                    nc.overload([]);
                    nc.setCallback((_cmd, ori, out, _res) => {
                        try {
                            let pl = ori.player;
                            let oriLevel = getOriginLevel(ori);
                            let hasColor = (oriLevel == "console" ? false : true);
                            if (pl == null) {
                                out.error(addLogo(Tr(pl, "command.not.allow.not.player"), hasColor));
                                return;
                            } else {
                                if (isSimulatedPlayer(pl)) {
                                    out.error(addLogo(Tr(pl, "command.not.allow.simulation.player"), hasColor));
                                    return;
                                }
                            }
                            TPA_Accept(pl, out);
                        } catch (e) {
                            ErrorMsg(e);
                            out.error(addLogo("错误: Command running error, please contact administrator!", false));//不需要翻译
                        }
                    });
                    nc.setup();
                });

                TMCmd.register("tpadeny", Tr(null, "tpadeny.cmd.description"), PermType.Any, 0x80, (nc) => {
                    nc.overload([]);
                    nc.setCallback((_cmd, ori, out, _res) => {
                        try {
                            let pl = ori.player;
                            let oriLevel = getOriginLevel(ori);
                            let hasColor = (oriLevel == "console" ? false : true);
                            if (pl == null) {
                                out.error(addLogo(Tr(pl, "command.not.allow.not.player"), hasColor));
                                return;
                            } else {
                                if (isSimulatedPlayer(pl)) {
                                    out.error(addLogo(Tr(pl, "command.not.allow.simulation.player"), hasColor));
                                    return;
                                }
                            }
                            TPA_Deny(pl, out);
                        } catch (e) {
                            ErrorMsg(e);
                            out.error(addLogo("错误: Command running error, please contact administrator!", false));//不需要翻译
                        }
                    });
                    nc.setup();
                });
            }

            function TPALoopCheck() {
                let nowTime = Date.now();
                let ET = fs.get("TMET").get("TPA")["ExpirationTime"];
                /**
                 * @type {Array<{"from":string,"to":string,"time":number,"isHereMode":boolean}>}
                 */
                let a = GlobalCache.TPACache;
                a.forEach((obj, i) => {
                    if (((nowTime - obj.time) / 1000) > ET) {
                        let fromPl = mc.getPlayer(obj.from);
                        let toPl = mc.getPlayer(obj.to);
                        if (!Event_TPATimeoutExample(obj)) {
                            return;
                        }
                        WriteUseLog(`TPA-${(obj.isHereMode ? "Here-" : "")}Timeout`, fromPl, toPl.realName);
                        if (!obj.isHereMode) {
                            ST(fromPl, addLogo(AutoReplace(Tr(fromPl, "tpa.timeout.from.player.tip"), toPl.realName)));
                            ST(toPl, addLogo(AutoReplace(Tr(toPl, "tpa.timeout.to.player.tip"), fromPl.realName)));
                        } else {
                            ST(fromPl, addLogo(AutoReplace(Tr(fromPl, "tpahere.timeout.from.player.tip"), toPl.realName)));
                            ST(toPl, addLogo(AutoReplace(Tr(toPl, "tpahere.timeout.to.player.tip"), fromPl.realName)));
                        }
                        SafeDeleteArray(a, i);
                    }
                });
            }

            /**
             * @param {string} xuid 
             * @return {(null|[{"from":string,"to":string,"time":number,"isHereMode":boolean},number])} 
             */
            function getTPAData(xuid) {
                /**
                 * @type {Array<{"from":string,"to":string,"time":number,"isHereMode":boolean}>}
                 */
                let a = GlobalCache.TPACache;
                return a.find((obj) => {
                    if (obj.from == xuid || obj.to == xuid) {
                        return true;
                    }
                    return false;
                });
            }

            /**
             * @param {Player} pl 
             * @param {?boolean} isHere 
             */
            function TPA_Gui(pl, isHere = false) {
                let pls = [], tpaType = [
                    Tr(pl, "tpa.gui.type.to"),
                    Tr(pl, "tpa.gui.type.here")
                ];
                GlobalCache.PlayerState.forEach((bool, xuid) => {
                    if (bool) {
                        pls.push(data.xuid2name(xuid));
                    }
                });
                let nf = mc.newCustomForm();
                nf.setTitle("§l§dTPAGui");
                nf.addDropdown(Tr(pl, "tpa.gui.form.select.player.title"), pls, 0);
                nf.addDropdown(Tr(pl, "tpa.gui.form.select.tpa.type.title"), tpaType, (+isHere));
                nf.addLabel(AutoReplace(Tr(pl, "tpa.gui.form.label.title"), fs.get("TMET").get("TPA")["ConsumeMoney"]));
                pl.sendForm(nf, (pl, args) => {
                    if (args == null) {
                        ST(pl, addLogo(Tr(pl, "form.give.up")));
                        return;
                    }
                    let [selPlName, isHere] = [pls[args[0]], Boolean(args[1])];
                    if (isHere) {
                        pl.runcmd(`/tpahere to "${selPlName}"`);
                    } else {
                        pl.runcmd(`/tpa to "${selPlName}"`);
                    }
                });
            }

            /**
             * @param {Player} pl 
             * @param {Player} toPl 
             * @param {CommandOutput} out
             * @param {boolean} isHere
             */
            function TPA_Request(pl, toPl, out, isHere) {
                if (!toPl.xuid || isSimulatedPlayer(toPl)) {
                    out.error(addLogo(Tr(pl, "command.notfound.player")));
                    return;
                }
                if (getTPAData(toPl.xuid) != null) {
                    out.error(addLogo(Tr(pl, "tpa.select.player.has.request.tip")));
                    return;
                } else {
                    let cache = (getTPAData(pl.xuid) || [])[0];
                    if (cache != null) {
                        pl.sendModalForm(Tr(pl, "tpa.self.request.not.process.title"), AutoReplace(Tr(pl, "tpa.self.request.not.process.content"),
                            data.xuid2name(cache.from),
                            data.xuid2name(cache.to)
                        ), Tr(pl, "tpa.self.request.not.process.button.give.up.and.send.this.request"), Tr(pl, "tpa.self.request.not.process.button.give.up.this.request.and.wait.last.request"), (pl, res) => {
                            if (res) {
                                pl.runcmd("/tpadeny");
                                pl.runcmd(AutoReplace("/tpa{1} to \"{2}\"", (isHere ? "here" : ""), toPl.realName));
                            } else {
                                ST(pl, addLogo(Tr(pl, "tpa.self.request.not.process.res.wait.tip")));
                            }
                        });
                        return;
                    }
                }
                if (!Event_TPARequestExample(pl.xuid, toPl.xuid, isHere)) {
                    return;
                }
                GlobalCache.TPACache.push({ "from": pl.xuid, "to": toPl.xuid, "time": Date.now(), "isHereMode": isHere });
                out.success(addLogo(AutoReplace(Tr(pl, "tpa.request.success"), toPl.realName, (isHere ? Tr(pl, "tpa.request.here.string") : ""))));
                ST(toPl, addLogo(AutoReplace(Tr(toPl, "tpa.request.to.player.tip"), pl.realName, (isHere ? "Here" : ""))));
                if (fs.get("TPASet").get(toPl.xuid, true)) {
                    SendModalFormToPlayer(toPl, Tr(toPl, "tpa.request.to.player.form.title"), AutoReplace(Tr(toPl, "tpa.request.to.player.form.content"),
                        pl.realName, (isHere ? Tr(toPl, "tpa.request.here.string") : ""), fs.get("TMET").get("TPA")["ConsumeMoney"]
                    ), Tr(toPl, "tpa.request.to.player.form.button.accept"), Tr(toPl, "tpa.request.to.player.form.button.deny"), (pl, res) => {
                        if (res) {
                            pl.runcmd("/tpaaccept");
                        } else {
                            pl.runcmd("/tpadeny");
                        }
                    });
                }
                WriteUseLog(`TPA${isHere ? "-Here" : ""}-Request`, pl, toPl.realName);
            }

            /**
             * @param {Player} pl 
             * @param {CommandOutput} out
             */
            function TPA_Accept(pl, out) {
                let [cache, index] = (getTPAData(pl.xuid) || []);
                if (cache == null || (cache.from == pl.xuid && cache.to != pl.xuid)) {
                    out.error(addLogo(Tr(pl, "tpa.process.notfound.request")));
                    return;
                }
                let fromPl = mc.getPlayer(cache.from);
                if (fromPl == null) {
                    out.error(addLogo(Tr(pl, "tpa.accept.from.player.lost")));
                    return;
                }
                let fromName = fromPl.realName;
                let getMoney = Modules.getApi("getMoney");
                /**
                 * @type {(realName:string,val:number,type:?("join"|"init"|"set"),isTarn:?boolean,note:?string)=>(boolean|null)}
                 */
                let setMoney = Modules.getApi("setMoney");

                let HasMoney = getMoney(fromName);
                let consume = +fs.get("TMET").get("TPA")["ConsumeMoney"];
                if (HasMoney >= consume) {
                    if (!Event_TPAAcceptExample(pl.xuid, cache)) {
                        return;
                    }
                    setMoney(fromName, (HasMoney - consume), "set", false, "TPAConsume");
                } else {
                    out.error(addLogo(Tr(pl, "tpa.accept.fail.money.to.player.tip")));
                    ST(fromPl, addLogo(Tr(fromPl, "tpa.accept.fail.money.from.player.tip")));
                    return;
                }

                if (!cache.isHereMode) {
                    fromPl.teleport(pl.pos);
                    ST(fromPl, addLogo(AutoReplace(Tr(fromPl, "tpa.accept.success.from.player.tip"), pl.realName)))
                    out.success(addLogo(AutoReplace(Tr(pl, "tpa.accept.success.to.player.tip"), fromName)));
                } else {
                    pl.teleport(fromPl.pos);
                    ST(fromPl, addLogo(AutoReplace(Tr(fromPl, "tpahere.accept.success.from.player.tip"), pl.realName)))
                    out.success(addLogo(AutoReplace(Tr(pl, "tpahere.accept.success.to.player.tip"), fromName)));
                }
                WriteUseLog(`TPA${cache.isHereMode ? "-Here" : ""}-AC`, pl, fromName);
                GlobalCache.TPACache.splice(index, 1);
            }

            /**
             * @param {Player} pl 
             * @param {CommandOutput} out
             */
            function TPA_Deny(pl, out) {
                let [cache, index] = (getTPAData(pl.xuid) || []);
                if (cache == null) {
                    out.error(addLogo(Tr(pl, "tpa.process.notfound.request")));
                    return;
                }
                let pl2 = mc.getPlayer((cache.from == pl.xuid ? cache.to : cache.from));
                let pl2Name = data.xuid2name((cache.from == pl.xuid ? cache.to : cache.from));

                if (!Event_TPADenyExample(pl.xuid, cache, false)) {
                    return;
                }

                if (cache.from == pl.xuid) {
                    out.error(addLogo(Tr(pl, "tpa.deny.self.request.self.tip")));
                    if (pl2 != null) {
                        ST(pl2, addLogo(Tr(pl2, "tpa.deny.self.request.to.player.tip")));
                    }
                } else if (!cache.isHereMode) {
                    out.error(addLogo(AutoReplace(Tr(pl, "tpa.deny.other.tpa.to.player.tip"), pl2Name)));
                    if (pl2 != null) {
                        ST(pl2, addLogo(AutoReplace(Tr(pl2, "tpa.deny.other.tpa.from.player.tip"), pl.realName)));
                    }
                } else {
                    out.error(addLogo(AutoReplace(Tr(pl, "tpa.deny.other.tpahere.to.player.tip"), pl2Name)));
                    if (pl2 != null) {
                        ST(pl2, addLogo(AutoReplace(Tr(pl2, "tpa.deny.other.tpahere.from.player.tip"), pl.realName)));
                    }
                }
                WriteUseLog(`TPA${cache.isHereMode ? "-Here" : ""}-DE`, pl, pl2Name);
                GlobalCache.TPACache.splice(index, 1);
            }

            Modules._RegExportApi("getTPAData", getTPAData);
            Modules._RegExportApi("delTPAData", (xuid) => {
                let [cache, index] = (getTPAData(xuid) || []);
                if (cache == null) { return false; }
                GlobalCache.TPACache.splice(index, 1);
                return true;
            });

            /**
             * @param {Player} pl
             */
            function TPA_onLeft(pl) {
                if (isSimulatedPlayer(pl)) { return true; }
                let xuid = pl.xuid;
                let name = pl.realName;
                let [cache, index] = (getTPAData(xuid) || []);
                if (cache != null) {
                    if (!Event_TPADenyExample(pl.xuid, cache, true)) {
                        if (cache.from == xuid) {
                            let pl2 = mc.getPlayer(cache.to);
                            ST(pl2, addLogo(AutoReplace(Tr(pl2, "tpa.left.to.player.tip"), name)));
                            WriteUseLog(`TPA${cache.isHereMode ? "-Here" : ""}-Left`, pl, pl2.realName);
                        } else {
                            let pl2 = mc.getPlayer(cache.from);
                            ST(pl2, addLogo(AutoReplace(Tr(pl, "tpa.left.from.player.tip"), name)));
                            WriteUseLog(`TPA${cache.isHereMode ? "-Here" : ""}-Left`, pl, pl2.realName);
                        }
                    }
                    GlobalCache.TPACache.splice(index, 1);
                }
            }
            TPALoad();
        })();
        return true;
    }
    LoadWARP() {
        (() => {
            let Event_WARPAddExample = TMListen.RegEvent("onWARPAdd", "TMET");
            let Event_WARPGoExample = TMListen.RegEvent("onWARPGo", "TMET");
            let Event_WARPDelExample = TMListen.RegEvent("onWARPDel", "TMET");

            function WARPLoad() {
                fs.set("WARP", new JsonConfigFileClass(AutoReplace(TMET_DataDir, "warplist.json")));
                RegWARPCmd();
            }

            function RegWARPCmd() {
                TMCmd.register("warp", Tr(null, "warp.cmd.description"), PermType.Any, 0x80, (nc) => {
                    nc.setEnum("WARP_OPEnum1", ["gui", "ls"]);
                    nc.setEnum("WARP_OPEnum2", ["add", "go", "del"]);
                    nc.mandatory("WARP_OP1", ParamType.Enum, "WARP_OPEnum1", "WARP_OP1", 1);
                    nc.mandatory("WARP_OP2", ParamType.Enum, "WARP_OPEnum2", "WARP_OP2", 1);
                    nc.optional("WARPName", ParamType.String);
                    nc.overload([]);
                    nc.overload(["WARP_OP1"]);
                    nc.overload(["WARP_OP2", "WARPName"]);
                    nc.setCallback((_cmd, ori, out, res) => {
                        try {
                            let pl = ori.player;
                            let oriLevel = getOriginLevel(ori);
                            let hasColor = (oriLevel == "console" ? false : true);
                            let type = (res.WARP_OP1 || res.WARP_OP2 || "gui");
                            let hasPerm = (pl != null ? pl.permLevel != 0 : (oriLevel == "console" || oriLevel == "cb" || oriLevel == "op" ? true : false));
                            if (type != "ls") {
                                if (pl == null && (type == "del" ? !hasPerm : true)) {
                                    out.error(addLogo(Tr(pl, "command.not.allow.not.player"), hasColor));
                                    return;
                                } else if ((type == "del" ? !hasPerm : true) && (pl != null && isSimulatedPlayer(pl))) {
                                    out.error(addLogo(Tr(pl, "command.not.allow.simulation.player"), hasColor));
                                    return;
                                }
                            }
                            switch (type) {
                                case "gui": {
                                    WARPMainGui(pl, out);
                                    break;
                                }
                                case "ls": {
                                    let warps = fs.get("WARP").getKeys();
                                    if (warps.length == 0) {
                                        out.success(addLogo(Tr(pl, "warp.ls.list.empty"), hasColor));
                                        return;
                                    }
                                    out.success(addLogo(AutoReplace(Tr(pl, "warp.ls.msg"), warps.join("§r,")), hasColor));
                                    WriteUseLog("WARP-List", pl, "");
                                    break;
                                }
                                case "add": {
                                    if (oriLevel == "other" || oriLevel == "notop") {
                                        out.error(addLogo(Tr(pl, "command.not.allow.perm"), hasColor));
                                        return;
                                    }
                                    let warpName = res.WARPName;
                                    if (warpName == null) {
                                        WARPAddGui(pl);
                                        return;
                                    }
                                    let WarpData = fs.get("WARP");
                                    if (WarpData.get(warpName) != null) {
                                        out.error(addLogo(Tr(pl, "warp.add.fail.has"), hasColor));
                                        return;
                                    }
                                    if (!Event_WARPAddExample(pl.xuid, warpName)) {
                                        return;
                                    }
                                    let vec4 = Vector4.PosToVec4(ori.pos, `add WARP Name: "${warpName}"`).toDecimalPlaces(2);
                                    WarpData.set(warpName, vec4.toObject());
                                    out.success(addLogo(AutoReplace(Tr(pl, "warp.add.success"), warpName)));
                                    WriteUseLog("WARP-Add", pl, warpName);
                                    break;
                                }
                                case "go": {
                                    let warpName = res.WARPName;
                                    if (warpName == null) {
                                        WARPGoGui(pl, out);
                                        return;
                                    }
                                    let WarpInfo = fs.get("WARP").get(warpName);
                                    if (WarpInfo == null) {
                                        out.error(addLogo(AutoReplace(Tr(pl, "warp.go.fail.notfound"), warpName), hasColor));
                                        return;
                                    }
                                    /**
                                     * @type {(realName:string,val:number,type:?("join"|"init"|"set"),isTarn:?boolean,note:?string)=>(boolean|null)}
                                     */
                                    let setMoney = Modules.getApi("setMoney");
                                    let Consume = fs.get("TMET").get("WARP")["ConsumeMoney"],
                                        HasMoney = Modules.getApi("getMoney")(pl.realName);
                                    if (Consume > HasMoney) {
                                        out.error(addLogo(Tr(pl, "warp.go.fail.money"), hasColor));
                                        return;
                                    }
                                    if (!Event_WARPGoExample(pl.xuid, warpName)) {
                                        return;
                                    }
                                    if (setMoney(pl.realName, (HasMoney - Consume), "set", false, "WARPConsume")) {
                                        let vec4 = Vector4.PosToVec4(WarpInfo, `go WARP Name: "${warpName}"`);
                                        pl.teleport(vec4.toPos());
                                        out.success(addLogo(AutoReplace(Tr(pl, "warp.go.success"), warpName)));
                                        WriteUseLog("WARP-Go", pl, warpName);
                                    } else {
                                        out.error(addLogo(Tr(pl, "warp.go.fail.error")));
                                    }
                                    break;
                                }
                                case "del": {
                                    if (oriLevel == "other" || oriLevel == "notop") {
                                        out.error(addLogo(Tr(pl, "command.not.allow.perm"), hasColor));
                                        return;
                                    }
                                    let warpName = res.WARPName;
                                    if (warpName == null) {
                                        if (pl != null) {
                                            WARPDelGui(pl, out);
                                        } else {
                                            out.error(Tr(pl, "command.not.allow.console.gui1"));
                                        }
                                        return;
                                    }
                                    let WarpData = fs.get("WARP");
                                    let WarpInfo = WarpData.get(warpName);
                                    if (WarpInfo == null) {
                                        out.error(addLogo(AutoReplace(Tr(pl, "warp.del.fail.notfound"), warpName), hasColor));
                                        return;
                                    }
                                    if (!Event_WARPDelExample((pl != null ? pl.xuid : ""), warpName)) {
                                        return;
                                    }
                                    WarpData.delete(warpName);
                                    out.success(addLogo(AutoReplace(Tr(pl, "warp.del.success"), warpName), hasColor));
                                    WriteUseLog("WARP-Del", pl, warpName);
                                    break;
                                }
                            }
                        } catch (e) {
                            ErrorMsg(e);
                            out.error(addLogo("错误: Command running error, please contact administrator!", false));//不需要翻译
                        }
                    });
                    nc.setup();
                });
            }

            /**
             * @param {Player} pl
             * @param {CommandOutput} out
             */
            function WARPMainGui(pl, out) {
                if (pl.permLevel == 0) {
                    WARPGoGui(pl, out);
                    return;
                }
                let buttons = [
                    Tr(pl, "warp.main.gui.button.add"),
                    Tr(pl, "warp.main.gui.button.go"),
                    Tr(pl, "warp.main.gui.button.del")
                ];
                pl.sendSimpleForm("§l§dWARPGui", Tr(pl, "warp.main.gui.content"), buttons, new Array(buttons.length).fill(""), (pl, id) => {
                    if (id == null) {
                        ST(pl, addLogo(Tr(pl, "form.give.up")));
                        return;
                    }
                    switch (id) {
                        case 0: {//add
                            pl.runcmd(`/warp add`);
                            break;
                        }
                        case 1: {//go
                            pl.runcmd(`/warp go`);
                            break;
                        }
                        case 2: {//del
                            pl.runcmd(`/warp del`);
                            break;
                        }
                    }
                });
            }

            /**
             * @param {Player} pl 
             * @param {CommandOutput} out
             */
            function WARPGoGui(pl, out) {
                let warps = fs.get("WARP").getKeys();
                if (warps.length == 0) {
                    out.error(addLogo(Tr(pl, "warp.go.gui.list.empty")));
                    return;
                }
                let TMETCfg = fs.get("TMET");
                let MoneyName = TMETCfg.get("Money")["MoneyName"];
                let Consume = TMETCfg.get("WARP")["ConsumeMoney"];
                let HasMoney = Modules.getApi("getMoney")(pl.realName);
                pl.sendSimpleForm("§l§dWARPGo", AutoReplace(Tr(pl, "warp.go.gui.content"),
                    Consume, MoneyName, HasMoney, MoneyName
                ), warps, new Array(warps.length).fill(""), (pl, id) => {
                    if (id == null) {
                        ST(pl, addLogo(Tr(pl, "form.give.up")));
                        return;
                    }
                    let selWarpName = warps[id];
                    pl.runcmd(`/warp go "${selWarpName}"`);
                });
            }

            /**
             * @param {Player} pl
             */
            function WARPAddGui(pl) {
                let nf = mc.newCustomForm();
                nf.setTitle("§l§dWARPAdd");
                nf.addInput(Tr(pl, "warp.add.gui.input.title"), "(String)");
                pl.sendForm(nf, (pl, args) => {
                    if (args == null) {
                        ST(pl, addLogo(Tr(pl, "form.give.up")));
                        return;
                    }
                    let warpName = args[0];
                    pl.runcmd(`/warp add "${warpName}"`);
                });
            }

            /**
             * @param {Player} pl 
             * @param {CommandOutput} out
             */
            function WARPDelGui(pl, out) {
                let warps = fs.get("WARP").getKeys();
                if (warps.length == 0) {
                    out.error(addLogo(Tr(pl, "warp.del.gui.list.empty")));
                    return;
                }
                pl.sendSimpleForm("§l§dWARPDel", Tr(pl, "warp.del.gui.content"), warps, new Array(warps.length).fill(""), (pl, id) => {
                    if (id == null) {
                        ST(pl, addLogo(Tr(pl, "form.give.up")));
                        return;
                    }
                    let selWarpName = warps[id];
                    pl.runcmd(`/warp del "${selWarpName}"`);
                });
            }

            Modules._RegExportApi("getWARPData", (warpName) => { return fs.get("WARP").get(warpName); });
            Modules._RegExportApi("setWARPData", (warpName, obj) => {
                let vec4 = Vector4.PosToVec4(obj, `API set WARP Name: "${warpName}"`).toDecimalPlaces(2);
                return fs.get("WARP").set(warpName, vec4.toObject());
            });

            WARPLoad();
        })();
        return true;
    }
    LoadHome() {
        (() => {
            let Event_HomeAddExample = TMListen.RegEvent("onHomeAdd", "TMET");
            let Event_HomeGoExample = TMListen.RegEvent("onHomeGo", "TMET");
            let Event_HomeDelExample = TMListen.RegEvent("onHomeDel", "TMET");

            function HomeLoad() {
                fs.set("Home", new JsonConfigFileClass(AutoReplace(TMET_DataDir, "homelist.json"), "{}"));
                RegHomeCmd();
            }

            function RegHomeCmd() {
                TMCmd.register("home", Tr(null, "home.cmd.description"), PermType.Any, 0x80, (nc) => {//home
                    nc.setEnum("Home_OPEnum1", ["add", "go", "del"]);
                    nc.setEnum("Home_OPEnum2", ["gui", "ls"]);
                    nc.mandatory("Home_OP1", ParamType.Enum, "Home_OPEnum1", "Home_OP1", 1);
                    nc.mandatory("Home_OP2", ParamType.Enum, "Home_OPEnum2", "Home_OP2", 1);
                    nc.optional("homeName", ParamType.String);
                    nc.overload([]);
                    nc.overload(["Home_OP1", "homeName"]);
                    nc.overload(["Home_OP2"]);
                    nc.setCallback((_cmd, ori, out, res) => {
                        try {
                            let pl = ori.player;
                            let oriLevel = getOriginLevel(ori);
                            let hasColor = (oriLevel == "console" ? false : true);
                            if (pl == null) {
                                out.error(addLogo(Tr(pl, "command.not.allow.not.player"), hasColor));
                                return;
                            } else if (isSimulatedPlayer(pl)) {
                                out.error(addLogo(Tr(pl, "command.not.allow.simulation.player"), hasColor));
                                return;
                            }
                            let type = (res.Home_OP1 || res.Home_OP2 || "gui");
                            let homeName = res.homeName;
                            switch (type) {
                                case "gui": {
                                    HomeMainGui(pl);
                                    break;
                                }
                                case "add": {
                                    HomeAdd(pl, out, homeName);
                                    break;
                                }
                                case "go": {
                                    HomeGo(pl, out, homeName);
                                    break;
                                }
                                case "del": {
                                    HomeDel(pl, out, homeName);
                                    break;
                                }
                                case "ls": {
                                    HomeLS(pl, out);
                                    break;
                                }
                            }
                        } catch (e) {
                            ErrorMsg(e);
                            out.error(addLogo("错误: Command running error, please contact administrator!", false));//不需要翻译
                        }
                    });
                    nc.setup();
                });

                TMCmd.register("homeas", Tr(null, "homeas.cmd.description"), PermType.GameMasters, 0x80, (nc) => {//homeas
                    nc.setEnum("Homeas_OPEnum1", ["add", "go", "del"]);
                    nc.setEnum("Homeas_OPEnum2", ["gui", "ls"]);
                    nc.setEnum("Homeas_OPEnum3", ["gui"]);
                    nc.optional("Homeas_OP1", ParamType.Enum, "Homeas_OPEnum1", "Homeas_OP1", 1);
                    nc.optional("Homeas_OP2", ParamType.Enum, "Homeas_OPEnum2", "Homeas_OP2", 1);
                    nc.optional("Homeas_OP3", ParamType.Enum, "Homeas_OPEnum3", "Homeas_OP3", 1);
                    nc.optional("homeName", ParamType.String);
                    nc.optional("playerName", ParamType.String);
                    nc.optional("target", ParamType.Player);
                    nc.overload([]);
                    nc.overload(["Homeas_OP3"]);
                    nc.overload(["target", "Homeas_OP1", "homeName"]);
                    nc.overload(["target", "Homeas_OP2", "homeName"]);
                    nc.overload(["playerName", "Homeas_OP1", "homeName"]);
                    nc.overload(["playerName", "Homeas_OP2"]);
                    nc.setCallback((_cmd, ori, out, res) => {
                        try {
                            let pl = ori.player;
                            let oriLevel = getOriginLevel(ori);
                            let hasColor = (oriLevel == "console" ? false : true);
                            if (oriLevel == "other" || oriLevel == "notop") {
                                out.error(addLogo(Tr(pl, "command.not.allow.perm"), hasColor));
                                return;
                            }
                            if (pl == null && ori.entity != null) {
                                out.error(addLogo(Tr(pl, "command.not.allow.entity"), hasColor));
                                return;
                            }
                            if (res.target != null && res.playerName == null) {
                                if (res.target.length != 1) {
                                    out.error(addLogo(Tr(pl, "command.target.only.one.player"), hasColor));
                                    return;
                                }
                            } else { res.target = null; }
                            let selPlayerName = (res.target != null ? res.target[0].realName : res.playerName);
                            let type = (res.Homeas_OP1 || res.Homeas_OP2 || "gui");
                            let homeName = (res.homeName);
                            if (selPlayerName == null) {
                                if (pl == null) {
                                    out.error(addLogo(Tr(pl, "command.not.allow.console.gui1"), hasColor));
                                    return;
                                }
                                HomeAsMainGui(pl);
                            } else {
                                if ((pl == null && homeName == null && !(type == "ls" || type == "del")) || (type == "gui" && pl == null)) {
                                    out.error(addLogo(Tr(pl, "command.not.allow.console.gui1"), hasColor));
                                    return;
                                }
                                if (pl == null && homeName == null && type == "del") {
                                    out.error(addLogo(Tr(pl, "command.not.allow.console.gui1"), hasColor));
                                    return;
                                }
                                switch (type) {
                                    case "gui": {
                                        HomeMainGui(pl, selPlayerName);
                                        break;
                                    }
                                    case "add": {
                                        HomeAdd(pl, out, homeName, selPlayerName);
                                        break;
                                    }
                                    case "go": {
                                        HomeGo(pl, out, homeName, selPlayerName);
                                        break;
                                    }
                                    case "del": {
                                        HomeDel(pl, out, homeName, selPlayerName);
                                        break;
                                    }
                                    case "ls": {
                                        HomeLS(pl, out, selPlayerName);
                                        break;
                                    }
                                }
                            }
                        } catch (e) {
                            ErrorMsg(e);
                            out.error(addLogo("错误: Command running error, please contact administrator!", false));//不需要翻译
                        }
                    });
                    nc.setup();
                });
            }

            /**
             * @param {Player} pl 
             */
            function HomeAsMainGui(pl) {
                let playersName = fs.get("Home").getKeys();
                let sdf = new SelectFormData("§l§dHomeAs", Tr(pl, "homeas.main.gui.content"), playersName, fs.get("TMET").get("SelectForm")["Subsection"], (pl, ids) => {
                    if (ids == null) {
                        ST(pl, addLogo(Tr(pl, "form.give.up")));
                        return;
                    }
                    if (ids.length != 1) {
                        ST(pl, addLogo(Tr(pl, "homeas.main.gui.res.fail.only.select.one.player")));
                        return;
                    }
                    let playerName = playersName[ids[0]];
                    pl.runcmd(`/homeas "${playerName}"`);
                });
                sendSelectForm(pl, sdf);
            }

            /**
             * @param {Player} pl 
             * @param {?string} asPlayerName 
             */
            function HomeMainGui(pl, asPlayerName) {
                let buttons = [
                    Tr(pl, "home.main.gui.button.add"),
                    Tr(pl, "home.main.gui.button.go"),
                    Tr(pl, "home.main.gui.button.del")
                ];
                let title = (asPlayerName == null ? "§l§dHomeGui" : "§l§dHomeAsGui");
                let isAs = (asPlayerName != null);
                let tipMsg = Tr(pl, "home.main.gui.content");
                if (isAs) {
                    tipMsg += AutoReplace(Tr(pl, "home.as.main.gui.add.content"), asPlayerName);
                }
                pl.sendSimpleForm(title, tipMsg, buttons, new Array(buttons.length).fill(""), (pl, id) => {
                    if (id == null) {
                        ST(pl, addLogo(Tr(pl, "form.give.up")));
                        return;
                    }
                    switch (id) {
                        case 0: {//add
                            pl.runcmd(AutoReplace("/{1} {2}",
                                (isAs ? "homeas" : "home"),
                                (isAs ? `"${asPlayerName}" add` : "add")
                            ));
                            break;
                        }
                        case 1: {//go
                            pl.runcmd(AutoReplace("/{1} {2}",
                                (isAs ? "homeas" : "home"),
                                (isAs ? `"${asPlayerName}" go` : "go")
                            ));
                            break;
                        }
                        case 2: {//del
                            pl.runcmd(AutoReplace("/{1} {2}",
                                (isAs ? "homeas" : "home"),
                                (isAs ? `"${asPlayerName}" del` : "del")
                            ));
                            break;
                        }
                    }
                });
            }


            /**
             * @param {Player} pl
             * @param {CommandOutput} out
             * @param {?string} homeName
             * @param {?string} asPlayerName
             */
            function HomeAdd(pl, out, homeName, asPlayerName) {
                let isAs = (asPlayerName != null);
                let HomeData = fs.get("Home");
                /**
                 * @type {Object<string,{"x":number,"y":number,"z":number,"dimid":number}>}
                 */
                let homeList = HomeData.get((isAs ? asPlayerName : pl.realName), {});
                let TMETCfg = fs.get("TMET");
                let HomeCfg = TMETCfg.get("Home");
                let MaxHomeLimit = +HomeCfg["MaxHome"];
                if (Object.keys(homeList).length >= MaxHomeLimit) {
                    out.error(addLogo(AutoReplace(Tr(pl, "home.add.fail.max.limit"), MaxHomeLimit)));
                    return;
                }
                let needMoney = +HomeCfg["SaveRequiredMoney"];

                let getMoney = Modules.getApi("getMoney");
                /**
                 * @type {(realName:string,val:number,type:?("join"|"init"|"set"),isTarn:?boolean,note:?string)=>(boolean|null)}
                 */
                let setMoney = Modules.getApi("setMoney");

                if (homeName == null) {//Gui
                    let nf = mc.newCustomForm();
                    nf.setTitle((isAs ? "§l§dHomeAsAdd" : "§l§dHomeAdd"));
                    let tipMsg = Tr(pl, "home.add.form.input.title");
                    if (!isAs) {
                        let MoneyName = TMETCfg.get("Money")["MoneyName"];
                        tipMsg += AutoReplace(Tr(pl, "home.add.form.input.title1"),
                            needMoney, MoneyName, getMoney(pl.realName), MoneyName
                        );
                    } else {
                        tipMsg += AutoReplace(Tr(pl, "home.as.add.form.input.title"), asPlayerName);
                    }
                    nf.addInput(tipMsg, "(String)");
                    pl.sendForm(nf, (pl, args) => {
                        if (args == null) {
                            ST(pl, addLogo(Tr(pl, "form.give.up")));
                            return;
                        }
                        pl.runcmd(AutoReplace("/{1} {2} \"{3}\"",
                            (isAs ? "homeas" : "home"),
                            (isAs ? `"${asPlayerName}" add` : "add"),
                            args[0]
                        ));
                    });
                } else {
                    if (homeList[homeName] != null) {
                        out.error(addLogo(Tr(pl, "home.add.fail.name.is.exists")));
                        return;
                    }
                    let vec4 = Vector4.PosToVec4(pl.pos, `"${pl.realName}" add ${(asPlayerName || "Self")} Home: "${homeName}"`);
                    vec4.y -= 1.6;
                    if (!Event_HomeAddExample(pl.xuid, homeName, isAs, (asPlayerName || pl.realName))) {
                        return;
                    }
                    if (!isAs) {
                        let HasMoney = getMoney(pl.realName);
                        if (needMoney > HasMoney) {
                            out.error(addLogo(Tr(pl, "home.add.fail.money")));
                            return;
                        } else {
                            setMoney(pl.realName, (HasMoney - needMoney), "set", false, "HomeAddConsume");
                        }
                    }
                    homeList[homeName] = vec4.toDecimalPlaces(2).toObject();
                    HomeData.set((isAs ? asPlayerName : pl.realName), homeList);
                    out.success(addLogo(AutoReplace(Tr(pl, "home.add.success"), homeName)));
                    WriteUseLog(`Home${isAs ? "As" : ""}-Add`, pl, (isAs ? `(as ${asPlayerName}) ` : "") + homeName);
                }
            }

            /**
             * @param {Player} pl
             * @param {CommandOutput} out
             * @param {?string} homeName
             * @param {?string} asPlayerName
             */
            function HomeGo(pl, out, homeName, asPlayerName) {
                let isAs = (asPlayerName != null);
                let TMETCfg = fs.get("TMET");
                let HomeData = fs.get("Home");
                /**
                 * @type {Object<string,{"x":number,"y":number,"z":number,"dimid":number}>}
                 */
                let homeList = HomeData.get((isAs ? asPlayerName : pl.realName), {});
                if (Object.keys(homeList).length == 0) {
                    out.error(addLogo(Tr(pl, "home.go.list.empty")));
                    return;
                }
                let HomeCfg = TMETCfg.get("Home");
                let needMoney = +HomeCfg["GoHomeRequiredMoney"];

                let getMoney = Modules.getApi("getMoney");
                /**
                 * @type {(realName:string,val:number,type:?("join"|"init"|"set"),isTarn:?boolean,note:?string)=>(boolean|null)}
                 */
                let setMoney = Modules.getApi("setMoney");
                if (homeName == null) {
                    let nf = mc.newSimpleForm();
                    nf.setTitle((isAs ? "§l§dHomeAsGo" : "§l§dHomeGo"));
                    let tipMsg = Tr(pl, "home.go.form.content");
                    if (!isAs) {
                        let MoneyName = TMETCfg.get("Money")["MoneyName"];
                        tipMsg += AutoReplace(Tr(pl, "home.go.form.content1"),
                            needMoney, MoneyName, getMoney(pl.realName), MoneyName
                        );
                    } else {
                        tipMsg += AutoReplace(Tr(pl, "home.as.go.form.content"), asPlayerName);
                    }
                    nf.setContent(tipMsg);
                    let homeArr = [];
                    homeList.forEach((_obj, name) => {
                        nf.addButton(name);
                        homeArr.push(name);
                    });
                    pl.sendForm(nf, (pl, id) => {
                        if (id == null) {
                            ST(pl, addLogo(Tr(pl, "form.give.up")));
                            return;
                        }
                        let homeName = homeArr[id];
                        pl.runcmd(AutoReplace("/{1} {2} \"{3}\"",
                            (isAs ? "homeas" : "home"),
                            (isAs ? `"${asPlayerName}" go` : "go"),
                            homeName
                        ));
                    });
                } else {
                    if (homeList[homeName] == null) {
                        out.error(addLogo(Tr(pl, "home.go.fail.notfound")));
                        return;
                    }
                    if (!Event_HomeGoExample(pl.xuid, homeName, isAs, (asPlayerName || pl.realName))) {
                        return;
                    }
                    if (!isAs) {
                        let HasMoney = getMoney(pl.realName);
                        if (needMoney > HasMoney) {
                            out.error(addLogo(Tr(pl, "home.go.fail.money")));
                            return;
                        } else {
                            setMoney(pl.realName, (HasMoney - needMoney), "set", false, "HomeGoConsume");
                        }
                    }
                    let homeVec4 = Vector4.PosToVec4(homeList[homeName], `"${pl.realName}" go ${(asPlayerName || "Self")} Home: "${homeName}"`);
                    pl.teleport(homeVec4.toPos());
                    out.success(addLogo(AutoReplace(Tr(pl, "home.go.success"), homeName), (pl != null)));
                    WriteUseLog(`Home${isAs ? "As" : ""}-Go`, pl, (isAs ? `(as ${asPlayerName}) ` : "") + homeName);
                }
            }

            /**
             * @param {?Player} pl
             * @param {CommandOutput} out
             * @param {?string} homeName
             * @param {?string} asPlayerName
             */
            function HomeDel(pl, out, homeName, asPlayerName) {
                let isAs = (asPlayerName != null);
                let TMETCfg = fs.get("TMET");
                let HomeData = fs.get("Home");
                /**
                 * @type {Object<string,{"x":number,"y":number,"z":number,"dimid":number}>}
                 */
                let homeList = HomeData.get((isAs ? asPlayerName : pl.realName), {});
                if (Object.keys(homeList).length == 0) {
                    out.error(addLogo(Tr(pl, "home.del.list.empty")));
                    return;
                }
                let HomeCfg = TMETCfg.get("Home");
                let backMoney = +HomeCfg["DelHomeBackOffMoney"];

                let getMoney = Modules.getApi("getMoney");
                /**
                 * @type {(realName:string,val:number,type:?("join"|"init"|"set"),isTarn:?boolean,note:?string)=>(boolean|null)}
                 */
                let setMoney = Modules.getApi("setMoney");
                if (homeName == null) {
                    let nf = mc.newSimpleForm();
                    nf.setTitle((isAs ? "§l§dHomeAsDel" : "§l§dHomeDel"));
                    let tipMsg = Tr(pl, "home.del.form.content");
                    if (!isAs) {
                        let MoneyName = TMETCfg.get("Money")["MoneyName"];
                        tipMsg += AutoReplace(Tr(pl, "home.del.form.content1"),
                            backMoney, MoneyName, getMoney(pl.realName), MoneyName
                        );
                    } else {
                        tipMsg += AutoReplace(Tr(pl, "home.as.del.form.content"), asPlayerName);
                    }
                    nf.setContent(tipMsg);
                    let homeArr = [];
                    homeList.forEach((_obj, name) => {
                        nf.addButton(name);
                        homeArr.push(name);
                    });
                    pl.sendForm(nf, (pl, id) => {
                        if (id == null) {
                            ST(pl, addLogo(Tr(pl, "form.give.up")));
                            return;
                        }
                        let homeName = homeArr[id];
                        pl.runcmd(AutoReplace("/{1} {2} \"{3}\"",
                            (isAs ? "homeas" : "home"),
                            (isAs ? `"${asPlayerName}" del` : "del"),
                            homeName
                        ));
                    });
                } else {
                    if (homeList[homeName] == null) {
                        out.error(addLogo(Tr(pl, "home.del.fail.notfound")));
                        return;
                    }
                    if (!Event_HomeDelExample((pl != null ? pl.xuid : ""), homeName, isAs, (asPlayerName || pl.realName))) {
                        return;
                    }
                    if (!isAs) {
                        let HasMoney = getMoney(pl.realName);
                        setMoney(pl.realName, (HasMoney + backMoney), "set", false, "HomeDelBackOff");
                    }
                    delete homeList[homeName];
                    HomeData.set((isAs ? asPlayerName : pl.realName), homeList);
                    out.success(addLogo(AutoReplace(Tr(pl, "home.del.success"), homeName), (pl != null)));
                    WriteUseLog(`Home${isAs ? "As" : ""}-Del`, pl, (isAs ? `(as ${asPlayerName}) ` : "") + homeName);
                }
            }

            /**
             * @param {Player} pl
             * @param {CommandOutput} out
             * @param {?string} asPlayerName
             */
            function HomeLS(pl, out, asPlayerName) {
                let isAs = (asPlayerName != null);
                let HomeData = fs.get("Home");
                /**
                 * @type {Object<string,{"x":number,"y":number,"z":number,"dimid":number}>}
                 */
                let homeList = HomeData.get((isAs ? asPlayerName : pl.realName), {});
                let homeArr = Object.keys(homeList);
                if (homeArr.length == 0) {
                    out.success(addLogo(Tr(pl, "home.ls.list.empty")));
                    return;
                }
                out.success(addLogo(AutoReplace(Tr(pl, "home.ls.success"), homeArr.join("§r,")), (pl != null)));
                WriteUseLog(`Home${isAs ? "As" : ""}-List`, pl, (isAs ? `(as ${asPlayerName}) ` : ""));
            }

            Modules._RegExportApi("getHomeData", (playerName, homeName) => {
                return fs.get("Home").get(playerName, {})[homeName];
            });
            Modules._RegExportApi("setHomeData", (playerName, homeName, obj) => {
                let vec4 = Vector4.PosToVec4(obj, `API add ${playerName} Home: "${homeName}"`).toDecimalPlaces(2);
                let homeData = fs.get("Home");
                let playerData = homeData.get(playerName, {});
                playerData[homeName] = vec4.toObject();
                return homeData.set(playerName, playerData);
            });

            HomeLoad();
        })();
        return true;
    }
    LoadBack() {
        (() => {
            let Event_BackToDeathPosExample = TMListen.RegEvent("onBackToDeath", "TMET");
            let Event_BackPlayerDie = TMListen.RegEvent("onBackPlayerDie", "TMET");

            function BackLoad() {
                GlobalCache.DeathTempInfo = {};
                GlobalCache.RespawnInfo = {};
                GlobalCache.InvincibleList = {};
                if (fs.get("TMET").get("Back")["SaveToFile"]) {
                    fs.set("Back", new JsonConfigFileClass(AutoReplace(TMET_DataDir, "deathlist.json"), "{}"));
                    GlobalCache.DeathTempInfo = JSON.parse(fs.get("Back").read());
                }
                RegBackCmd();
                TMListen.listen("onPlayerDie", Back_onPlayerDie);
                TMListen.listen("onMobHurt", Back_onMobHurt);
                TMListen.listen("onRespawn", Back_onRespawn);
            }

            function RegBackCmd() {
                TMCmd.register("back", AutoReplace(Tr(null, "back.cmd.description"), fs.get("TMET").get("Back")["ConsumeMoney"]), PermType.Any, 0x80, (nc) => {
                    nc.overload([]);
                    nc.setCallback((_cmd, ori, out, _res) => {
                        try {
                            let pl = ori.player;
                            let oriLevel = getOriginLevel(ori);
                            let hasColor = (oriLevel == "console" ? false : true);
                            if (pl == null) {
                                out.error(addLogo(Tr(pl, "command.not.allow.not.player"), hasColor));
                                return;
                            } else if (isSimulatedPlayer(pl)) {
                                out.error(addLogo(Tr(pl, "command.not.allow.simulation.player"), hasColor));
                                return;
                            }
                            let lastDeathInfo = (GlobalCache.DeathTempInfo[pl.realName] || [])[0];
                            if (lastDeathInfo == null) {
                                out.error(addLogo(Tr(pl, "back.not.death.info"), hasColor));
                                return;
                            }
                            let time = lastDeathInfo.time;
                            let vec4 = Vector4.PosToVec4(lastDeathInfo, `"${pl.realName}" Back: "${time}"`);
                            let BackCfg = fs.get("TMET").get("Back");
                            let iTime = +BackCfg["InvincibleTime"];
                            /**
                             * @type {(realName:string,val:number,type:?("join"|"init"|"set"),isTarn:?boolean,note:?string)=>(boolean|null)}
                             */
                            let setMoney = Modules.getApi("setMoney");
                            let Consume = BackCfg["ConsumeMoney"],
                                HasMoney = Modules.getApi("getMoney")(pl.realName);
                            if (Consume > HasMoney) {
                                out.error(addLogo(Tr(pl, "back.fail.money"), hasColor));
                                return;
                            }

                            if (!Event_BackToDeathPosExample(pl.xuid, time, vec4.toObject())) {
                                return;
                            }

                            if (setMoney(pl.realName, (HasMoney - Consume), "set", false, "BackConsume")) {
                                let name = pl.realName;
                                setTimeout(() => {
                                    delete GlobalCache.InvincibleList[name];
                                }, (iTime * 1000));
                                pl.teleport(vec4.toPos());
                                GlobalCache.InvincibleList[pl.realName] = true;
                                out.success(addLogo(AutoReplace(Tr(pl, "back.success"), time)));
                                WriteUseLog("Back-Go", pl, time);
                            } else {
                                out.error(addLogo(Tr(pl, "back.fail.error")));
                            }
                        } catch (e) {
                            ErrorMsg(e);
                            out.error(addLogo("错误: Command running error, please contact administrator!", false));//不需要翻译
                        }
                    });
                    nc.setup();
                });

                TMCmd.register("death", Tr(null, "death.cmd.description"), PermType.Any, 0x80, (nc) => {
                    nc.overload([]);
                    nc.setCallback((_cmd, ori, out, _res) => {
                        let pl = ori.player;
                        let oriLevel = getOriginLevel(ori);
                        let hasColor = (oriLevel == "console" ? false : true);
                        if (pl == null) {
                            out.error(addLogo(Tr(pl, "command.not.allow.not.player"), hasColor));
                            return;
                        } else if (isSimulatedPlayer(pl)) {
                            out.error(addLogo(Tr(pl, "command.not.allow.simulation.player"), hasColor));
                            return;
                        }
                        if (GlobalCache.DeathTempInfo[pl.realName] == null) {
                            out.error(addLogo(Tr(pl, "death.not.death.info")));
                            return;
                        }
                        let BackCfg = fs.get("TMET").get("Back");
                        let MaxLimit = BackCfg["MaxSave"];
                        let nf = mc.newCustomForm();
                        nf.setTitle("§l§dDeathList");
                        let arr = [], lineTmp = Tr(pl, "death.form.line");
                        GlobalCache.DeathTempInfo[pl.realName].forEach((obj, i) => {
                            let vec4 = Vector4.PosToVec4(obj, `"${pl.realName}" DeathList: "${obj.time}"`);
                            arr.push(AutoReplace(lineTmp, (i + 1), MaxLimit, `(${vec4.x}, ${vec4.y}, ${vec4.z}, ${vec4.dim})`, obj.time));
                        });
                        nf.addLabel(arr.join("§r\n"));
                        pl.sendForm(nf, (_p, _a) => { });
                        WriteUseLog("Back-Check", pl, "");
                    });
                    nc.setup();
                });
            }

            /**
             * @param {Player} pl 
             * @param {?Entity} _source 
             */
            function Back_onPlayerDie(pl, _source) {
                if (isSimulatedPlayer(pl)) { return true; }
                let name = pl.realName, dimName = pl.pos.dim;
                let dieVec4Obj = Vector4.PosToVec4(pl.pos, `"${pl.realName}" Die`).toDecimalPlaces(2).toObject();

                if (!Event_BackPlayerDie(pl.xuid, dieVec4Obj)) {
                    return;
                }

                dieVec4Obj.time = system.getTimeStr();
                if (GlobalCache.DeathTempInfo[name] == null) {
                    GlobalCache.DeathTempInfo[name] = [];
                }
                GlobalCache.DeathTempInfo[name].unshift(dieVec4Obj);
                let BackCfg = fs.get("TMET").get("Back");
                let MaxLimit = BackCfg["MaxSave"];
                while (GlobalCache.DeathTempInfo[name].length > MaxLimit) {
                    GlobalCache.DeathTempInfo[name].pop();
                }
                if (BackCfg["SaveToFile"]) {
                    fs.get("Back").set(name, GlobalCache.DeathTempInfo[name]);
                }
                logger.debug(name, ",Death: ", GlobalCache.DeathTempInfo[name][0]);
                GlobalCache.RespawnInfo[name] = AutoReplace(Tr(pl, "back.die.tip"),
                    dieVec4Obj.x, dieVec4Obj.y, dieVec4Obj.z, dimName, dieVec4Obj.time);
                WriteUseLog("Back-Die", pl, "");
                return true;
            }

            /**
             * @param {Entity} mob 
             * @param {?Entity} _source 
             * @param {number} _damage 
             * @param {number} _cause 
             */
            function Back_onMobHurt(mob, _source, _damage, _cause) {
                let pl = mob.toPlayer();
                if (pl != null) {
                    if (GlobalCache.InvincibleList[pl.realName]) {
                        return false;
                    }
                }
                return true;
            }

            /**
             * @param {Player} pl 
             */
            function Back_onRespawn(pl) {
                let TipMsg = GlobalCache.RespawnInfo[pl.realName];
                if (TipMsg != null) {
                    ST(pl, addLogo(TipMsg));
                    delete GlobalCache.RespawnInfo[pl.realName];
                }
                return true;
            }

            Modules._RegExportApi("getDeathData", (playerName) => {
                return GlobalCache.DeathTempInfo[playerName];
            });
            Modules._RegExportApi("setDeathData", (playerName, info) => {
                if (typeOfEx(info) != "Array") { return false; }
                GlobalCache.DeathTempInfo[playerName] = info;
                let BackCfg = fs.get("TMET").get("Back");
                let MaxLimit = BackCfg["MaxSave"];
                while (GlobalCache.DeathTempInfo[playerName].length > MaxLimit) {
                    GlobalCache.DeathTempInfo[playerName].pop();
                }
                if (BackCfg["SaveToFile"]) {
                    fs.get("Back").set(playerName, GlobalCache.DeathTempInfo[playerName]);
                }
                return true;
            });

            BackLoad();
        })();
        return true;
    }
    LoadNotice() {
        (() => {
            function NoticeLoad() {
                fs.set("NoticeData", new JsonConfigFileClass(AutoReplace(TMET_DataDir, "noticedata.json")));
                RegNoticeCmd();
                TMListen.listen("onJoin", (pl) => {
                    if (fs.get("TMET").get("Notice")["JoinOpenNotice"]) {
                        Notice_onJoin(pl);
                    }
                });
            }

            function RegNoticeCmd() {
                TMCmd.register("notice", Tr(null, "notice.cmd.description"), PermType.Any, 0x80, (nc) => {
                    nc.setEnum("Notice_OPEnum1", ["autodisplay", "gui"]);
                    nc.mandatory("Notice_OP1", ParamType.Enum, "Notice_OPEnum1", "Notice_OP1", 1);
                    nc.overload([]);
                    nc.overload(["Notice_OP1"]);
                    nc.setCallback((_cmd, ori, out, res) => {
                        try {
                            let pl = ori.player;
                            let oriLevel = getOriginLevel(ori);
                            let hasColor = (oriLevel == "console" ? false : true);
                            let type = (res.Notice_OP1 || "gui")
                            if (pl == null) {
                                out.error(addLogo(Tr(pl, "command.not.allow.not.player"), hasColor));
                                return;
                            } else if (isSimulatedPlayer(pl)) {
                                out.error(addLogo(Tr(pl, "command.not.allow.simulation.player"), hasColor));
                                return;
                            }
                            switch (type) {
                                case "gui": {
                                    sendNotice(pl);
                                    break;
                                }
                                case "autodisplay": {
                                    let NoticeData = fs.get("NoticeData");
                                    let lastData = Boolean(NoticeData.get(pl.xuid, false));
                                    NoticeData.set(pl.xuid, !lastData);
                                    if (!lastData) {
                                        out.success(addLogo(Tr(pl, "notice.auto.display.false")));
                                    } else {
                                        out.success(addLogo(Tr(pl, "notice.auto.display.true")));
                                    }
                                    break;
                                }
                            }
                        } catch (e) {
                            ErrorMsg(e);
                            out.error(addLogo("错误: Command running error, please contact administrator!", false));//不需要翻译
                        }
                    });
                    nc.setup();
                });

                TMCmd.register("notice_op", Tr(null, "notice_op.cmd.description"), PermType.GameMasters, 0x80, (nc) => {
                    nc.overload([]);
                    nc.setCallback((_cmd, ori, out, _res) => {
                        try {
                            let pl = ori.player;
                            let oriLevel = getOriginLevel(ori);
                            let hasColor = (oriLevel == "console" ? false : true);
                            if (pl == null) {
                                out.error(addLogo(Tr(pl, "command.not.allow.not.player"), hasColor));
                                return;
                            } else if (isSimulatedPlayer(pl)) {
                                out.error(addLogo(Tr(pl, "command.not.allow.simulation.player"), hasColor));
                                return;
                            }
                            openNoticeModifyGui(pl);
                        } catch (e) {
                            ErrorMsg(e);
                            out.error(addLogo("错误: Command running error, please contact administrator!", false));//不需要翻译
                        }
                    });
                    nc.setup();
                });
            }

            /**
             * @param {Player} pl 
             */
            function openNoticeModifyGui(pl) {
                let TMETCfg = fs.get("TMET");
                let NoticeCfg = TMETCfg.get("Notice");
                let sendIsContinue = (pl, content) => {
                    let buttons = [
                        Tr(pl, "notice_op.is.continue.form.button.continue"),
                        Tr(pl, "notice_op.is.continue.form.button.cancel")
                    ];
                    pl.sendSimpleForm("§l§dNoticeSetting", AutoReplace(Tr(pl, "notice_op.is.continue.form.content"), content), buttons, new Array(buttons.length).fill(""), (pl, id) => {
                        if (id == null) {
                            ST(pl, addLogo(Tr(pl, "form.give.up")));
                            return;
                        }
                        if (id == 0) {
                            sendMainModify(pl);
                        } else {
                            TMETCfg.set("Notice", NoticeCfg);
                            fs.get("NoticeData").write("{}");
                            ST(pl, addLogo(Tr(pl, "notice_op.is.continue.form.res.cancel.tip")));
                        }
                    });
                };
                let modifyTitle = (pl) => {
                    let nf = mc.newCustomForm();
                    nf.setTitle("§l§dSetTitle");
                    nf.addInput(Tr(pl, "notice_op.modify.title.form.input.title"), "(String)", NoticeCfg["NoticeTitle"]);
                    pl.sendForm(nf, (pl, args) => {
                        if (args == null) {
                            ST(pl, addLogo(Tr(pl, "form.give.up")));
                            return;
                        }
                        NoticeCfg["NoticeTitle"] = args[0];
                        sendIsContinue(pl, Tr(pl, "notice_op.modify.title.success"));
                        WriteUseLog("Notice-SetTitle", pl, args[0]);
                    });
                };
                let delLine = (pl) => {
                    let lines = String(NoticeCfg["NoticeText"]).split("#&#");
                    let nf = mc.newCustomForm();
                    nf.setTitle("§l§dDelContent");
                    nf.addLabel(Tr(pl, "notice_op.del.line.form.label"));
                    lines.forEach((str) => {
                        nf.addSwitch(str);
                    });
                    pl.sendForm(nf, (pl, args) => {
                        if (args == null) {
                            ST(pl, addLogo(Tr(pl, "form.give.up")));
                            return;
                        }
                        args.shift();
                        args.forEach((bool, i) => {
                            if (bool) {
                                SafeDeleteArray(lines, i);
                                TickTask.addTask(() => {
                                    sendIsContinue(pl);
                                });
                                WriteUseLog("Notice-DelLine", pl2, lines[i]);
                            }
                        });
                    });
                };
                let modifyContent = (pl) => {
                    let lines = String(NoticeCfg["NoticeText"]).split("#&#");
                    let nf = mc.newCustomForm();
                    nf.setTitle("§l§dSetContent");
                    nf.addLabel(Tr(pl, "notice_op.modify.content.form.label"));
                    nf.addSwitch(Tr(pl, "notice_op.modify.content.form.add.line.switch.title"), false);
                    nf.addSwitch(Tr(pl, "notice_op.modify.content.form.del.line.switch.title"), false);
                    lines.forEach((str, i) => {
                        nf.addInput(`Line: ${(i + 1)}`, "(String)", str);
                    });
                    pl.sendForm(nf, (pl, args) => {
                        if (args == null) {
                            ST(pl, addLogo(Tr(pl, "form.give.up")));
                            return;
                        }
                        args.shift();
                        if (args.shift()) {
                            NoticeCfg["NoticeText"] += "#&#";
                            modifyContent(pl);
                            return;
                        }
                        if (args.shift()) {
                            delLine(pl);
                            return;
                        }
                        let NewText = args.join("#&#");
                        WriteUseLog("Notice-SetContent", pl, NewText);
                        NoticeCfg["NoticeText"] = NewText;
                        sendIsContinue(pl, Tr(pl, "notice_op.modify.content.success"));
                    });
                };
                let sendMainModify = (pl) => {
                    let buttons = [
                        Tr(pl, "notice_op.main.gui.button.set.title"),
                        Tr(pl, "notice_op.main.gui.button.set.content")
                    ];
                    pl.sendSimpleForm("§l§dNoticeSetting", Tr(pl, "notice_op.main.gui.content"), buttons, new Array(buttons.length).fill(""), (pl, id) => {
                        if (id == null) {
                            ST(pl, addLogo(Tr(pl, "form.give.up")));
                            return;
                        }
                        if (id == 0) {
                            modifyTitle(pl);
                        } else {
                            modifyContent(pl);
                        }
                    });
                }
                sendMainModify(pl);
            }

            /**
             * @param {Player} pl 
             */
            function sendNotice(pl) {
                let NoticeData = fs.get("NoticeData");
                let nf = mc.newCustomForm();
                let NoticeCfg = fs.get("TMET").get("Notice");
                nf.setTitle(String(NoticeCfg["NoticeTitle"]));
                nf.addLabel(String(NoticeCfg["NoticeText"]).replace(/#&#/g, "§r\n"));
                let lastData = Boolean(NoticeData.get(pl.xuid, false));
                nf.addSwitch(Tr(pl, "notice.form.auto.display.switch.title"), lastData);
                pl.sendForm(nf, (pl, args) => {
                    if (args == null) { return; }
                    if (args[1] != lastData) {
                        pl.runcmd("/notice autodisplay");
                    }
                });
                WriteUseLog("Notice-Look", pl, "");
            }

            function Notice_onJoin(pl) {
                if (!fs.get("NoticeData").get(pl.xuid, false)) {
                    sendNotice(pl);
                }
                return true;
            }

            Modules._RegExportApi("getNoticeData", () => {
                let NoticeCfg = fs.get("TMET").get("Notice");
                return {
                    "Title": NoticeCfg["NoticeTitle"],
                    "Content": NoticeCfg["NoticeText"]
                };
            });
            Modules._RegExportApi("setNoticeData", (obj) => {
                if (typeOfEx(obj) != "Object") { return false; }
                let TMETCfg = fs.get("TMET");
                let NoticeCfg = TMETCfg.get("Notice");
                obj.forEach((val, key) => {
                    if (key == "Title" || key == "Content") {
                        if (typeOfEx(val) != "String") { return; }
                        NoticeCfg[key] = val;
                    }
                });
                fs.get("NoticeData").write("{}");
                return TMETCfg.set("Notice", NoticeCfg);
            });

            NoticeLoad();
        })();
        return true;
    }
    LoadShop() {
        (() => {
            let Event_BeforeShopBuyExample = TMListen.RegEvent("onBeforeShopBuy", "TMET");
            let Event_BeforeShopSellExample = TMListen.RegEvent("onBeforeShopSell", "TMET");
            let Event_ShopBuyExample = TMListen.RegEvent("onAfterShopBuy", "TMET");
            let Event_ShopSellExample = TMListen.RegEvent("onAfterShopSell", "TMET");

            function ShopLoad() {
                fs.set("Shop", new JsonConfigFileClass(AutoReplace(TMET_DataDir, "shopdata.json"), JSON.stringify(_Configs.SHOP, null, 2)));
                RegShopCmd();
            }

            function RegShopCmd() {
                TMCmd.register("shop", Tr(null, "shop.cmd.description"), PermType.Any, 0x80, (nc) => {
                    nc.setEnum("Shop_OPEnum1", ["gui", "buy", "sell"]);
                    nc.mandatory("Shop_OP1", ParamType.Enum, "Shop_OPEnum1", "Shop_OP1", 1);
                    nc.overload([]);
                    nc.overload(["Shop_OP1"]);
                    nc.setCallback((_cmd, ori, out, res) => {
                        try {
                            let pl = ori.player;
                            let oriLevel = getOriginLevel(ori);
                            let hasColor = (oriLevel == "console" ? false : true);
                            if (pl == null) {
                                out.error(addLogo(Tr(pl, "command.not.allow.not.player"), hasColor));
                                return;
                            } else {
                                if (isSimulatedPlayer(pl)) {
                                    out.error(addLogo(Tr(pl, "command.not.allow.simulation.player"), hasColor));
                                    return;
                                }
                            }
                            let type = (res.Shop_OP1 || "gui");
                            switch (type) {
                                case "gui": {
                                    ShopMainGui(pl);
                                    break;
                                }
                                case "buy": {
                                    ShopBuyGui(pl, new ShopDir(fs.get("Shop").get("Buy", []), "Buy"));
                                    break;
                                }
                                case "sell": {
                                    ShopSellGui(pl, new ShopDir(fs.get("Shop").get("Sell", []), "Sell"));
                                    break;
                                }
                            }
                        } catch (e) {
                            ErrorMsg(e);
                            out.error(addLogo("错误: Command running error, please contact administrator!", false));//不需要翻译
                        }
                    });
                    nc.setup();
                });
            }

            /**
             * @param {Player} pl 
             */
            function ShopMainGui(pl) {
                let buttons = [
                    Tr(pl, "shop.main.gui.button.buy"),
                    Tr(pl, "shop.main.gui.button.sell")
                ];
                pl.sendSimpleForm("§l§dShopGui", Tr(pl, "shop.main.gui.content"), buttons, new Array(buttons.length).fill(""), (pl, id) => {
                    if (id == null) {
                        ST(pl, addLogo(Tr(pl, "form.give.up")));
                        return;
                    }
                    if (id == 0) {
                        pl.runcmd(`/shop buy`);
                    } else {
                        pl.runcmd(`/shop sell`);
                    }
                });
            }

            function isRightStore(shop, name) {
                let isObject = (anyInfo) => (typeOfEx(anyInfo) == "Object");
                let isArray = (anyInfo) => (typeOfEx(anyInfo) == "Array");
                let i = 0, type = null,
                    l = shop.length;
                while (i < l) {
                    let button = shop[i];
                    if (!isObject(button)) {
                        type = 0;
                        break;
                    } else if (typeof (button.name) != "string") {
                        type = 1;
                        break;
                    } else if (button.type != "exam" && button.type != "group") {
                        type = 2;
                        break;
                    } else if (typeof (button.data) != "object") {
                        type = 3;
                        break;
                    }
                    if (typeof (button.type) == "string" && button.type == "exam") {
                        if (!isObject(button.data)) {
                            type = 4;
                            break;
                        } else {
                            if (typeof (button.data.type) != "string") {
                                type = 6;
                                break;
                            } else if (typeof (button.data.aux) != "number") {
                                type = 7;
                                break;
                            } else if (typeof (button.data.money) != "number") {
                                type = 8;
                                break;
                            }
                        }
                    } else if (typeof (button.type) == "string" && button.type == "group") {
                        if (!isArray(button.data)) {
                            type = 5;
                            break;
                        }
                    }
                    i++;
                }
                if (type != null) {
                    logger.error("Shop error in ", name);
                    logger.error(`In the ${i} of the array`);
                    switch (type) {
                        case 0:
                            logger.error("The whole is not an object");
                            break;
                        case 1:
                            logger.error("name is not a string");
                            break;
                        case 2:
                            logger.error("type is not a group or exam");
                            break;
                        case 3:
                            logger.error("data is not an object or array");
                            break;
                        case 4:
                            logger.error("exam => data is not an object");
                            break;
                        case 5:
                            logger.error("group => data is not an array");
                            break;
                        case 6:
                            logger.error("exam => data => type is not a string");
                            break;
                        case 7:
                            logger.error("exam => data => aux is not a number");
                            break;
                        case 8:
                            logger.error("exam => data => money is not a number");
                            break;
                        default:
                            logger.error("Unknown");
                            break;
                    }
                    return false;
                } else {
                    return true;
                }
            }

            class ShopDir {
                /**
                 * @type {{
                 * "name":string,
                 * "type":"exam"|"group",
                 * "image":string|undefined,
                 * "data":(this[]|{
                 * "type":string,
                 * "aux":string,
                 * "remark":string,
                 * "money":number
                 * })
                 * }[]}
                 */
                #info = [];
                /**
                 * @type {string[]}
                 */
                #indexStr = [];
                #inExam = false;
                #lastID = -1;
                /**
                 * @param {{
                 * "name":string,
                 * "type":"exam"|"group",
                 * "image":string|undefined,
                 * "data":(this[]|{
                 * "type":string,
                 * "aux":string,
                 * "remark":string
                 * })
                 * }[]} commInfo 
                 * @param {string} firstIndexStr 
                 */
                constructor(commInfo, firstIndexStr) {
                    this.#info.push(commInfo);
                }
                /**
                 * @param {number} index 
                 */
                next(index) {
                    if (this.#inExam) { return false; }
                    let now = this.nowData;
                    if (now.type == "group") {
                        /**
                         * @type {undefined|{
                         * "name":string,
                         * "type":"exam"|"group",
                         * "image":string|undefined,
                         * "data":(this[]|{
                         * "type":string,
                         * "aux":string,
                         * "remark":string
                         * })
                         * }}
                         */
                        let res = now.data[index];
                        if (!res) { return false; }
                        this.#info.push(res);
                        now.type == "group" && this.#indexStr.push(res.name);
                        this.#inExam = res.type == "exam";
                        this.#lastID = index;
                        return true;
                    }
                    return false;
                }
                last() {
                    if (this.isFirst) { return false; }
                    this.#info.pop();
                    !this.#inExam && this.#indexStr.pop();
                    this.#inExam = false;
                    return true;
                }
                get lastData() {
                    if (this.#info.length < 2) { return undefined; }
                    return this.#info[(this.#info.length - 2)];
                }
                get nowData() {
                    if (this.isFirst) {
                        return {
                            "name": this.#indexStr[(this.#indexStr.length - 1)],
                            /** @type {"group"|"exam"} */
                            "type": "group",
                            "image": "",
                            /** 
                             * @type {any[] | {
                             * type: string,
                             * aux: string,
                             * remark: string,
                             * money: number
                             * }} 
                             */
                            "data": this.#info[(this.#info.length - 1)]
                        };
                    }
                    return this.#info[(this.#info.length - 1)];
                }
                get isFirst() {
                    return this.#info.length == 1;
                }
                get indexStr() {
                    return this.#indexStr.join("=>");
                }
                get inExam() { return this.#inExam; }
                get _lastId() { return this.#lastID; }
            }

            /**
             * @param {Player} pl
             * @param {ShopDir} shopDir
             */
            function ShopBuyGui(pl, shopDir) {
                try {
                    let now = shopDir.nowData;
                    if (!shopDir.inExam) {
                        /** @type {{"name":string,"type":"group"|"exam","image":string,"data":any[]}[]} */
                        let nowInfo = now.data;
                        if (!isRightStore(nowInfo, shopDir.indexStr)) {
                            ST(pl, addLogo(Tr(pl, "shop.config.error")));
                            return;
                        }
                        let nf = mc.newSimpleForm();
                        nf.setTitle("§l§dShopBuy");
                        nf.setContent(Tr(pl, "shop.buy.form.content"));
                        let LangTmp = Tr(pl, "shop.buy.form.buttons"),
                            ExamD = Tr(pl, "shop.display.exam"),
                            GroupD = Tr(pl, "shop.display.group"),
                            BackPageD = Tr(pl, "shop.form.back.last.page");
                        !shopDir.isFirst && nf.addButton(BackPageD, "");
                        nowInfo.forEach((v) => {
                            nf.addButton(AutoReplace(LangTmp, String(v.name), (v.type == "exam" ? ExamD : GroupD)), (v.image || ""));
                        });
                        pl.sendForm(nf, (pl, id) => {
                            if (id == null) {
                                ST(pl, addLogo(Tr(pl, "form.give.up")));
                                return;
                            } else if (!shopDir.isFirst) {
                                if (id == 0) {
                                    if (!shopDir.last()) { return; }
                                    ShopBuyGui(pl, shopDir);
                                    return;
                                }
                                id -= 1;
                            }
                            shopDir.next(id) && ShopBuyGui(pl, shopDir);
                        });
                        return;
                    }
                    /** 
                     * @type {{
                     * "type": string,
                     * "aux": string,
                     * "remark": string,
                     * "money":number
                     * }}
                     */
                    let shopData = now.data;
                    /** @type {(realName:string)=>number} */
                    let getMoney = Modules.getApi("getMoney");
                    /**
                     * @type {(realName:string,val:number,type:?("join"|"init"|"set"),isTarn:?boolean,note:?string)=>(boolean|null)}
                     */
                    let setMoney = Modules.getApi("setMoney");
                    let nf = mc.newCustomForm();
                    nf.setTitle("§l§dShopBuying");
                    nf.addLabel(AutoReplace(Tr(pl, "shop.buy.form2.content"),
                        shopData.type,
                        shopData.aux,
                        shopData.money,
                        getMoney(pl.realName),
                        shopData.remark
                    ));
                    nf.addInput(Tr(pl, "shop.buy.form2.input.title"), "(+Number)");
                    nf.addSwitch(Tr(pl, "shop.form.back.last.page"), false);
                    pl.sendForm(nf, (pl, args) => {
                        if (args == null) {
                            ST(pl, addLogo(Tr(pl, "form.give.up")));
                            return;
                        } else if (args[2]) {
                            shopDir.last() && ShopBuyGui(pl, shopDir);
                            return;
                        }
                        let num = args[1];
                        if (!(/(^[1-9]\d*$)/).test(num)) {
                            ST(pl, addLogo(Tr(pl, "shop.buy.form2.res.input.error")));
                            return;
                        } else { num = +num; }
                        let needMoney = (shopData.money * num);
                        let hasMoney = getMoney(pl.realName);
                        if (hasMoney < needMoney) {
                            ST(pl, addLogo(Tr(pl, "shop.buy.fail.money")));
                            return;
                        }
                        let indexStr = shopDir.indexStr + `[${shopDir._lastId}]=>${now.name}`;
                        logger.debug("IndexStr:", indexStr);
                        if (!Event_BeforeShopBuyExample(pl.xuid, indexStr, shopData, num)) {
                            return;
                        }
                        let cmdRes = mc.runcmdEx(`give "${pl.realName}" ${shopData.type} ${num} ${shopData.aux}`);
                        if (cmdRes.success) {
                            if (!Event_ShopBuyExample(pl.xuid, indexStr, shopData, num)) {
                                return;
                            }
                            setMoney(pl.realName, (hasMoney - needMoney), "set", false, "ShopBuy");
                            ST(pl, addLogo(Tr(pl, "shop.buy.success")));
                            WriteUseLog("Shop-Buy", pl, `${indexStr}*${num}`);
                        } else {
                            ST(pl, addLogo(AutoReplace(Tr(pl, "shop.buy.fail.rea"), (cmdRes.output || "None"))));
                        }
                    });
                } catch (e) {
                    ErrorMsg(e);
                    ST(pl, addLogo(Tr(pl, "shop.buy.error")));
                }
            }

            /**
             * @param {Player} pl 
             * @param {string} type 
             * @param {number} aux
             */
            function GetItemCount(pl, type, aux) {
                let hasNum = 0;
                let AllItems = pl.getInventory().getAllItems();
                AllItems.forEach((it) => {
                    if (it.type == type && it.aux == aux) {
                        hasNum += it.count;
                    }
                });
                return hasNum;
            }

            /**
             * @param {Player} pl 
             * @param {string} type 
             * @param {number} aux
             * @param {number} num 
             * @returns {({"success":boolean,"output":string})}
             */
            function TryClearItem(pl, type, aux, num) {
                let hasNum = GetItemCount(pl, type, aux);
                if (hasNum < num) {
                    return { "success": false, "output": Tr(pl, "shop.sell.fail.count.not.enough") };
                } else {
                    return mc.runcmdEx(`clear "${pl.realName}" ${type} ${aux} ${num}`);
                }
            }


            /**
             * @param {Player} pl 
             * @param {ShopDir} shopDir 
             */
            function ShopSellGui(pl, shopDir) {
                try {
                    let now = shopDir.nowData;
                    if (!shopDir.inExam) {
                        /** @type {{"name":string,"type":"group"|"exam","image":string,"data":any[]}[]} */
                        let nowInfo = now.data;
                        if (!isRightStore(nowInfo, shopDir.indexStr)) {
                            ST(pl, addLogo(Tr(pl, "shop.config.error")));
                            return;
                        }
                        let nf = mc.newSimpleForm();
                        nf.setTitle("§l§dShopSell");
                        nf.setContent(Tr(pl, "shop.sell.form.content"));
                        let LangTmp = Tr(pl, "shop.sell.form.buttons"),
                            ExamD = Tr(pl, "shop.display.exam"),
                            GroupD = Tr(pl, "shop.display.group"),
                            BackPageD = Tr(pl, "shop.form.back.last.page");
                        !shopDir.isFirst && nf.addButton(BackPageD, "");
                        nowInfo.forEach((v) => {
                            nf.addButton(AutoReplace(LangTmp, String(v.name), (v.type == "exam" ? ExamD : GroupD)), (v.image || ""));
                        });
                        pl.sendForm(nf, (pl, id) => {
                            if (id == null) {
                                ST(pl, addLogo(Tr(pl, "form.give.up")));
                                return;
                            } else if (!shopDir.isFirst) {
                                if (id == 0) {
                                    shopDir.last() && ShopSellGui(pl, shopDir);
                                    return;
                                }
                                id -= 1;
                            }
                            shopDir.next(id) && ShopSellGui(pl, shopDir);
                        });
                        return;
                    }
                    /**
                     * @type {{
                     * "type": string,
                     * "aux": string,
                     * "remark": string,
                     * "money":number
                     * }}
                     */
                    let shopData = now.data;
                    /** @type {(realName:string)=>number} */
                    let getMoney = Modules.getApi("getMoney");
                    /**
                     * @type {(realName:string,val:number,type:?("join"|"init"|"set"),isTarn:?boolean,note:?string)=>(boolean|null)}
                     */
                    let setMoney = Modules.getApi("setMoney");
                    let nf = mc.newCustomForm();
                    nf.setTitle("§l§dShopSelling");
                    nf.addLabel(AutoReplace(Tr(pl, "shop.sell.form2.content"),
                        shopData.type,
                        shopData.aux,
                        shopData.money,
                        getMoney(pl.realName),
                        shopData.remark,
                        GetItemCount(pl, shopData.type, shopData.aux)
                    ));
                    nf.addInput(Tr(pl, "shop.sell.form2.input.title"), "(+Number)");
                    nf.addSwitch(Tr(pl, "shop.form.back.last.page"), false);
                    pl.sendForm(nf, (pl, args) => {
                        if (args == null) {
                            ST(pl, addLogo(Tr(pl, "form.give.up")));
                            return;
                        } else if (args[2]) {
                            shopDir.last() && ShopSellGui(pl, shopDir);
                            return;
                        }
                        let num = args[1];
                        if (!(/(^[1-9]\d*$)/).test(num)) {
                            ST(pl, addLogo(Tr(pl, "shop.sell.form2.res.input.error")));
                            return;
                        } else { num = +num; }
                        let giveMoney = (shopData.money * num);
                        let hasMoney = getMoney(pl.realName);
                        let indexStr = shopDir.indexStr + `[${shopDir._lastId}]=>${now.name}`;
                        logger.debug("IndexStr:", indexStr);
                        if (!Event_BeforeShopSellExample(pl.xuid, `${indexStr}`, shopData, num)) {
                            return;
                        }
                        let cmdRes = TryClearItem(pl, shopData.type, shopData.aux, num);
                        if (cmdRes.success) {
                            if (!Event_ShopSellExample(pl.xuid, indexStr, shopData, num)) {
                                return;
                            }
                            setMoney(pl.realName, (hasMoney + giveMoney), "set", false, "ShopSell");
                            ST(pl, addLogo(Tr(pl, "shop.sell.success")));
                            WriteUseLog("Shop-Sell", pl, `${indexStr}*${num}`);
                        } else {
                            ST(pl, addLogo(AutoReplace(Tr(pl, "shop.sell.fail.rea"), (cmdRes.output || "None"))));
                        }
                    });
                } catch (e) {
                    ErrorMsg(e);
                    ST(pl, addLogo(Tr(pl, "shop.buy.error")));
                }
            }

            Modules._RegExportApi("getShopData", () => {
                return fs.get("Shop")._getCache();
            });
            Modules._RegExportApi("setShopData", (obj) => {
                if (typeOfEx(obj) != "Object") { return false; }
                let newData = { "Buy": [], "Sell": [] };
                let buy = obj.Buy;
                let sell = obj.Sell;
                if (typeOfEx(buy) != "Array" || typeOfEx(sell) != "Array") { return false; }
                /**
                 * @param {(ShopGroupInfo[]|ShopExamInfo[])} obj 
                 * @param {(ShopGroupInfo[]|ShopExamInfo[])} opObj
                 * @param {string} indexStr 
                 */
                function ForEachShopData(obj, opObj, indexStr) {
                    if (!isRightStore(obj, indexStr)) { return false; }
                    let l = obj.length, i = 0;
                    while (i < l) {
                        let _this = obj[i];
                        let _data = (_this.type == "exam" ?
                            {
                                "type": _this.data.type,
                                "aux": _this.data.aux,
                                "remark": _this.data.remark,
                                "money": _this.data.money
                            }
                            : (() => {
                                let arr = [];
                                ForEachShopData(_this.data, arr, `${indexStr}=>${_this.name}`);
                                return arr;
                            })()
                        );

                        let ob = {
                            "name": _this.name,
                            "type": _this.type,
                            "image": _this.image,
                            "data": _data
                        }
                        opObj.push(ob);
                        i++;
                    }
                    return true;
                }
                if (!ForEachShopData(buy, newData.Buy, "API-Set: Buy") || !ForEachShopData(sell, newData.Sell, "API-Set: Sell")) {
                    return false;
                }
                return fs.get("Shop").write(JSON.stringify(newData, null, 2));
            });

            ShopLoad();
        })();
        return true;
    }
    LoadDynamicMotd() {
        (() => {
            let Event_MotdChange = TMListen.RegEvent("onMotdChange", "TMET");

            function DynamicMotdLoad() {
                GlobalCache["DynamicMotdIndex"] = -1;
                setInterval(ChangeMotd, (fs.get("TMET").get("DynamicMotd")["Time"] * 1000));
            }

            function ChangeMotd() {
                let motdList = fs.get("TMET").get("DynamicMotd")["MotdList"];
                if ((motdList.length - 1) <= GlobalCache.DynamicMotdIndex) {
                    GlobalCache.DynamicMotdIndex = -1;
                }
                let nowMotd = motdList[++GlobalCache.DynamicMotdIndex];
                if (!Event_MotdChange(nowMotd)) {
                    return;
                }
                mc.setMotd(nowMotd);
                WriteUseLog("DynamicMotd-Set", null, nowMotd);
            }
            DynamicMotdLoad();
        })();
        return true;
    }
    LoadTPR() {
        (() => {
            let Event_TPRTryExample = TMListen.RegEvent("onTPRTry", "TMET");
            let Event_TPRFailExample = TMListen.RegEvent("onTPRFail", "TMET");
            let Event_TPRSuccessExample = TMListen.RegEvent("onTPRSuccess", "TMET");


            function TPRLoad() {
                RegTPRCmd();
            }

            function RegTPRCmd() {
                TMCmd.register("tpr", AutoReplace(Tr(null, "tpr.cmd.description"), fs.get("TMET").get("TPR")["ConsumeMoney"]), PermType.Any, 0x80, (nc) => {
                    nc.overload([]);
                    nc.setCallback((_cmd, ori, out, _res) => {
                        try {
                            let pl = ori.player;
                            let oriLevel = getOriginLevel(ori);
                            let hasColor = (oriLevel == "console" ? false : true);
                            if (pl == null) {
                                out.error(addLogo(Tr(pl, "command.not.allow.not.player"), hasColor));
                                return;
                            } else if (isSimulatedPlayer(pl)) {
                                out.error(addLogo(Tr(pl, "command.not.allow.simulation.player"), hasColor));
                                return;
                            }
                            ProcessTPR(pl, out);
                        } catch (e) {
                            ErrorMsg(e);
                            out.error(addLogo("错误: Command running error, please contact administrator!", false));//不需要翻译
                        }
                    });
                    nc.setup();
                });
            }

            function getRandomValue(min, max) {
                let rMax = (max - min);
                let random = Math.floor((Math.random() * rMax) + 1);
                return (random + min);
            }

            /**
             * 在Y轴寻找空气方块
             * 如果寻找到了就直接修改对象
             * @param {Vector4} vec4 
             */
            function FindAirBlock(vec4) {
                let pos = vec4.toPos();
                let bl = mc.getBlock(pos);
                while (bl != null && bl.type != "minecraft:air") {
                    if (bl.pos.y <= -1) {//超出限制
                        vec4.y = -65;
                        return;
                    }
                    pos.y -= 1;
                    bl = mc.getBlock(pos);
                }
                if (bl == null) {
                    vec4.y = -65;
                }
                vec4.y = pos.y;
            }

            /**
             * @param {Player} pl 
             * @param {CommandOutput} out
             */
            function ProcessTPR(pl, out) {
                let getMoney = Modules.getApi("getMoney");
                /**
                 * @type {(realName:string,val:number,type:?("join"|"init"|"set"),isTarn:?boolean,note:?string)=>(boolean|null)}
                 */
                let setMoney = Modules.getApi("setMoney");
                let { MaxXZCoordinate, MinXZCoordinate, ConsumeMoney } = fs.get("TMET").get("TPR");
                if (getMoney(pl.realName) < ConsumeMoney) {
                    out.error(addLogo(Tr(pl, "tpr.fail.money")));
                    return;
                }
                let realName = pl.realName, state = 0;//0~1: LoadChunk~LoadChunk(end), 2~3: FindPos~FindPos(end)
                let beforeTPRVec4 = Vector4.PosToVec4(pl.pos, `"${pl.realName}" TPR_GetBeforeVec4`);

                let randomVec4 = new Vector4(
                    getRandomValue(+MinXZCoordinate, +MaxXZCoordinate) - 0.5,
                    (beforeTPRVec4.dimid == 0 ? 319 : (beforeTPRVec4.dimid == 1 ? 666 : (beforeTPRVec4.dimid == 2 ? 200 : 0))),
                    getRandomValue(+MinXZCoordinate, +MaxXZCoordinate) - 0.5,
                    beforeTPRVec4.dimid,
                    `"${pl.realName}" TPR_Random`
                );

                if (!Event_TPRTryExample(pl.xuid, randomVec4.x, randomVec4.z)) {
                    return;
                }

                setMoney(pl.realName, (getMoney(pl.realName) - ConsumeMoney), "set", false, "TPRConsume");
                WriteUseLog("TPR-Try", pl, `x:${randomVec4.x}-z:${randomVec4.z}`);

                pl.teleport(randomVec4.toPos());

                let lastVec4 = Vector4.PosToVec4(pl.pos, `"${pl.realName}" TPR_GetTPRLastVec4`);

                let FakePl = { "realName": pl.realName, "pos": { "x": pl.pos.x, "y": pl.pos.y, "z": pl.pos.z, "dimid": pl.pos.dimid, "dim": pl.pos.dim } };
                let xuid = pl.xuid;
                let Task = () => {
                    let pl = mc.getPlayer(realName);
                    if (pl == null) {
                        Event_TPRFailExample(xuid, "LeftGame");
                        WriteUseLog("TPR-Fail", FakePl, "LeftGame");
                        return;
                    }
                    if (state == 0) {
                        ST(pl, addLogo(Tr(pl, "tpr.load.chunk.tip")));
                        state++;
                    } else if (state == 2 || state == 3) {
                        if (state == 2) {
                            ST(pl, addLogo(Tr(pl, "tpr.found.safe.pos.tip")));
                            state++;
                        }
                        let bl = mc.getBlock(randomVec4.toPos());

                        if (randomVec4.dimid == 1) {//寻找地狱基岩下面的空气方块
                            randomVec4.y = 127;
                            FindAirBlock(randomVec4);
                            bl = mc.getBlock(randomVec4.toPos());
                        }
                        if (bl == null) {//修复坐标问题
                            if (randomVec4.dimid == 0) {//修复低版本坐标问题
                                randomVec4.y = 255;
                            }//可拓展
                        }
                        while (1) {
                            if (bl == null || bl.pos.y <= -65 || ["minecraft:lava", "minecraft:flowing_lava"].indexOf(bl.type) != -1) {
                                setMoney(pl.realName, (getMoney(pl.realName) + ConsumeMoney), "set", false, "TPRFailBackOff");
                                ST(pl, addLogo(Tr(pl, "tpr.fail.notfound.safe.pos")));
                                Event_TPRFailExample(xuid, "NotFindSafePos");
                                pl.teleport(beforeTPRVec4.toPos());
                                WriteUseLog("TPR-Fail", pl, "NotFindSafePos");
                                return;
                            }
                            if (bl.type != "minecraft:air") {
                                break;
                            }
                            randomVec4.y--;
                            bl = mc.getBlock(randomVec4.toPos());
                        }
                        randomVec4.y++;
                        Event_TPRSuccessExample(xuid);
                        pl.teleport(randomVec4.toPos());
                        ST(pl, addLogo(AutoReplace(Tr(pl, "tpr.success"), randomVec4.x, randomVec4.y, randomVec4.z, randomVec4.dimid)));
                        WriteUseLog("TPR-Success", pl, "");
                        return;
                    } else {
                        if (!lastVec4.isSame(Vector4.PosToVec4(pl.pos, `"${pl.realName}" TPR_GetNowVec4`))) {
                            state++;
                        }
                    }
                    TickTask.addTask(Task);
                };
                TickTask.addTask(Task);
            }
            TPRLoad();
        })();
        return true;
    }
    LoadRefreshChunk() {
        (() => {
            let Event_RefreshChunkExample = TMListen.RegEvent("onRefreshChunk");

            function RefreshChunkLoad() {
                RegRefreshChunkCmd();
            }

            function RegRefreshChunkCmd() {
                TMCmd.register("rc", AutoReplace(Tr(null, "refresh.chunk.cmd.description"), fs.get("TMET").get("RefreshChunk")["ConsumeMoney"]), PermType.Any, 0x80, (nc) => {
                    nc.overload([]);
                    nc.setCallback((_cmd, ori, out, _res) => {
                        try {
                            let pl = ori.player;
                            let oriLevel = getOriginLevel(ori);
                            let hasColor = (oriLevel == "console" ? false : true);
                            if (pl == null) {
                                out.error(addLogo(Tr(pl, "command.not.allow.not.player"), hasColor));
                                return;
                            } else if (isSimulatedPlayer(pl)) {
                                out.error(addLogo(Tr(pl, "command.not.allow.simulation.player"), hasColor));
                                return;
                            }
                            ProcessReloadChunk(pl, out);
                        } catch (e) {
                            ErrorMsg(e);
                            out.error(addLogo("错误: Command running error, please contact administrator!", false));//不需要翻译}
                        }
                    });
                    nc.setup();
                });
            }

            /**
             * 
             * @param {Player} pl 
             * @param {CommandOutput} out 
             */
            function ProcessReloadChunk(pl, out) {
                let getMoney = Modules.getApi("getMoney");
                /**
                 * @type {(realName:string,val:number,type:?("join"|"init"|"set"),isTarn:?boolean,note:?string)=>(boolean|null)}
                 */
                let setMoney = Modules.getApi("setMoney");

                let hasMoney = getMoney(pl.realName);
                let needMoney = fs.get("TMET").get("RefreshChunk")["ConsumeMoney"];
                if (needMoney > hasMoney) {
                    out.error(addLogo(Tr(pl, "refresh.chunk.fail.money")));
                    return;
                }
                if (!Event_RefreshChunkExample(pl.xuid)) {
                    return;
                }
                setMoney(pl.realName, (hasMoney - needMoney), "set", false, "RefreshChunkConsume");
                pl.refreshChunks();
                out.success(addLogo(Tr(pl, "refresh.chunk.success")));
                WriteUseLog("RefreshChuck", pl, "");
            }
            RefreshChunkLoad();
        })();
        return true;
    }
    LoadFarmLandProtect() {
        (() => {
            function FarmLandProtectLoad() {
                TMListen.listen("onFarmLandDecay", FarmLandProtect_onFarmLandDecay);
            }

            /**
             * @param {Pos} pos 
             * @param {?Entity} en 
             */
            function FarmLandProtect_onFarmLandDecay(_pos, en) {//(0全部拦截,1只拦截null对象造成耕地破坏,2只拦截非玩家破坏,3只拦截玩家破坏
                let CfgType = +fs.get("TMET").get("FarmLandProtect")["Type"];
                let res = true;
                switch (CfgType) {
                    case 0: {
                        res = false;
                        break;
                    }
                    case 1: {
                        if (en == null) {
                            res = false;
                            break;
                        }
                    }
                    case 2: {
                        if (en != null && !en.isPlayer()) {
                            res = false;
                            break;
                        }
                    }
                    case 3: {
                        if (en != null && en.isPlayer()) {
                            res = false;
                            break;
                        }
                    }
                }
                let FakePl = {
                    "realName": (en != null ? en.name : "Null"),
                    "pos": (en != null ? en.pos : _pos)
                };
                WriteUseLog("FarmLandProtect", (FakePl), res);
                return res;
            }
            FarmLandProtectLoad();
        })();
        return true;
    }
}();

function AutoUpdate() {
    if (_Version.isBeta()) {
        logger.warn(`Beta Version Can't Be Use AutoUpdate!`);
        return;
    }
    let isWorking = false;
    let lastVer = _Version.getVersionNumber();
    let VerWebSite = "https://gitee.com/timidine/mcbe-lite-loader-script-engine-tmessential/raw/main/Version.json";
    setInterval(() => {
        if (isWorking) { return; }
        network.httpGet(VerWebSite, (code, res) => {
            if (code != 200) { return; }
            let Obj = null;
            try { Obj = JSON.parse(res); } catch (_) { }
            if (Obj == null || Obj["VersionNumber"] == lastVer) { return; }
            if (!Obj["Website"]) { return; }

            logger.info(AutoReplace(Tr(null, "auto.update.has.new.version"), Obj["VersionNumber"].toString().split("").join(".")));

            isWorking = true;

            network.httpGet(Obj["Website"], (code, res) => {
                if (code != 200) {
                    logger.warn(AutoReplace(Tr(null, "auto.update.download.fail.code"), code));
                    isWorking = false;
                    return;
                } else if (!res) {
                    logger.warn(AutoReplace(Tr(null, "auto.update.download.fail.rea")));
                    isWorking = false;
                    return;
                }
                let FileSize = +(res.length / 1024).toFixed(2);
                if (FileSize < 30) {
                    logger.warn(AutoReplace(Tr(null, "auto.update.download.fail.size")));
                    isWorking = false;
                    return;
                }
                File.writeTo(TMET_RunPath, res);
                logger.info(AutoReplace(Tr(null, "auto.update.download.success"), FileSize));
                if (!Obj["CanReload"] || lastVer != Obj["LastVersion"]) {
                    logger.info(Tr(null, "auto.update.download.success.website.restart.tip"));
                    return;
                }
                lastVer = Obj["VersionNumber"];
                if (fs.get("TMET").get("AutoUpdate")["AutoReload"]) {
                    logger.info(Tr(null, "auto.update.download.success.auto.reload.tip"));
                    setTimeout(() => {
                        GlobalCache.FileCache._SaveToFile();
                        mc.runcmdEx("ll reload TMEssential.js");
                    }, 1);
                } else {
                    logger.info(Tr(null, "auto.update.download.success.tip"));
                }
                isWorking = false;
            });
        });
    }, 1000 * 60 * 10);
}

/**
 * 写使用日志
 * @param {string} type 事件
 * @param {(Player|null)} pl 玩家或者null 
 * @param {string} msg 信息
 */
function WriteUseLog(type, pl, msg) {
    let plName = (pl != null ? pl.realName : null),
        posTmp = (plName == null ? null : Vector4.PosToVec4(pl.pos, `"${plName}" UseLog_GetPos`).toDecimalPlaces(2));
    TickTask.addTask(() => {
        let ULConf = fs.get("TMET").get("UseLog");
        if (ULConf["Enable"]) {
            let Keys = Object.keys(ULConf["Conf"]),
                ty = type.split("-")[0],
                iOF = Keys.indexOf(ty);
            if (type == "Plugin" || ULConf.Conf[Keys[iOF]]) {
                File.mkdir("./logs/TMEssential");
                let DTStr = system.getTimeStr(),
                    DateStr = DTStr.split(" ")[0],
                    FilePath = AutoReplace(TMET_LogDir, `UseLog-${DateStr}.csv`),
                    XYZ = (posTmp != null ? `[${posTmp.x}|${posTmp.y}|${posTmp.z}]` : null),
                    Data = `${DTStr},${(plName != null ? posTmp.dim : "")},${(plName != null ? plName : "Console")},${(XYZ != null ? XYZ : "")},${type},${msg}`;
                if (!File.exists(FilePath)) {
                    File.writeLine(FilePath, Tr(null, "write.use.log.title"));
                }
                File.writeLine(FilePath, Data);
            }
        }
    });
}

// function MoneyApiExport(type, a, b, c, d) {
//     let ThisRes = (() => {
//         switch (type) {
//             case "getmoney": {
//                 WriteUseLog("API-Old-GetMoney", null, a);
//                 return Modules.getApi("getMoney")(a);
//             }
//             case "setmoney": {
//                 WriteUseLog("API-Old-SetMoney", null, `${a}->${b}`);
//                 return Modules.getApi("setMoney")(a, b, "set", false, "System::Set");
//             }
//             case "tranmoney": {
//                 WriteUseLog("API-Old-TranMoney", null, `${a}->${b}(${c})[${d}]`);
//                 return Modules.getApi("tranMoney")(a, b, c, d);
//             }
//             case "moneytype": {
//                 WriteUseLog("API-Old-GetMoneyType", null, "");
//                 return fs.get("TMET").get("Money")["MoneyType"];
//             }
//             case "version": {
//                 WriteUseLog("API-Old-GetVersion", null, "");
//                 return _Version.getVersionNumber();
//             }
//             case "moneyname": {
//                 WriteUseLog("API-Old-GetMoneyName", null, "");
//                 return fs.get("TMET").get("Money")["MoneyName"];
//             }
//             case "getpaytax": {
//                 WriteUseLog("API-Old-GetPayTax", null, "");
//                 return Modules.getApi("getPayTax")();
//             }
//         }
//         return null;
//     })();
//     return ThisRes;
// }

function ExportAPI() {
    //#region OldApiExport
    // if (fs.get("TMET").get("ExportOldAPI")) {
    //     let ExportFunc = (type, a, b, c, d) => {
    //         try {
    //             let moneyRes = MoneyApiExport(type, a, b, c, d);
    //             if (moneyRes != null) {
    //                 return moneyRes;
    //             }
    //             switch (a) {
    //                 case "LANGUAGE": a = "LangSetting"; break;
    //                 case "llmoneyconf": a = "llmoneyConf"; break;
    //                 case "moneydata": a = "MoneyData"; break;
    //                 case "tpaset": a = "TPASet"; break;
    //                 case "HOME": a = "Home"; break;
    //                 case "WARP": break;
    //                 case "BACK": a = "Back"; break;
    //                 case "SHOP": a = "Shop"; break;
    //             }
    //             let ThisRes = (() => {
    //                 switch (type) {
    //                     case "getdata": {
    //                         let fsTmp = fs.get(a);
    //                         if (fsTmp == null) { return null; }
    //                         WriteUseLog("API-Old-GetData", null, a);
    //                         return fsTmp.read();
    //                     }
    //                     case "setdata": {
    //                         let fsTmp = fs.get(a);
    //                         if (fsTmp == null) { return false; }
    //                         WriteUseLog("API-Old-SetData", null, a);
    //                         return fsTmp.write(b);
    //                     }
    //                     case "reloaddata": {
    //                         let fsTmp = fs.get(a);
    //                         if (fsTmp == null) { return false; }
    //                         WriteUseLog("API-Old-ReloadData", null, a);
    //                         return fsTmp.reload();
    //                     }
    //                     case "getkeys": {
    //                         let arr = [];
    //                         fs.forEach((_v, name) => { arr.push(name); });
    //                         WriteUseLog("API-Old-GetKeys", null, a);
    //                         return arr;
    //                     }
    //                     case "getlangdata": {
    //                         let fsTmp = LangFs.get(a);
    //                         if (fsTmp == null) { return false; }
    //                         WriteUseLog("API-Old-GetLangData", null, a);
    //                         return fsTmp.read();
    //                     }
    //                     case "setlangdata": {
    //                         let fsTmp = LangFs.get(a);
    //                         if (fsTmp == null) { return false; }
    //                         WriteUseLog("API-Old-GetLangData", null, a);
    //                         return fsTmp.write(b);
    //                     }
    //                     case "reloadlangdata": {
    //                         let fsTmp = LangFs.get(a);
    //                         if (fsTmp == null) { return false; }
    //                         WriteUseLog("API-Old-ReloadLangData", null, a);
    //                         return fsTmp.reload();
    //                     }
    //                     case "getlangkeys": {
    //                         let arr = [];
    //                         LangFs.forEach((_v, name) => { arr.push(name); });
    //                         WriteUseLog("API-Old-GetLangKeys", null, a);
    //                         return arr;
    //                     }
    //                 }
    //             })();
    //             return (typeof (ThisRes) != "string" ? JSON.stringify(ThisRes) : ThisRes);
    //         } catch (e) {
    //             ErrorMsg(e);
    //         }
    //     };
    //     if (ll.export(ExportFunc, "LLSEGlobal", "TMET")) {
    //         logger.info("OldAPI TMET API Export Successful");
    //     } else {
    //         logger.fatal("OldAPI TMET API Export Fatal!!!");
    //     }
    // }
    //#endregion

    let ListenRemoteCall = (name, ns, nm) => {
        logger.debug(`远程虚拟监听: ${name} 创建...`);
        let id = TMListen.listen(name, (...args) => {
            if (ll.hasExported(ns, nm)) {
                return Boolean(ll.import(ns, nm)(...args));
            } else {
                logger.debug(`远程调用: ${ns}::${nm} 函数没有导出!自动删除远程虚拟监听!`);
                TMListen.unListen(id, "TMET");
                let index = rcd[name].indexOf(`${ns}::${nm}`);
                rcd[name].splice(index, 1);
            }
            return true;
        }, "TMET");
    }

    Modules._Exports.forEach((func, key) => {
        if (ll.export((...args) => {
            try {
                return func(...args);
            } catch (e) {
                e.message = `${`Error in Export API: ${key}`}\n${e.message}`;
                ErrorMsg(e);
            }
        }, "TMETApi", key)) {
            logger.debug(`RemoteCall API: TMETApi::${key} export success!`);
        } else {
            logger.error(`RemoteCall API: TMETApi::${key} export fail!`);
        }
    });

    let oldData = GlobalCache.FileCache.get("RemoteCall");
    GlobalCache.FileCache.set("RemoteCall", {});
    let rcd = GlobalCache.FileCache.get("RemoteCall");

    if (oldData != null) {
        oldData.forEach((NsAndNmList, key) => {
            NsAndNmList.forEach((NsAndNm) => {
                let [ns, nm] = NsAndNm.split("::");
                if (ll.hasExported(ns, nm)) {
                    if (rcd[key] == null) { rcd[key] = []; }
                    if (rcd[key].indexOf(`${ns}::${nm}`) != -1) {
                        return false;
                    }
                    rcd[key].push(`${ns}::${nm}`);
                    ListenRemoteCall(key, ns, nm);
                } else {
                    logger.debug(`远程调用: ${ns}::${nm} 函数没有导出!自动删除远程虚拟监听!`);
                }
            });
        });
    }

    TMListen._TMETEvents.forEach((_map, name) => {
        if (ll.export((a, b) => {
            try {
                if (rcd[name] == null) { rcd[name] = []; }
                if (rcd[name].indexOf(`${a}::${b}`) != -1) {
                    return false;
                }
                rcd[name].push(`${a}::${b}`);
                ListenRemoteCall(name, a, b);
                return true;
            } catch (e) {
                e.message = `${`Error in Export ListenEvent: ${name}`}\n${e.message}`;
                ErrorMsg(e);
            }
        }, "TMETListen", name)) {
            logger.debug(`RemoteCall: TMETListen::${name} export!`);
        } else {
            logger.error(AutoReplace("Export RemoteCall Function: {1} Fail!", `TMETListen::${name}`));
        }
    });
}

function AutoUpdateConfig() {
    try {
        let NewCfg = _Configs.TMET;
        let NewCfgKeys = Object.keys(NewCfg);
        let OldCfg = JSON.parse(fs.get("TMET").read());

        NewCfgKeys.forEach((key) => {
            let Upper = key.toUpperCase();
            if (OldCfg[key] == null && OldCfg[Upper] != null) {
                logger.info(`Update config name: ${Upper}->${key}`);
                OldCfg[key] = OldCfg[Upper];
                delete OldCfg[Upper];
            }
            if (OldCfg[key] == null) {
                logger.info("Update config: ", key);
                return;
            }
            if (typeOfEx(NewCfg[key]) != "Object") {
                NewCfg[key] = OldCfg[key];
            } else {
                let Cfg2Keys = Object.keys(NewCfg[key]);
                Cfg2Keys.forEach((key2) => {
                    if (OldCfg[key][key2] == null) {
                        logger.info("Update config: ", key, ".", key2);
                    } else {
                        if (key == "UseLog" && key2 == "Conf") {
                            let Obj0 = NewCfg[key][key2], keys1 = Object.keys(Obj0);
                            let Obj1 = OldCfg[key][key2];
                            keys1.forEach((key2) => {
                                let Upper = key2.toUpperCase();
                                if (Obj1[key2] == null && Obj1[Upper] != null) {
                                    logger.info(`Update config name: UseLog.Conf.${Upper}->${key2}`);
                                    Obj1[key2] = Obj1[Upper];
                                    delete Obj1[Upper];
                                }
                                if (Obj1[key2] != null) {
                                    Obj0[key2] = Obj1[key2];
                                } else {
                                    logger.info(`Update config name: UseLog.Conf.${key2}`);
                                }
                            });
                        } else {
                            NewCfg[key][key2] = OldCfg[key][key2];
                        }
                    }
                });
            }
        });
        if (OldCfg.Debug) {
            NewCfg["Debug"] = true;
        }
        logger.info("Save new operation...");
        fs.get("TMET").write(JSON.stringify(NewCfg, null, 2));
        return true;
    } catch (e) {
        ErrorMsg(e);
        return false;
    }
}

function SafeCheck() {
    try {
        let pluginInfo = ll.getPluginInfo("TMEssential.js");
        TMET_RunPath = pluginInfo.filePath.replace(/\\/g, "/");
        if ((() => {
            let err = new Error("TestErrorMessage"), stack = err.stack;
            if (stack.indexOf(err.name) == 0 && stack.indexOf(err.message) != -1) { return true; }
            return false;
        })()) {
            if (File.checkIsDir(TMET_RunPath)) {
                TMET_RunPath += "/TMEssential.js";
            }
            IsQuickJs = false;
        }
        logger.debug(`Run Path: ${TMET_RunPath}`);
        logger.debug(`Is QuickJs Environment: ${IsQuickJs}`);
        if (!File.exists(TMET_RunPath)) {
            throw new Error("TMEssential.js File is not exists!");
        }
        return true;
    } catch (e) {
        logger.error(`安全检查失败!原因: ${e.message}`);
        return false;
    }
}

function LL3SafeCheck() {
    try {
        if ((() => {
            let err = new Error("TestErrorMessage"), stack = err.stack;
            if (stack.indexOf(err.name) == 0 && stack.indexOf(err.message) != -1) { return true; }
            return false;
        })()) {
            if (File.checkIsDir(TMET_RunPath)) {
                TMET_RunPath += "/TMEssential.js";
            }
            IsQuickJs = false;
        }
        logger.debug(`Run Path: ${TMET_RunPath}`);
        logger.debug(`Is QuickJs Environment: ${IsQuickJs}`);
        if (!File.exists(TMET_RunPath)) {
            throw new Error("TMEssential.js File is not exists!");
        }
        LLMoney_ConfigPath = "./plugins/LegacyMoney/money.json"
        return true;
    } catch (e) {
        logger.error(`[LL3ForceLoad] 安全检查失败!原因: ${e.message || e}`);
        return false;
    }
}

function NetWorkNotice() {
    network.httpGet("https://gitee.com/timidine/mcbe-lite-loader-script-engine-tmessential/raw/main/Notice.json", (code, res) => {
        if (code != 200) {
            logger.warn("Failed to obtain network notice!");
            return;
        }
        try {
            let arr = JSON.parse(res);
            arr.forEach((str) => {
                logger.info(`[NetWork] ${str}`);
            });
        } catch (_) {
            logger.warn(`Failed to parse network notice!`);
        }
    });
}

function ProcessCacheData() {//重载读取数据成功(可能以后会用到)

}

function RegTMETCmd() {
    TMCmd.register("tmet", Tr(null, "tmet.cmd.description"), PermType.Console, 0x80, (nc) => {
        nc.setEnum("OPEnum1", ["reloaddata", "lslangpack"]);
        nc.setEnum("OPEnum2", ["unloadlangpack", "reloadlangpack"]);
        nc.setEnum("OPEnum3", ["loadlangpack"]);
        LangEnumMgr.addTask((LangNames) => {
            nc.setSoftEnum("LangPackEnum", LangNames);
        });
        nc.mandatory("OP1", ParamType.Enum, "OPEnum1", "OP1", 1);
        nc.mandatory("OP2", ParamType.Enum, "OPEnum2", "OP2", 1);
        nc.mandatory("OP3", ParamType.Enum, "OPEnum3", "OP3", 1);
        nc.mandatory("Input", ParamType.String);
        nc.mandatory("LangPackName", ParamType.SoftEnum, "LangPackEnum", "LangPackName", 1);
        nc.overload(["OP1"]);
        nc.overload(["OP2", "LangPackName"]);
        nc.overload(["OP3", "Input"]);
        nc.setCallback((_cmd, _ori, out, res) => {
            let pl = _ori.player;
            let type = (res.OP1 || res.OP2 || res.OP3);
            switch (type) {
                case "reloaddata": {
                    fs.forEach((jc, name) => {
                        jc.reload();
                        logger.debug(`Reload File: <${name}>`);
                    });
                    FilesChecker();
                    out.success(addLogo(Tr(null, "tmet.reloaddata.success"), false));
                    break;
                }
                case "loadlangpack": {
                    let LangName = res.Input;
                    if (LangName.toLowerCase() == "zh_cn.json") {
                        out.error(addLogo(Tr(pl, "tmet.not.allow.default.lang.pack"), false));
                        return;
                    }
                    if (Modules.getApi("loadLangPack")(LangName) == -1) {
                        out.error(addLogo(AutoReplace(Tr(pl, "tmet.load.lang.pack.fail"), LangName), false));
                        return;
                    }
                    out.success(addLogo(AutoReplace(Tr(pl, "tmet.load.lang.pack.success"), LangName), false));
                    break;
                }
                case "unloadlangpack": {
                    let LangName = res.LangPackName + ".json";
                    if (LangName.toLowerCase() == "zh_cn.json") {
                        out.error(addLogo(Tr(pl, "tmet.not.allow.default.lang.pack"), false));
                        return;
                    }
                    if (!Modules.getApi("unloadLangPack")(LangName)) {
                        out.error(addLogo(AutoReplace(Tr(pl, "tmet.unload.lang.pack.fail"), LangName), false));
                        return;
                    }
                    out.success(addLogo(AutoReplace(Tr(pl, "tmet.unload.lang.pack.success"), LangName), false));
                    break;
                }
                case "reloadlangpack": {
                    let LangName = res.LangPackName + ".json";
                    if (LangName.toLowerCase() == "zh_cn.json") {
                        out.error(addLogo(Tr(pl, "tmet.not.allow.default.lang.pack"), false));
                        return;
                    }
                    if (!Modules.getApi("unloadLangPack")(LangName) || Modules.getApi("loadLangPack")(LangName) == -1) {
                        out.error(addLogo(AutoReplace(Tr(pl, "tmet.reload.lang.pack.fail"), LangName), false));
                        return;
                    }
                    out.success(addLogo(AutoReplace(Tr(pl, "tmet.reload.lang.pack.success"), LangName), false));
                    break;
                }
                case "lslangpack": {
                    out.success(addLogo(AutoReplace(Tr(pl, "tmet.ls.lang.pack"), LangEnumMgr._LangPacks.join("§r,")), false));
                    break;
                }
            }
        });
        nc.setup();
    });
}

function FilesChecker() {
    fs.forEach((v) => {
        v.getKeys();
    });
}

/** 注册LLMoney玩家经济变动 */
function Money_RegMoneyChangeListen() {
    let LLMoneyChangedExample = TMListen.RegEvent("onLLMoneyMoneyChanged", "mc");
    mc.listen("onMoneyAdd", (xuid, _moneyVal) => {
        if (!GlobalCache.PlayerState.has(xuid)) { return true; }
        let nowMoney = money.get(xuid);
        LLMoneyChangedExample(xuid, nowMoney);
        return true;
    });
    mc.listen("onMoneyReduce", (xuid, _moneyVal) => {
        if (!GlobalCache.PlayerState.has(xuid)) { return true; }
        let nowMoney = money.get(xuid);
        LLMoneyChangedExample(xuid, nowMoney);
        return true;
    });
    mc.listen("onMoneySet", (xuid, _moneyVal) => {
        if (!GlobalCache.PlayerState.has(xuid)) { return true; }
        let nowMoney = money.get(xuid);
        LLMoneyChangedExample(xuid, nowMoney);
        return true;
    });
    mc.listen("onMoneyTrans", (fromXuid, toXuid, _moneyVal, _note) => {
        if (GlobalCache.PlayerState.has(fromXuid)) {
            let nowMoney = money.get(fromXuid);
            LLMoneyChangedExample(fromXuid, nowMoney);
        }
        if (GlobalCache.PlayerState.has(toXuid)) {
            let nowMoney = money.get(toXuid);
            LLMoneyChangedExample(toXuid, nowMoney);
        }
        return true;
    });
}

function TryLoadLL3ForceLoadConfig() {
    let text = File.readFrom("./plugins/Timiya/config/TMET_LL3ForceLoadConfig.json");
    if (text != null) {
        try {
            logger.info("Try to load TMEssential LL3 Config...");
            let content = JSON.parse(text);
            TMET_RunPath = content["TMETRunPath"];
            GlobalCache.LL3ForceLoad = true;
        } catch (e) {
            logger.warn("TMET LL3 force load config Can't to read!!!");
            logger.warn("Message: ", e.message || e);
            return false;
        }
        return true;
    }
    return false;
}

function main() {
    try {
        logger.setLogLevel(4);
        if (GlobalCache.DebugMode) {
            logger.setLogLevel(5);
            logger.debug(`Debug::Dev Mode is on`);
        }
        logger.info("Loading...");

        //RegPlugin Info
        (() => {
            try {
                let major = _Version._ver[0],
                    minor = _Version._ver[1], revision = _Version._ver[2],
                    other = {
                        "完整版本": _Version.getVersionString(),
                        "作者": "提米吖",
                        "开源地址": "https://gitee.com/timidine/mcbe-lite-loader-script-engine-tmessential/tree/main"
                    };
                ll.registerPlugin("TMEssential.js", "新时代多功能基础插件",
                    { "major": major, "minor": minor, "revision": revision }, other);
            } catch (e) {
                logger.warn(`RegisterPlugin Info Fail!`);
            }
        })();
        logger.setTitle('TMEssential');

        TryLoadLL3ForceLoadConfig();

        let LoaderVersion = ll.version();

        let VerInfoString = AutoReplace("LiteLoader/LeviLamina-ScriptEngine{1}.{2}.{3}{4}",
            LoaderVersion.major,
            LoaderVersion.minor,
            LoaderVersion.revision,
            (LoaderVersion.isBeta ? "Beta" : "")
        );

        logger.info(getColor(1, 33),
            String.raw`
     ________  _________                     __  _       __
    /_  __/  |/  / ____/____________  ____  / /_(_)___ _/ /
     / / / /|_/ / __/ / ___/ ___/ _ \/ __ \/ __/ / __ '/ / 
    / / / /  / / /___(__  |__  )  __/ / / / /_/ / /_/ / /  
   /_/ /_/  /_/_____/____/____/\___/_/ /_/\__/_/\__,_/_/   
`, `
  ${getColor(4, 33, 45)}===TMEssential is distributed under the GPLv3 License===${getColor(0)}${getColor(1)}`, `
    ${getColor(4, 36, 45)}=====Running in ${VerInfoString}=====${getColor(0)}${getColor(1)}`);

        if (GlobalCache.LL3ForceLoad ? !LL3SafeCheck() : !SafeCheck()) {
            if (File.exists("./LeviLamina.dll")) {
                logger.warn("检测到您可能处于LL3Beta版本运行!请查阅以下网站进行了解:");
                logger.warn("https://gitee.com/timidine/mcbe-lite-loader-script-engine-tmessential/blob/main/%E5%A6%82%E4%BD%95%E8%AE%A9%E6%8F%92%E4%BB%B6%E5%BC%BA%E5%88%B6%E8%BF%90%E8%A1%8C%E5%9C%A8LL3Beta%E7%89%88.md")
                logger.warn("https://985.so/wf6z9");
            }
            return;
        }

        logger.info(`TMEssential is running in ${(IsQuickJs ? "QuickJs" : "NodeJs")} environment`);

        File.mkdir(AutoReplace(TMET_CfgDir, ""));
        File.mkdir(AutoReplace(TMET_DataDir, ""));
        fs.set("TMET", new JsonConfigFileClass(AutoReplace(TMET_CfgDir, "TMEssential.json"), JSON.stringify(_Configs.TMET, null, 2)));
        if (AutoUpdateConfig()) {
            let TMETCfg = fs.get("TMET");
            if (TMETCfg.get("Enable")) {
                if (TMETCfg.get("Debug")) {
                    logger.setFile(TMET_DebugLogPath);
                    logger.setLogLevel(5);
                    logger.debug("Debug::Log Mode is on");
                }
                Modules.LoadI18N();
                if (TMETCfg.get("Money")["Enable"]) {
                    logger.debug("Loading Money module...");
                    Modules.LoadMoney();
                    // if (TMETCfg.get("ExportOldAPI")) {
                    //     if (ll.export(MoneyApiExport, "LLSEGlobal", "MONEY")) {
                    //         logger.info("OldAPI MONEY Export successful");
                    //     } else {
                    //         logger.fatal("OldAPI MONEY Export FAIL");
                    //     }
                    // }
                } else {//防止无法找到api
                    Modules._RegExportApi("getMoney", () => { return 0; });
                    Modules._RegExportApi("setMoney", () => { return true; });
                    Modules._RegExportApi("tranMoney", () => { return false; });
                    Modules._RegExportApi("getPayTax", () => { return 0.0; });
                }
                if (TMETCfg.get("TPA")["Enable"]) {
                    logger.debug("Loading TPA module...");
                    Modules.LoadTPA();
                }
                if (TMETCfg.get("WARP")["Enable"]) {
                    logger.debug("Loading WARP module...");
                    Modules.LoadWARP();
                }
                if (TMETCfg.get("Home")["Enable"]) {
                    logger.debug("Loading Home module...");
                    Modules.LoadHome();
                }
                if (TMETCfg.get("Back")["Enable"]) {
                    logger.debug("Loading Back module...");
                    Modules.LoadBack();
                }
                if (TMETCfg.get("Notice")["Enable"]) {
                    logger.debug("Loading Notice module...");
                    Modules.LoadNotice();
                }
                if (TMETCfg.get("Shop")["Enable"]) {
                    logger.debug("Loading Shop module...");
                    Modules.LoadShop();
                }
                if (TMETCfg.get("DynamicMotd")["Enable"]) {
                    logger.debug("Loading DynamicMode module...");
                    Modules.LoadDynamicMotd();
                }
                if (TMETCfg.get("TPR")["Enable"]) {
                    logger.debug("Loading TPR module...");
                    Modules.LoadTPR();
                }
                if (TMETCfg.get("RefreshChunk")["Enable"]) {
                    logger.debug("Loading RefreshChuck module...");
                    Modules.LoadRefreshChunk();
                }
                if (TMETCfg.get("FarmLandProtect")["Enable"]) {
                    logger.debug("Loading FarmLandProtect module...");
                    Modules.LoadFarmLandProtect();
                }
            }

            logger.debug("Listen Basic Event...");

            TMListen.listen("onTick", () => {
                TickTask._RunTask();
            });
            TMListen.listen("onPreJoin", (pl) => {
                if (isSimulatedPlayer(pl)) { return true; }
                GlobalCache.PlayerState.set(pl.xuid, false);
            });
            TMListen.listen("onJoin", (pl) => {
                if (isSimulatedPlayer(pl)) { return true; }
                let xuid = pl.xuid;//防动态
                TickTask.addTask(() => {
                    GlobalCache.PlayerState.set(xuid, true);
                });
            });
            TMListen.listen("onLeft", (pl) => {
                if (isSimulatedPlayer(pl)) { return true; }
                let xuid = pl.xuid;
                TickTask.addTask(() => {
                    GlobalCache.PlayerState.delete(xuid);
                });
            });
            TMListen.listen("onConsoleOutput", (out) => {
                if (GlobalCache.RunCmdNoOutput.IsExecuting) {
                    GlobalCache.RunCmdNoOutput.Output.push(out);
                    return false;
                }
                return true;
            });
            TMListen.listen("onServerStarted", () => {
                ServerIsStarted = true;
            });

            if (GlobalCache.DebugMode) {
                mc.regConsoleCmd("writefile", "write to file", () => {
                    GlobalCache.FileCache._SaveToFile();
                });
            }

            RegTMETCmd();

            logger.debug("监听创建...");
            mc.listen("onPreJoin", TMListen.RegEvent("onPreJoin"));
            mc.listen("onJoin", TMListen.RegEvent("onJoin"));
            mc.listen("onLeft", TMListen.RegEvent("onLeft"));
            mc.listen("onScoreChanged", TMListen.RegEvent("onScoreChanged"));
            mc.listen("onPlayerCmd", TMListen.RegEvent("onPlayerCmd"));
            mc.listen("onPlayerDie", TMListen.RegEvent("onPlayerDie"));
            mc.listen("onRespawn", TMListen.RegEvent("onRespawn"));
            mc.listen("onMobHurt", TMListen.RegEvent("onMobHurt"));
            mc.listen("onFarmLandDecay", TMListen.RegEvent("onFarmLandDecay"));
            mc.listen("onConsoleOutput", TMListen.RegEvent("onConsoleOutput"));
            mc.listen("onServerStarted", TMListen.RegEvent("onServerStarted"));
            if (TMETCfg.get("Money")["MoneyType"] == "llmoney") {
                Money_RegMoneyChangeListen();
            }
            (() => {
                let tickExample = TMListen.RegEvent("onTick");
                mc.listen("onTick", () => { tickExample(); return true; });
            })();//安全考虑，不允许拦截Tick
            if (_Version.isBeta()) {
                logger.warn("Warning! This version is a test version. It is prohibited to use in production environment!");
                logger.warn("Warning! This version is a test version. It is prohibited to use in production environment!");
                logger.warn("Warning! This version is a test version. It is prohibited to use in production environment!");
            }
            if (TMETCfg.get("AutoUpdate")["Enable"]) {
                AutoUpdate();
                logger.info("AutoUpdate Turned on");
            } else {
                logger.info("AutoUpdate Closed");
            }
            if (GlobalCache.FileCache._TryReadFile()) {
                ProcessCacheData();
            }
            ExportAPI();
            FilesChecker();//文件检测
            logger.info("TMEssential loaded! author by Timiya version: " + _Version.getVersionString() + "");
            WriteUseLog("Plugin", null, `Initd-Version:${_Version.getVersionString()}`);
            NetWorkNotice();
        }
    } catch (e) {
        logger.error("TMET loading failed!!!");
        ErrorMsg(e);
    }
}

try {
    if (ll.listPlugins().indexOf("TMEssential.js") != -1) {
        let i = 0;
        while (1) {
            if (i == 10) { break; }
            logger.error("Another TMET is already running! Please check the plugin list!");
            i++;
        }
        throw new Error("NotBug: STOP");
    }
    main();
} catch (e) { ErrorMsg(e); }