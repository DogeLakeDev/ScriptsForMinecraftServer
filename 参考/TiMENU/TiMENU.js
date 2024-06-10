//   ____________    __      _______________    ________     _________     __     __
//  /\____   ____\  /\__\    /\  _____  ____ \  /\  _____\   /\  _____ \   /\ \    /\ \
//  \/___/\  \___/  \/__/_   \ \ \___/\ \___/\ \  \ \ \____/_  \ \ \  \ \ \  \ \ \   \ \ \
//      \ \  \        /\ \  \ \ \  \ \ \  \ \ \ .\ \  _____\  \ \ \  \ \ \  \ \ \   \ \ \
//       \ \  \       \ \ \  \ \ \  \ \ \  \ \ \ .\ \ \____/_  \ \ \  \ \ \  \ \ \____\_\ \
//        \ \__\       \ \_\  \ \_\  \ \_\  \ \_\  \ \ ______\  \ \_\  \ \ \  \ \__________\
//         \/__/        \/_/   \/_/   \/_/   \/_/   \/_______/   \/_/   \/_/   \/__________/
// [Version]: 1.1.2 重制版
// [Author]: Cdm  QQ:1759370644
const version = [1, 1, 2];
// 默认使用语言文件 Use language file
var language = "zh_cn";
// 使用快速编辑扩展包 (非常推荐打开此功能)
var expansionPack = true;



/* ================== */
/* 以下代码请勿随意修改! */
/* ================== */


// 准备工作
let PAPI = null
try {
    PAPI = require('./lib/BEPlaceholderAPI-JS').PAPI;
} catch (error) {}
var config = new IniConfigFile('.\\plugins\\TiMENU\\config.ini');
language = config.init("plugin", "language", language);
var serverList = [
    data.fromBase64("aHR0cCUzQS8vODEuNzEuMzguMjMxL2Rvd25sb2FkL1RpTUVOVS8="),
    data.fromBase64("aHR0cDovLzExNS4yMzguMTk2LjQyOjE0NTE0L2Rvd25sb2FkL1RpTUVOVS8=")
];
var serverUrl = serverList[0];
// 双服务器策略
network.httpGet(serverUrl, function(status, result) {
    if (status != 200) {
        // 1号服务器寄了
        serverUrl = serverList[1];
        logger.warn(lang.server_die_to);
    }
});


var versionNum = version[0] * 100 + version[1] * 10 + version[2]; // 主插件版本号

var lang = {};
// 读取语言文件
let lang_file = File.readFrom('.\\plugins\\TiMENU\\language\\' + language + '.json');
if (lang_file == null) {
    /* 文件内容为null */
    logger.error('语言文件 ' + language + '.json 不存在!');
    downLang(); // 下载最新语言文件
} else {
    lang = JSON.parse(lang_file);
    var langVersionNum = lang.version[0] * 100 + lang.version[1] * 10 + lang.version[2]; // 语言文件版本号
    if (langVersionNum < versionNum) {
        /* 语言文件版本过低 */
        logger.warn(asVar(lang.language_old, [langVersionNum + "", versionNum + ""]));

        // 语言文件更新
        downLang(); // 下载最新语言文件
    }
}

onEnable(); // 插件启动!

/* 为玩家展示指定文件内的表单
 * @param player player
 * @param string name main main:1 {}/[]
 */
function showForm(player, name) {
    // var name = "abc";
    // var name = "abc:12";
    // var name = "abc {\"name\": \"abc\"}";
    // var name = "abc:13 {\"name\": \"abc\"}";
    // var name = "abc [\"name\", \"abc\"]";
    // var name = "abc:13 [\"name\", \"abc\"]";

    let mReg = /(.*):(\d+)$/;
    let mResult = mReg.exec(name);
    if (mResult == null) {
        /* abc */
        /* abc {\"name\": \"abc\"} */
        /* abc:13 {\"name\": \"abc\"} */
        /* abc [\"name\", \"abc\"] */
        /* abc:13 [\"name\", \"abc\"] */
        mReg = /(.*) ({.*})$/;
        mResult = mReg.exec(name);
        if (mResult == null) {
            /* abc */
            /* abc [\"name\", \"abc\"] */
            /* abc:13 [\"name\", \"abc\"] */
            mReg = /(.*) (\[.*\])$/;
            mResult = mReg.exec(name);
            if (mResult == null) {
                /* abc */
                // abc => name

                showFormID(player, name, 0, null);
                // console.log("1");
                // console.log(name);
            } else {
                /* abc [\"name\", \"abc\"] */
                /* abc:13 [\"name\", \"abc\"] */
                mReg = /(.*):(\d+) (\[.*\])$/;
                mResult = mReg.exec(name);
                if (mResult == null) {
                    /* abc [\"name\", \"abc\"] */
                    mReg = /(.*) (\[.*\])$/;
                    mResult = mReg.exec(name);
                    // abc => mResult[1]
                    // arr => mResult[2]

                    showFormID(player, mResult[1], 0, ll.eval(mResult[2]));
                    // console.log("5");
                    // console.log(mResult);
                } else {
                    /* abc:13 [\"name\", \"abc\"] */
                    // abc => mResult[1]
                    // 13 => mResult[2]
                    // arr => mResult[3]

                    showFormID(player, mResult[1], Number(mResult[2]), ll.eval(mResult[3]));
                    // console.log("6");
                    // console.log(mResult);
                }
            }
        } else {
            /* abc {\"name\": \"abc\"} */
            /* abc:13 {\"name\": \"abc\"} */
            mReg = /(.*):(\d+) ({.*})$/;
            mResult = mReg.exec(name);
            if (mResult == null) {
                /* abc {\"name\": \"abc\"} */
                mReg = /(.*) ({.*})$/;
                mResult = mReg.exec(name);
                // abc => mResult[1]
                // obj => mResult[2]

                showFormID(player, mResult[1], 0, JSON.parse(mResult[2]));
                // console.log("3");
                // console.log(mResult);
            } else {
                /* abc:13 {\"name\": \"abc\"} */
                // abc => mResult[1]
                // 13 => mResult[2]
                // obj => mResult[3]

                showFormID(player, mResult[1], Number(mResult[2]), JSON.parse(mResult[3]));
                // console.log("4");
                // console.log(mResult);
            }
        }
    } else {
        /* abc:11 */
        // abc => mResult[1]
        // 11 => mResult[2]

        showFormID(player, mResult[1], Number(mResult[2]), null);
        // console.log("2");
        // console.log(mResult);
    }
}

/* 为玩家展示指定文件内的ID表单
 * @param player player
 * @param string name
 * @param int page_id 决定ID
 * @param object agrs 传参
 */
function showFormID(player, name, page_id, agrs) {
    let file = null;

    if (typeof(name) == "object") {
        file = "object";
    } else if (typeof(name) == "string") {
        name = name.replaceAll("/", "\\");
        // 读取文件
        file = File.readFrom('.\\plugins\\TiMENU\\forms\\' + name + '.json');
    }
    if (file == null) {
        /* 文件内容为null */
        player.tell(lang.msg_head_err + asVar(lang.file_not_found, [name]), 0);
        logger.error(asVar(lang.file_not_found, [name]));
    } else {
        if (typeof(name) == "object") {
            file = name;
        } else {
            // 将文件内容解析为json
            file = JSON.parse(file);
        }

        let isGroup = false;

        if (page_id == 0 || page_id == null || page_id == "") {
            // not do
        } else {
            file = file[page_id - 1];
            isGroup = true;
        }

        if (file.type == undefined || file.type == null) {
            if (file[0].type != undefined && file[0].type != null) {
                file = file[0];
                isGroup = true;
            } else {
                player.tell(lang.msg_head_err + asVar(lang.file_not_found, [name]), 0);
                logger.error(asVar(lang.file_not_found, [name]));
                return false;
            }
        }

        // 显示变量处理
        // 判断表单类型 
        let mVar = {};
        if (agrs != null) {
            if (Array.isArray(agrs)) {
                /* 数组 */
                agrs.forEach((item, index, arr) => {
                    mVar["agrs_".index] = item;
                });
            } else {
                /* json */
                for (key in agrs) {
                    mVar[key] = agrs[key];
                }
            }
        }

        if (file.type == 'modal') {
            file.title = useMVar(superVar(player, file.title, mVar), mVar);
            file.content = useMVar(superVar(player, file.content, mVar), mVar);
            file.button1.title = useMVar(superVar(player, file.button1.title, mVar), mVar);
            file.button2.title = useMVar(superVar(player, file.button2.title, mVar), mVar);
        } else if (file.type == 'button') {
            file.title = useMVar(superVar(player, file.title, mVar), mVar);
            file.content = useMVar(superVar(player, file.content, mVar), mVar);
            // 内容交给后面的遍历 263行
        } else if (file.type == 'diy') {
            file.title = useMVar(superVar(player, file.title, mVar), mVar);
            // 内容交给后面的遍历 300行
        }

        // 判断是否需要OP权限打开此menu
        if (file.op == 'true' || file.op == true) {
            /* 需要OP权限 */
            if (!player.isOP()) {
                /* 玩家没有OP权限 */
                player.tell(lang.msg_head_warn + lang.permission_denied, 0);
                logger.warn(player.name + " " + lang.permission_denied);
                return false;
            }
        }

        // 判断表单类型 
        if (file.type == 'modal') {
            /* 模式表单 */
            let button1 = file.button1; // 按钮1
            let onClick1 = button1.onClick; // 按钮1点击事件
            let button2 = file.button2; // 按钮2
            let onClick2 = button2.onClick; // 按钮2点击事件
            // let exit = file.exit; // 表单关闭事件
            let mForm = player.sendModalForm(file.title, file.content, button1.title, button2.title, function(player, result) {
                // if (result == null) {
                //     /* 表单被关闭 */
                //     runCmd(player, exit.type, exit.run, mVar);
                // } else {
                if (result) {
                    /* 按钮1被点击 */
                    if (isGroup == true && onClick1.type == "form" && onClick1.run.substr(0, 1) == ":") {
                        onClick1.run = name + onClick1.run;
                    }
                    runCmd(player, onClick1.type, onClick1.run, mVar);
                } else {
                    /* 按钮2被点击 */
                    if (isGroup == true && onClick2.type == "form" && onClick2.run.substr(0, 1) == ":") {
                        onClick2.run = name + onClick2.run;
                    }
                    runCmd(player, onClick2.type, onClick2.run, mVar);
                }
                // }
            });
            if (mForm == null) {
                /* 表单发送失败 */
                player.tell(lang.msg_head_err + asVar(lang.form_send_error, [name, "modal"]), 0);
                logger.error(asVar(lang.form_send_error, [name, "modal"]));
            }
        } else if (file.type == 'button') {
            /* 按钮表单 */
            let list = file.buttons; // 按钮列表
            let titleL = []; // 按钮标题列表
            let imgL = []; // 按钮图像列表
            let onClickL = []; // 按钮点击事件列表
            let exit = file.exit; // 表单关闭事件
            
            // 判空
            if (exit == undefined || exit == null) {
                exit = {
                    type: null,
                    run: ""
                };
            }
            
            // Callback
            let mFormCallback = function(player, id) {
                if (id == null) {
                    /* 表单被关闭 */
                    if (isGroup == true && exit.type == "form" && exit.run.substr(0, 1) == ":") {
                        exit.run = name + exit.run;
                    }
                    runCmd(player, exit.type, exit.run, mVar);
                } else {
                    /* 索引为id的按钮被点击 */
                    if (isGroup == true && onClickL[id].type == "form" && onClickL[id].run.substr(0, 1) == ":") {
                        onClickL[id].run = name + onClickL[id].run;
                    }
                    runCmd(player, onClickL[id].type, onClickL[id].run, mVar);
                }
            };
            
            // 判断是否是无按钮
            if (list.length == 0 || list == undefined || list == null) {
                let mForm = mc.newSimpleForm()
                    .setTitle(file.title)
                    .setContent(file.content);
                player.sendForm(mForm, mFormCallback);
                if (mForm == null) {
                    /* 表单发送失败 */
                    player.tell(lang.msg_head_err + asVar(lang.form_send_error, [name, "button"]), 0);
                    logger.error(asVar(lang.form_send_error, [name, "button"]));
                }
                return;
            }
            
            for (var i = 0; i < list.length; i++) {
                /* 将按钮内容分别存放到三个列表 */
                let items = list[i];
                titleL[titleL.length] = useMVar(superVar(player, items.title, mVar), mVar);
                if (items.image == null || items.image == "") {
                    /* 图片为空 */
                    imgL[imgL.length] = "";
                } else {
                    imgL[imgL.length] = items.image;
                }
                onClickL[onClickL.length] = items.onClick;
            }
            let mForm = player.sendSimpleForm(file.title, file.content, titleL, imgL, mFormCallback);
            if (mForm == null) {
                /* 表单发送失败 */
                player.tell(lang.msg_head_err + asVar(lang.form_send_error, [name, "button"]), 0);
                logger.error(asVar(lang.form_send_error, [name, "button"]));
            }
        } else if (file.type == 'diy') {
            /* 收集表单 */
            let mForm = mc.newCustomForm(); // 创建表单对象
            mForm.setTitle(file.title); // 设置表单的标题
            let list = file.items; // 表单控件列表
            //let VaRT = [];
            let send = file.send; // 表单提交事件
            let exit = file.exit; // 表单关闭事件
            
            // 判空
            if (exit == undefined || exit == null) {
                exit = {
                    type: null,
                    run: ""
                };
            }
            
            for (var i = 0; i < list.length; i++) {
                /* 遍历控件列表, 向表单内增加控件 */
                let items = list[i];
                if (items.type == "label") {
                    // superVar(player, str, mVar)
                    mForm.addLabel(useMVar(superVar(player, items.content, mVar), mVar));
                } else if (items.type == "input") {
                    if (items.placeholder == undefined || items.placeholder == null) {
                        items.placeholder = "";
                    }
                    if (items["default"] == undefined || items["default"] == null) {
                        items["default"] = "";
                    }
                    mForm.addInput(useMVar(superVar(player, items.title, mVar), mVar), useMVar(superVar(player, items.placeholder, mVar), mVar), useMVar(superVar(player, items["default"], mVar), mVar));
                } else if (items.type == "switch") {
                    // 是不是想问为什么不用items.default？因为我的代码格式化工具会把default认为是switch中的默认执行块标识, 会自动换行qwq
                    /* be like
                    mForm.addSwitch(items.title, items.
default);
                    */
                    // 虽然这样不影响代码运行, 但是影响代码可读性qwq
                    if (items["default"] == undefined || items["default"] == null) {
                        items["default"] = false;
                    }
                    mForm.addSwitch(useMVar(superVar(player, items.title, mVar), mVar), items["default"]);
                } else if (items.type == "dropdown") {
                    if (items["default"] == undefined || items["default"] == null) {
                        items["default"] = 0;
                    }

                    items.items.forEach((item, index, arr) => {
                        // 超级变量支持
                        items.items[index] = useMVar(superVar(player, item, mVar), mVar);
                    });

                    if (items.show != undefined) {
                        if (items.show.length == items.items.length) {
                            items.show.forEach((item, index, arr) => {
                                // 超级变量支持
                                items.show[index] = useMVar(superVar(player, item, mVar), mVar);
                            });
                            mForm.addDropdown(useMVar(superVar(player, items.title, mVar), mVar), items.show, items["default"]);
                        } else {
                            mForm.addDropdown(useMVar(superVar(player, items.title, mVar), mVar), items.items, items["default"]);
                        }
                    } else {
                        mForm.addDropdown(useMVar(superVar(player, items.title, mVar), mVar), items.items, items["default"]);
                    }

                } else if (items.type == "slider") {
                    if (items.step == undefined || items.step == null) {
                        items.step = 1;
                    }

                    if (items["default"] == undefined || items["default"] == null) {
                        items["default"] = 0;
                    }

                    mForm.addSlider(useMVar(superVar(player, items.title, mVar), mVar), items.min, items.max, items.step, items["default"]);
                } else if (items.type == "stepSlider") {
                    if (items["default"] == undefined || items["default"] == null) {
                        items["default"] = 0;
                    }

                    items.items.forEach((item, index, arr) => {
                        // 超级变量支持
                        items.items[index] = useMVar(superVar(player, item, mVar), mVar);
                    });

                    if (items.show != undefined) {
                        if (items.show.length == items.items.length) {
                            items.show.forEach((item, index, arr) => {
                                // 超级变量支持
                                items.show[index] = useMVar(superVar(player, item, mVar), mVar);
                            });
                            mForm.addStepSlider(useMVar(superVar(player, items.title, mVar), mVar), items.show, items["default"]);
                        } else {
                            mForm.addStepSlider(useMVar(superVar(player, items.title, mVar), mVar), items.items, items["default"]);
                        }
                    } else {
                        mForm.addStepSlider(useMVar(superVar(player, items.title, mVar), mVar), items.items, items["default"]);
                    }

                } else if (items.type == "player_dropdown") {
                    // 在线玩家列表 - 下拉菜单
                    let mItems = [];
                    let playerList = mc.getOnlinePlayers();
                    playerList.forEach(item => {
                        mItems[mItems.length] = item.name;
                    });
                    list[i]["items"] = mItems;
                    mForm.addDropdown(superVar(player, items.title, mVar), mItems, 0);
                } else if (items.type == "player_dropdown_xuid") {
                    // 在线玩家列表 - 下拉菜单 - 返回xuid
                    let mItems = [];
                    let mShows = [];
                    let playerList = mc.getOnlinePlayers();
                    playerList.forEach(item => {
                        mItems[mItems.length] = item.xuid;
                        mShows[mItems.length] = item.name;
                    });
                    list[i]["items"] = mItems;
                    mForm.addDropdown(superVar(player, items.title, mVar), mShows, 0);
                } else {
                    /* 匹配不到任何一个类型 */
                    player.tell(lang.msg_head_err + asVar(lang.form_error, [name, "items.type"]), 0);
                    logger.error(asVar(lang.form_error, [name, "items.type"]));
                }
            }
            // 发送表单
            player.sendForm(mForm, function(player, data) {
                if (data == null) {
                    /* 表单被关闭 */
                    // 突然发现个问题
                    // 既然表单被关闭之后data==null, 那还怎么传值？
                    //if (exit.type != "eval" && exit.type != "OP_eval") {
                    //    exit.run = runDiyForm(list, data, exit.run);
                    //} else {
                    //    mVar = Object.assign(mVar, runDiyFormV(list, data));
                    //}

                    if (isGroup == true && exit.type == "form" && exit.run.substr(0, 1) == ":") {
                        exit.run = name + exit.run;
                    }
                    runCmd(player, exit.type, exit.run, mVar);
                } else {
                    /* 表单被提交 */
                    if (send.type != "eval" && send.type != "OP_eval") {
                        send.run = runDiyForm(list, data, send.run);
                    } else {
                        mVar = Object.assign(mVar, runDiyFormV(list, data));
                    }

                    if (isGroup == true && send.type == "form" && send.run.substr(0, 1) == ":") {
                        send.run = name + send.run;
                    }
                    runCmd(player, send.type, send.run, mVar);
                }
            });
        } else {
            /* 匹配不到任何一个类型 */
            player.tell(lang.msg_head_err + asVar(lang.form_error, [name, "type"]), 0);
            logger.error(asVar(lang.form_error, [name, "type"]));
        }

    }
}

/* diy表单专用变量赋值
 * @param array list
 * @param string data
 * @param string str
 * @return string
 */
function runDiyForm(list, data, str) {
    let newstr = str;
    let k = "";
    let v = "";
    for (var ii = 0; ii < data.length; ii++) {
        if (list[ii].assign == undefined || list[ii].assign == null) {
            continue;
        }

        k = list[ii].assign + "";
        v = data[ii];
        if (list[ii].type == "dropdown" || list[ii].type == "stepSlider" || list[ii].type == "player_dropdown" || list[ii].type == "player_dropdown_xuid") {
            let items = list[ii].items;
            v = items[v];
        } else if (list[ii].type == "label") {
            v = list[ii].content;
        }
        k = k + "";
        v = v + "";
        newstr = newstr.replaceAll(k, v);
    }
    return newstr;
}

/* diy表单专用v
 * @param array list
 * @param string data
 * @return object
 */
function runDiyFormV(list, data) {
    let newjson = {};
    let k = "";
    let v = "";
    for (var ii = 0; ii < data.length; ii++) {
        if (list[ii].assign == undefined || list[ii].assign == null) {
            continue;
        }

        k = list[ii].assign + "";
        v = data[ii];
        if (list[ii].type == "dropdown" || list[ii].type == "stepSlider" || list[ii].type == "player_dropdown" || list[ii].type == "player_dropdown_xuid") {
            let items = list[ii].items;
            v = items[v];
        } else if (list[ii].type == "label") {
            v = list[ii].content;
        }
        k = k + "";
        v = v + "";

        if (k.substring(0, 2) == "${" && k.slice(-1) == "}") {
            k = k.slice(2);
            k = k.substr(0, k.length - 1);
        }

        newjson[k] = v;
    }
    return newjson;
}

/* 插件设置菜单
 * @param player player
 */
function setPlugin(player) {
    let mForm = mc.newSimpleForm();
    // [TiMENU] »操作菜单
    mForm.setTitle(lang.set_1_title);
    // ...
    mForm.setContent(lang.set_1_content);
    // 插件配置文件
    mForm.addButton(lang.set_1_btn_1, "textures/ui/icon_book_writable");
    // 表单编辑器
    mForm.addButton(lang.set_1_btn_2, "textures/ui/storageIconColor");
    // 表单市场
    mForm.addButton(lang.set_1_btn_3, "textures/ui/icon_blackfriday");
    // 导入其他菜单文件
    mForm.addButton(lang.set_1_btn_4, "textures/ui/mashup_PaintBrush");
    // 关于本插件
    mForm.addButton(lang.set_1_btn_5, "textures/ui/icon_sign");
    player.sendForm(mForm, function(player, id) {
        switch (id) {
            case 0:
                /* 插件配置文件 */
                if (expansionPack == true) {
                    /* 启用了快速编辑扩展包 */
                    player.sendModalForm(lang.msg_head + lang.set_1_btn_1, lang.set_config_usepack_content, lang.set_config_usepack_btn_1, lang.set_config_usepack_btn_2, function(player, result) {
                        if (result) {
                            selectItem(player, 1, function(result) {
                                if (result == null) {
                                    /* 玩家关闭表单或扩展包不存在 */
                                    setPlugin(player);
                                } else {
                                    config.set("mainMenu", "item", "minecraft:" + result);
                                    config.reload();
                                    player.tell(asVar(lang.set_config_main_item, ["minecraft:" + result]), 0);
                                }
                            });
                        } else {
                            setPlugin_config(player);
                        }
                    });
                } else {
                    setPlugin_config(player);
                }
                break;
            case 1:
                /* 表单编辑器 */
                menuEditor_folder(player, '.\\plugins\\TiMENU\\forms');
                break;
            case 2:
                /* 表单市场 */
                // 暂时没有做完，不引入language
                player.tell("未开放", 0);
                break;
            case 3:
                /* 导入其他菜单文件 */
                another2mine(player);
                break;
            case 4:
                /* 关于本插件 */
                // 异步GET公告
                network.httpGet(serverUrl + "gg.php", function(status, result) {
                    let aboutForm = mc.newSimpleForm();
                    aboutForm.setTitle("about TiMENU");
                    aboutForm.setContent("一款功能强大的GUI菜单插件\n\nversion: " + version[0] + "." + version[1] + "." + version[2] + "\nlanguage: " + language + "\n\n" + result.replaceAll("\\n", "\n"));
                    aboutForm.addButton("Update ALL", "textures/ui/free_download_symbol");
                    aboutForm.addButton("Update Plug-in", "textures/ui/free_download_symbol");
                    aboutForm.addButton("Update language file", "textures/ui/free_download_symbol");
                    aboutForm.addButton("Exit", "textures/ui/cancel");
                    player.sendForm(aboutForm, function(player, id) {
                        if (id == null || id == 3) {
                            setPlugin(player);
                        } else if (id == 0) {
                            updatePlugin();
                            downLang();
                        } else if (id == 1) {
                            updatePlugin();
                        } else if (id == 2) {
                            downLang();
                        }
                    });
                });
                break;
        }
    });
}

/* 修改插件配置文件
 * @param player player
 */
function setPlugin_config(player) {
    let mForm = mc.newCustomForm();
    mForm.setTitle("config.ini");

    mForm.addLabel(lang.set_config_mainMenu);
    // 1
    mForm.addInput(lang.set_config_mainMenu_name, "main", config.getStr("mainMenu", "name", "main"));
    // 2
    mForm.addInput(lang.set_config_mainMenu_item, "minecraft:clock", config.getStr("mainMenu", "item", "minecraft:clock"));


    // 3
    mForm.addInput(lang.set_config_mainMenu_item_name, "§a打开§l§e[主菜单]", config.getStr("mainMenu", "itemName", "§a打开§l§e[主菜单]"));
    // 4
    mForm.addInput(lang.set_config_mainMenu_item_lore, "§5输入命令 §l§d/menu give §r§5可再拿一个", config.getStr("mainMenu", "itemLore", "§5输入命令 §l§d/menu give §r§5可再拿一个"));
    // 5
    mForm.addInput(lang.set_config_mainMenu_item_aux, "0", config.getInt("mainMenu", "itemAux", 0)
        .toString());
    // 6
    mForm.addInput(lang.set_config_mainMenu_item_num, "1", config.getInt("mainMenu", "itemNum", 1)
        .toString());

    // 7
    mForm.addSwitch(lang.set_config_mainMenu_autoGiveItem, config.getBool("mainMenu", "autoGiveItem", true));

    mForm.addLabel(lang.set_config_plugin);
    // 9
    mForm.addSwitch(lang.set_config_plugin_autoUpdate, config.getBool("plugin", "autoUpdate", true));

    // 发送表单
    player.sendForm(mForm, function(player, data) {
        config.set("mainMenu", "name", data[1]);
        config.set("mainMenu", "item", data[2]);
        config.set("mainMenu", "itemName", data[3]);
        config.set("mainMenu", "itemLore", data[4]);
        config.set("mainMenu", "itemAux", Number(data[5]));
        config.set("mainMenu", "itemNum", Number(data[6]));
        config.set("mainMenu", "autoGiveItem", data[7]);
        config.set("plugin", "autoUpdate", data[9]);
        config.reload();

        setPlugin(player);
    });
}

// /* 表单编辑器
// * @param player player
// * @param string path
// */
// function menuEditor(player, path) {
// path = path.replaceAll("/", "\\");
// if (!File.exists(path)) {
// /* 文件/文件夹不存在 */
// if (path.indexOf(".") != -1) {
// /* 路径包含点, 可能是文件, 新建文件 */
// } else {}
// } else if (File.checkIsDir(path)) {
// /* 是文件夹 */
// menuEditor_folder(player, path);
// } else {
// /* 是文件 */
// menuEditor_file(player, path);
// }
// }

/* 表单编辑器_文件夹
 * @param player player
 * @param string path
 */
function menuEditor_folder(player, path) {
    // 规范化目录
    path = path.replaceAll("/", "\\");
    if (path.slice(-1) == "\\") {
        path = path.slice(0, path.length - 1);
    }

    let pathArr = path.split("\\");

    // 上一层文件夹
    let pathArrPop = pathArr.concat();
    pathArrPop.pop();
    let lastPath = pathArrPop.join("\\");

    // 文件夹名称
    let dirName = pathArr[pathArr.length - 1];

    let isRoot = false;
    if (path == '.\\plugins\\TiMENU\\forms') {
        isRoot = true;
    }

    let mForm = mc.newSimpleForm();
    // 表单编辑器
    mForm.setTitle(lang.menuEditor_folder_title);
    mForm.setContent(path);

    if (isRoot) {
        /* 是插件表单根目录 */
        // 退出表单编辑器
        mForm.addButton(lang.menuEditor_folder_exit, "textures/ui/cancel");
    } else {
        /* 不是插件表单根目录 */
        // ../ 上一级目录
        mForm.addButton(lang.menuEditor_folder_last, "textures/ui/switch_bumper_left");
    }

    // 文件夹操作
    mForm.addButton(lang.menuEditor_folder_tool);

    // 按首字母排序的文件夹与文件相互交叉混乱的文件列表
    let fileListRand = File.getFilesList(path);

    // 文件夹列表
    let fileListFolder = [];
    let nameListFolder = [];
    // 文件列表
    let fileListFile = [];
    let nameListFile = [];

    // 整理过的文件夹在文件上方，且按首字母排序的文件列表
    // 我真是个备注大湿(
    let fileList = [];

    let itemAllPath;
    fileListRand.forEach(item => {
        itemAllPath = path + "\\" + item;
        if (File.checkIsDir(itemAllPath)) {
            /* 是文件夹 */
            fileListFolder[fileListFolder.length] = itemAllPath;
            nameListFolder[nameListFolder.length] = item;
        } else {
            /* 是文件 */
            fileListFile[fileListFile.length] = itemAllPath;
            nameListFile[nameListFile.length] = item;
        }
    });

    // 文件夹
    nameListFolder.forEach(function(item, index, self) {
        fileList[fileList.length] = fileListFolder[index];
        mForm.addButton(item, "textures/ui/storageIconColor");
    });

    // 文件
    nameListFile.forEach(function(item, index, self) {
        // fileNowPath = fileListFile[index];
        fileList[fileList.length] = fileListFile[index];
        let fileNowFile = JSON.parse(File.readFrom(fileListFile[index]));

        if (fileNowFile.type == "modal") {
            /* modal表单 */
            mForm.addButton(item, "textures/ui/icon_sign");
        } else if (fileNowFile.type == "button") {
            /* button表单 */
            mForm.addButton(item, "textures/ui/background_panel");
        } else if (fileNowFile.type == "diy") {
            /* diy表单 */
            mForm.addButton(item, "textures/ui/icon_book_writable");
        } else {
            /* 识别不出来 */
            mForm.addButton(item, "textures/ui/ErrorGlyph");
        }
    });

    // 发送表单
    player.sendForm(mForm, function(player, id) {
        if (id == null) {
            /* 表单被关闭 */
            setPlugin(player);
        } else if (id == 0) {
            if (isRoot) {
                /* 退出表单编辑器 */
                setPlugin(player);
            } else {
                /* 上一层目录 */
                menuEditor_folder(player, lastPath);
            }
        } else if (id == 1) {
            /* 文件夹操作 */
            let folderForm = mc.newSimpleForm();
            // 文件夹操作
            folderForm.setTitle(lang.menuEditor_folder_tool);
            folderForm.setContent(path);

            // 新建表单
            folderForm.addButton(lang.menuEditor_folder_new_file);
            // 新建文件夹
            folderForm.addButton(lang.menuEditor_folder_new_dir);
            // 重命名文件夹
            folderForm.addButton(lang.menuEditor_folder_rename_dir);
            if (!isRoot) {
                // 删除文件夹
                folderForm.addButton(lang.menuEditor_folder_delete_dir);
            }

            player.sendForm(folderForm, function(player, id) {
                let useToolForm = mc.newCustomForm();
                switch (id) {
                    case 0:
                        /* 新建表单 */
                        // 新建表单
                        useToolForm.setTitle(lang.menuEditor_folder_new_file);
                        // 文件名 文件名不能为空
                        useToolForm.addInput(lang.menuEditor_file_name, asVar(lang.not_empty, [lang.menuEditor_file_name]));
                        player.sendForm(useToolForm, function(player, data) {
                            if (data == null) {
                                menuEditor_folder(player, path);
                            } else {
                                menuEditor_file(player, path + "\\" + data[0] + ".json");
                            }
                        });
                        break;
                    case 1:
                        /* 新建文件夹 */
                        // 新建文件夹
                        useToolForm.setTitle(lang.menuEditor_folder_new_dir);
                        // 文件夹名称 文件夹名称不能为空
                        useToolForm.addInput(lang.menuEditor_dir_name, asVar(lang.not_empty, [lang.menuEditor_dir_name]));
                        player.sendForm(useToolForm, function(player, data) {
                            if (data == null) {
                                menuEditor_folder(player, path);
                            } else {
                                File.mkdir(path + "\\" + data[0]);
                                menuEditor_folder(player, path + "\\" + data[0]);
                            }
                        });
                        break;
                    case 2:
                        /* 重命名文件夹 */
                        // 重命名文件夹
                        useToolForm.setTitle(lang.menuEditor_folder_rename_dir);
                        // 文件夹名称 文件夹名称不能为空
                        useToolForm.addInput(lang.menuEditor_dir_name, asVar(lang.not_empty, [lang.menuEditor_dir_name]));
                        player.sendForm(useToolForm, function(player, data) {
                            if (data == null) {
                                menuEditor_folder(player, path);
                            } else {
                                File.rename(path, lastPath + "\\" + data[0]);
                                menuEditor_(player, lastPath + "\\" + data[0]);
                            }
                        });
                        break;
                    case 3:
                        /* 删除文件夹 */
                        File.delete(path);
                        menuEditor_folder(player, lastPath);
                        break;
                    default:
                        menuEditor_folder(player, path);
                        break;
                }
            });
        } else {
            if (File.checkIsDir(fileList[id - 2])) {
                /* 是文件夹 */
                menuEditor_folder(player, fileList[id - 2]);
            } else {
                /* 是文件 */
                menuEditor_file(player, fileList[id - 2]);
            }
        }
    });

}

/* 表单编辑器_表单文件
 * @param player player
 * @param string path
 */
function menuEditor_file(player, path) {
    path = path.replaceAll("/", "\\");
    // let path = ".\\plugins\\TiMENU\\abc.json";
    let pathArr = path.split("\\");

    // 上一层文件夹
    let pathArrPop = pathArr.concat();
    pathArrPop.pop();
    let lastPath = pathArrPop.join("\\");

    // 文件名
    let fileName = pathArr[pathArr.length - 1];

    // 判断文件是否存在
    if (!File.exists(path)) {
        /* 文件不存在, 新建文件 */
        let mForm = mc.newSimpleForm();
        mForm.setTitle(fileName);
        // 新建表单文件, 请选择表单类型
        mForm.setContent(lang.menuEditor_file_new_title);

        // modal 模式表单
        mForm.addButton(lang.menuEditor_file_new_modal, "textures/ui/dialog_background_hollow_8");
        // button 按钮表单
        mForm.addButton(lang.menuEditor_file_new_button, "textures/ui/keyboard_tooltip_background");
        // diy 收集表单
        mForm.addButton(lang.menuEditor_file_new_diy, "textures/ui/multiselection");
        // §l返回
        mForm.addButton(lang.menuEditor_file_new_exit, "textures/ui/cancel");

        player.sendForm(mForm, function(player, id) {
            switch (id) {
                case 0:
                    /* modal 模式表单 */
                    let mModal = {
                        "type": "modal",
                        "op": "false",
                        "title": "",
                        "content": "",
                        "button1": {
                            "title": "",
                            "onClick": {
                                "type": "",
                                "run": ""
                            }
                        },
                        "button2": {
                            "title": "",
                            "onClick": {
                                "type": "",
                                "run": ""
                            }
                        }
                    };

                    File.writeTo(path, JSON.stringify(mModal, null, 4));
                    menuEditor_file(player, path);
                    break;
                case 1:
                    /* button 按钮表单 */
                    let mButton = {
                        "type": "button",
                        "op": "false",
                        "title": "",
                        "content": "",
                        "buttons": [],
                        "exit": {
                            "type": "",
                            "run": ""
                        }
                    };

                    File.writeTo(path, JSON.stringify(mButton, null, 4));
                    menuEditor_file(player, path);
                    break;
                case 2:
                    /* diy 收集表单 */
                    let mDiy = {
                        "type": "diy",
                        "op": "false",
                        "title": "",
                        "items": [],
                        "send": {
                            "type": "",
                            "run": ""
                        },
                        "exit": {
                            "type": "",
                            "run": ""
                        }
                    };

                    File.writeTo(path, JSON.stringify(mDiy, null, 4));
                    menuEditor_file(player, path);
                    break;
                case 3:
                    /* §l返回 */
                    menuEditor_folder(player, lastPath);
                    break;
            }
        });
    } else {
        /* 文件存在 */
        let file = File.readFrom(path);
        // 将文件内容解析为json
        file = JSON.parse(file);

        if (file.type == "modal") {
            /* modal表单 */
            menuEditor_file_modal(player, path);
        } else if (file.type == "button") {
            /* button表单 */
            menuEditor_file_button(player, path);
        } else if (file.type == "diy") {
            /* diy表单 */
            menuEditor_file_diy(player, path);
        }

    }
}

/* 表单编辑器_表单文件_modal表单
 * @param player player
 * @param string path
 */
function menuEditor_file_modal(player, path) {
    path = path.replaceAll("/", "\\");
    // let path = ".\\plugins\\TiMENU\\abc.json";
    let pathArr = path.split("\\");

    // 上一层文件夹
    let pathArrPop = pathArr.concat();
    pathArrPop.pop();
    let lastPath = pathArrPop.join("\\");

    // 文件名
    let fileName = pathArr[pathArr.length - 1];

    let file = File.readFrom(path);
    // 将文件内容解析为json
    file = JSON.parse(file);

    let mForm = mc.newCustomForm();
    mForm.setTitle(fileName);

    // 修改 modal 模式表单
    mForm.addLabel(lang.menuEditor_file_modal_content);

    mForm.addLabel("");
    // 是否需要管理员(op)权限
    if (file.op == "false") {
        mForm.addSwitch(lang.menuEditor_file_needop, false); // 2
    } else if (file.op == "true") {
        mForm.addSwitch(lang.menuEditor_file_needop, true); // 2
    }

    // 表单标题
    mForm.addInput(lang.menuEditor_file_form_title, file.title, file.title); // 3
    // 表单内容
    mForm.addInput(lang.menuEditor_file_form_content, file.content, file.content); // 4

    mForm.addLabel("");
    // 按钮一
    mForm.addLabel(lang.menuEditor_file_modal_btn1);
    mForm.addInput(lang.text, file.button1.title, file.button1.title); // 7
    mForm.addDropdown(lang.menuEditor_file_onclick_type, [
    lang.menuEditor_file_onclick_1type,
    lang.menuEditor_file_onclick_2type,
    lang.menuEditor_file_onclick_3type,
    lang.menuEditor_file_onclick_4type,
    lang.menuEditor_file_onclick_5type,
    lang.menuEditor_file_onclick_6type,
    lang.menuEditor_file_onclick_7type,
    lang.menuEditor_file_onclick_8type], menuEditor_file_onClick_strtoint(file.button1.onClick.type)); // 8
    // mForm.addInput(lang.menuEditor_file_onclick_run, file.button1.onClick.run, file.button1.onClick.run); // 9
    if (typeof(file.button1.onClick.run) == "string") {
        /* 字符串单条命令 */
        mForm.addInput(lang.menuEditor_file_onclick_run, file.button1.onClick.run, file.button1.onClick.run); // 9
    } else if (Array.isArray(file.button1.onClick.run)) {
        /* 数组多条命令 */

        let mRun = file.button1.onClick.run;
        let mRunToString = "";
        mRun.forEach(item => {
            if (typeof(item) == "string") {
                mRunToString += ", \"" + item + "\"";
            } else {
                mRunToString += ", " + item.toString();
            }
        });
        mRunToString = "arr " + mRunToString.slice(2) + "";

        mForm.addInput(lang.menuEditor_file_onclick_run, mRunToString, mRunToString); // 9
    } else {
        /* 不支持编辑的类型 */
        mForm.addInput(lang.menuEditor_file_onclick_run, lang.menuEditor_cannot, lang.menuEditor_cannot); // 9
    }

    mForm.addLabel("");
    // 按钮二
    mForm.addLabel(lang.menuEditor_file_modal_btn2);
    mForm.addInput(lang.text, file.button2.title, file.button2.title); // 12
    mForm.addDropdown(lang.menuEditor_file_onclick_type, [
    lang.menuEditor_file_onclick_1type,
    lang.menuEditor_file_onclick_2type,
    lang.menuEditor_file_onclick_3type,
    lang.menuEditor_file_onclick_4type,
    lang.menuEditor_file_onclick_5type,
    lang.menuEditor_file_onclick_6type,
    lang.menuEditor_file_onclick_7type,
    lang.menuEditor_file_onclick_8type], menuEditor_file_onClick_strtoint(file.button2.onClick.type)); // 13
    // mForm.addInput(lang.menuEditor_file_onclick_run, file.button2.onClick.run, file.button2.onClick.run); // 14
    if (typeof(file.button2.onClick.run) == "string") {
        /* 字符串单条命令 */
        mForm.addInput(lang.menuEditor_file_onclick_run, file.button2.onClick.run, file.button2.onClick.run); // 14
    } else if (Array.isArray(file.button2.onClick.run)) {
        /* 数组多条命令 */

        let mRun = file.button2.onClick.run;
        let mRunToString = "";
        mRun.forEach(item => {
            if (typeof(item) == "string") {
                mRunToString += ", \"" + item + "\"";
            } else {
                mRunToString += ", " + item.toString();
            }
        });
        mRunToString = "arr " + mRunToString.slice(2) + "";

        mForm.addInput(lang.menuEditor_file_onclick_run, mRunToString, mRunToString); // 14
    } else {
        /* 不支持编辑的类型 */
        mForm.addInput(lang.menuEditor_file_onclick_run, lang.menuEditor_cannot, lang.menuEditor_cannot); // 14
    }




    // mForm.addLabel("");
    // mForm.addLabel(lang.menuEditor_file_close_btn); // 16
    // mForm.addDropdown(lang.menuEditor_file_onclick_type, [
    // lang.menuEditor_file_onclick_1type,
    // lang.menuEditor_file_onclick_2type,
    // lang.menuEditor_file_onclick_3type,
    // lang.menuEditor_file_onclick_4type,
    // lang.menuEditor_file_onclick_5type,
    // lang.menuEditor_file_onclick_6type,
    // lang.menuEditor_file_onclick_7type,
    // lang.menuEditor_file_onclick_8type], menuEditor_file_onClick_strtoint(file.exit.type)); // 17
    // mForm.addInput(lang.menuEditor_file_onclick_run, file.exit.run, file.exit.run); // 18

    mForm.addLabel("");
    // 修改文件名
    mForm.addInput(lang.menuEditor_file_rename, fileName, fileName); // 16

    mForm.addLabel("");
    // 选择操作 保存修改 撤销更改 删除文件
    mForm.addStepSlider(lang.menuEditor_file_todo, [lang.menuEditor_file_todo_save, lang.menuEditor_file_todo_undo, lang.menuEditor_file_todo_del], 0); // 18

    // 发送表单
    player.sendForm(mForm, function(player, data) {
        // 修改mModal
        if (data[18] == 0) {
            file.op = data[2] == true ? "true" : "false";
            file.title = data[3];
            file.content = data[4];

            file.button1.title = data[7];
            file.button1.onClick.type = menuEditor_file_onClick_inttostr(data[8]);
            // file.button1.onClick.run = data[9];
            if (lang.menuEditor_cannot == data[9]) {
                // 
            } else if (data[9].substring(0, 5) == "arr \"") {
                let mArray = "[" + data[9].slice(4) + "]";
                mArray = ll.eval(mArray);
                file.button1.onClick.run = mArray;
            } else {
                file.button1.onClick.run = data[9];
            }

            file.button2.title = data[12];
            file.button2.onClick.type = menuEditor_file_onClick_inttostr(data[13]);
            // file.button2.onClick.run = data[14];
            if (lang.menuEditor_cannot == data[14]) {
                // 
            } else if (data[14].substring(0, 5) == "arr \"") {
                let mArray = "[" + data[14].slice(4) + "]";
                mArray = ll.eval(mArray);
                file.button2.onClick.run = mArray;
            } else {
                file.button2.onClick.run = data[14];
            }


            // file.exit.type = menuEditor_file_onClick_inttostr(data[17]);
            // file.exit.run = data[18];

            // 写入文件
            File.writeTo(path, JSON.stringify(file, null, 4));

            if (data[16] != fileName) {
                File.rename(path, lastPath + "\\" + data[16]);
            }
        } else if (data[18] == 1) {
            // not do anything
        } else if (data[18] == 2) {
            File.delete(path);
        }

        menuEditor_folder(player, lastPath);

    });
}

/* 表单编辑器_表单文件_button表单
 * @param player player
 * @param string path
 */
function menuEditor_file_button(player, path) {
    path = path.replaceAll("/", "\\");
    // let path = ".\\plugins\\TiMENU\\abc.json";
    let pathArr = path.split("\\");

    // 上一层文件夹
    let pathArrPop = pathArr.concat();
    pathArrPop.pop();
    let lastPath = pathArrPop.join("\\");

    // 文件名
    let fileName = pathArr[pathArr.length - 1];

    let file = File.readFrom(path);
    // 将文件内容解析为json
    file = JSON.parse(file);

    let mForm = mc.newSimpleForm();
    mForm.setTitle(fileName);
    mForm.setContent(lang.menuEditor_file_button_content);
    mForm.addButton(lang.menuEditor_file_form_editor);

    for (var i = 0; i < file.buttons.length; i++) {
        let items = file.buttons[i];
        if (items.image == null || items.image == "") {
            mForm.addButton(items.title);
        } else {
            mForm.addButton(items.title, items.image);
        }
    }

    mForm.addButton(lang.menuEditor_file_button_add);

    // 发送表单
    player.sendForm(mForm, function(player, id) {
        if (id == null) {
            /* 玩家关闭表单 */
            menuEditor_folder(player, lastPath);
        } else if (id == 0) {
            /* 修改表单基础信息 */
            let editorForm = mc.newCustomForm();
            editorForm.setTitle(fileName);

            editorForm.addLabel(lang.menuEditor_file_button_0_content);

            editorForm.addLabel("");
            if (file.op == "false") {
                editorForm.addSwitch(lang.menuEditor_file_needop, false); // 2
            } else if (file.op == "true") {
                editorForm.addSwitch(lang.menuEditor_file_needop, true); // 2
            }

            editorForm.addInput(lang.menuEditor_file_form_title, file.title, file.title); // 3
            editorForm.addInput(lang.menuEditor_file_form_content, file.content, file.content); // 4

            editorForm.addLabel("");
            editorForm.addLabel(lang.menuEditor_file_close_btn);
            editorForm.addDropdown(lang.menuEditor_file_onclick_type, [
            lang.menuEditor_file_onclick_1type,
            lang.menuEditor_file_onclick_2type,
            lang.menuEditor_file_onclick_3type,
            lang.menuEditor_file_onclick_4type,
            lang.menuEditor_file_onclick_5type,
            lang.menuEditor_file_onclick_6type,
            lang.menuEditor_file_onclick_7type,
            lang.menuEditor_file_onclick_8type], menuEditor_file_onClick_strtoint(file.exit.type)); // 7
            editorForm.addInput(lang.menuEditor_file_onclick_run, file.exit.run, file.exit.run); // 8

            editorForm.addLabel("");
            editorForm.addInput(lang.menuEditor_file_rename, fileName, fileName); // 10

            editorForm.addLabel("");
            editorForm.addStepSlider(lang.menuEditor_file_todo, [lang.menuEditor_file_todo_save, lang.menuEditor_file_todo_undo, lang.menuEditor_file_todo_del], 0); // 12

            // 发送表单
            player.sendForm(editorForm, function(player, data) {
                // 修改
                if (data[12] == 0) {
                    file.op = data[2] == true ? "true" : "false";
                    file.title = data[3];
                    file.content = data[4];

                    file.exit.type = menuEditor_file_onClick_inttostr(data[7]);
                    file.exit.run = data[8];

                    // 写入文件
                    File.writeTo(path, JSON.stringify(file, null, 4));

                    if (data[10] != fileName) {
                        File.rename(path, lastPath + "\\" + data[10]);
                        path = lastPath + "\\" + data[10];
                    }
                } else if (data[12] == 1) {
                    // not do anything
                } else if (data[12] == 2) {
                    File.delete(path);
                }

                menuEditor_file_button(player, path);

            });
        } else if (id == file.buttons.length + 1) {
            /* 添加一个按钮 */
            let newIndex = file.buttons.length;
            file.buttons.push({
                "title": "(new) 新增按钮 " + newIndex,
                "image": "",
                "onClick": {
                    "type": "",
                    "run": ""
                }
            });

            // file["buttons"][newIndex]["title"] = "新建按钮 " + newIndex;
            // Uncaught TypeError: Cannot set property 'title' of undefined
            // file["buttons"][newIndex]["image"] = "";
            // file["buttons"][newIndex]["onClick"]["type"] = "";
            // file["buttons"][newIndex]["onClick"]["run"] = "";

            // 写入文件
            File.writeTo(path, JSON.stringify(file, null, 4));

            menuEditor_file_button(player, path);
        } else {
            /* 修改按钮 */
            let mIndex = id - 1;

            let editorForm = mc.newCustomForm();
            editorForm.setTitle(lang.menuEditor_file_button_1_title);

            // 按钮文本
            editorForm.addInput(lang.menuEditor_file_button_1_text, file["buttons"][mIndex]["title"], file["buttons"][mIndex]["title"]); // 0
            // 按钮图标
            editorForm.addInput(lang.menuEditor_file_button_1_icon, file["buttons"][mIndex]["image"], file["buttons"][mIndex]["image"]); // 1
            editorForm.addDropdown(lang.menuEditor_file_onclick_type, [
            lang.menuEditor_file_onclick_1type,
            lang.menuEditor_file_onclick_2type,
            lang.menuEditor_file_onclick_3type,
            lang.menuEditor_file_onclick_4type,
            lang.menuEditor_file_onclick_5type,
            lang.menuEditor_file_onclick_6type,
            lang.menuEditor_file_onclick_7type,
            lang.menuEditor_file_onclick_8type], menuEditor_file_onClick_strtoint(file["buttons"][mIndex]["onClick"]["type"])); // 2
            if (typeof(file["buttons"][mIndex]["onClick"]["run"]) == "string") {
                /* 字符串单条命令 */
                editorForm.addInput(lang.menuEditor_file_onclick_run, file["buttons"][mIndex]["onClick"]["run"], file["buttons"][mIndex]["onClick"]["run"]); // 3
            } else if (Array.isArray(file["buttons"][mIndex]["onClick"]["run"])) {
                /* 数组多条命令 */

                let mRun = file["buttons"][mIndex]["onClick"]["run"];
                let mRunToString = "";
                mRun.forEach(item => {
                    if (typeof(item) == "string") {
                        mRunToString += ", \"" + item + "\"";
                    } else {
                        mRunToString += ", " + item.toString();
                    }
                });
                mRunToString = "arr " + mRunToString.slice(2) + "";

                editorForm.addInput(lang.menuEditor_file_onclick_run, mRunToString, mRunToString); // 3
            } else {
                /* 不支持编辑的类型 */
                editorForm.addInput(lang.menuEditor_file_onclick_run, lang.menuEditor_cannot, lang.menuEditor_cannot); // 3
            }


            editorForm.addLabel("");
            if (expansionPack == true) {
                /* 启用了快速编辑扩展包 */
                editorForm.addStepSlider(lang.menuEditor_file_todo, [lang.menuEditor_file_todo_save, lang.menuEditor_file_todo_undo, lang.menuEditor_file_button_1_del, lang.menuEditor_file_button_1_gui_icon], 0); // 5
            } else {
                editorForm.addStepSlider(lang.menuEditor_file_todo, [lang.menuEditor_file_todo_save, lang.menuEditor_file_todo_undo, lang.menuEditor_file_button_1_del], 0); // 5
            }

            // 6 
            // 位置调换
            // 判断这个按钮的位置
            if (mIndex == 0) {
                /* 第一个按钮 */
                editorForm.addStepSlider(
                lang.menuEditor_file_move, [
                lang.menuEditor_file_move_0,
                lang.menuEditor_file_move_1],
                0);
            } else if ((file["buttons"].length - 1) == mIndex) {
                /* 最后一个按钮 */
                editorForm.addStepSlider(
                lang.menuEditor_file_move, [
                lang.menuEditor_file_move_c1,
                lang.menuEditor_file_move_0],
                1);
            } else {
                /* 中间的按钮 */
                editorForm.addStepSlider(
                lang.menuEditor_file_move, [
                lang.menuEditor_file_move_c1,
                lang.menuEditor_file_move_0,
                lang.menuEditor_file_move_1],
                1);
            }

            // array_move

            // 发送表单
            player.sendForm(editorForm, function(player, data) {
                // 位置移动
                if (mIndex == 0) {
                    /* 第一个按钮 */
                    if (data[6] == 0) {
                        // 不动
                    } else if (data[6] == 1) {
                        // 往后
                        array_move(file["buttons"], mIndex, 1);
                        mIndex = mIndex + 1;
                    }
                } else if ((file["buttons"].length - 1) == mIndex) {
                    /* 最后一个按钮 */
                    if (data[6] == 0) {
                        // 往前
                        array_move(file["buttons"], mIndex, -1);
                        mIndex = mIndex - 1;
                    } else if (data[6] == 1) {
                        // 不动
                    }
                } else {
                    /* 中间的按钮 */
                    if (data[6] == 0) {
                        // 往前
                        array_move(file["buttons"], mIndex, -1);
                        mIndex = mIndex - 1;
                    } else if (data[6] == 1) {
                        // 不动
                    } else if (data[6] == 2) {
                        // 往后
                        array_move(file["buttons"], mIndex, 1);
                        mIndex = mIndex + 1;
                    }
                }

                // 修改
                if (data[5] == 0) {
                    file["buttons"][mIndex]["title"] = data[0];
                    file["buttons"][mIndex]["image"] = data[1];
                    file["buttons"][mIndex]["onClick"]["type"] = menuEditor_file_onClick_inttostr(data[2]);
                    if (lang.menuEditor_cannot == data[3]) {
                        // 
                    } else if (data[3].substring(0, 5) == "arr \"") {
                        let mArray = "[" + data[3].slice(4) + "]";
                        mArray = ll.eval(mArray);
                        file["buttons"][mIndex]["onClick"]["run"] = mArray;
                    } else {
                        file["buttons"][mIndex]["onClick"]["run"] = data[3];
                    }


                    // 写入文件
                    File.writeTo(path, JSON.stringify(file, null, 4));

                    menuEditor_file_button(player, path);
                } else if (data[5] == 1) {
                    // not do anything

                    menuEditor_file_button(player, path);
                } else if (data[5] == 2) {
                    file["buttons"].splice(mIndex, 1);
                    File.writeTo(path, JSON.stringify(file, null, 4));

                    menuEditor_file_button(player, path);
                } else if (data[5] == 3) {
                    /* GUI修改按钮图标 */
                    selectIcon(player, 1, function(result) {
                        if (result != null) {
                            file["buttons"][mIndex]["image"] = result;
                            File.writeTo(path, JSON.stringify(file, null, 4));
                        }

                        menuEditor_file_button(player, path);
                    });
                }

            });
        }
    });
}

/* 表单编辑器_表单文件_diy表单
 * @param player player
 * @param string path
 */
function menuEditor_file_diy(player, path) {
    path = path.replaceAll("/", "\\");
    // let path = ".\\plugins\\TiMENU\\abc.json";
    let pathArr = path.split("\\");

    // 上一层文件夹
    let pathArrPop = pathArr.concat();
    pathArrPop.pop();
    let lastPath = pathArrPop.join("\\");

    // 文件名
    let fileName = pathArr[pathArr.length - 1];

    let file = File.readFrom(path);
    // 将文件内容解析为json
    file = JSON.parse(file);

    let mForm = mc.newSimpleForm();
    mForm.setTitle(fileName);
    // 修改 diy 收集表单
    mForm.setContent(lang.menuEditor_file_diy_content);
    // 修改表单基础信息
    mForm.addButton(lang.menuEditor_file_form_editor);

    for (var i = 0; i < file.items.length; i++) {
        /* 遍历控件列表 */
        let items = file.items[i];
        if (items.type == "label") {
            mForm.addButton(items.content, "textures/ui/sign");
        } else if (items.type == "input") {
            mForm.addButton(items.title, "textures/ui/book_frame");
        } else if (items.type == "switch") {
            if (items["default"] == true) {
                mForm.addButton(items.title, "textures/ui/toggle_on");
            } else {
                mForm.addButton(items.title, "textures/ui/toggle_off");
            }
        } else if (items.type == "dropdown") {
            mForm.addButton(items.title, "textures/ui/elipses");
        } else if (items.type == "slider") {
            mForm.addButton(items.title, "textures/ui/experiencenub");
        } else if (items.type == "stepSlider") {
            mForm.addButton(items.title, "textures/ui/experiencebarempty");
        } else if (items.type == "player_dropdown") {
            mForm.addButton(items.title, "textures/ui/FriendsIcon");
        } else {
            /* 匹配不到任何一个类型 */
            mForm.addButton("", "textures/ui/ErrorGlyph");
        }
    }

    // 添加一个表单控件
    mForm.addButton(lang.menuEditor_file_diy_add);

    // 发送表单
    player.sendForm(mForm, function(player, id) {
        if (id == null) {
            /* 玩家关闭表单 */
            menuEditor_folder(player, lastPath);
        } else if (id == 0) {
            /* 修改表单基础信息 */
            let editorForm = mc.newCustomForm();
            editorForm.setTitle(fileName);

            // 修改 diy 收集表单基础信息
            editorForm.addLabel(lang.menuEditor_file_diy_0_content);

            editorForm.addLabel("");
            if (file.op == "false") {
                editorForm.addSwitch(lang.menuEditor_file_needop, false); // 2
            } else if (file.op == "true") {
                editorForm.addSwitch(lang.menuEditor_file_needop, true); // 2
            }

            editorForm.addInput(lang.menuEditor_file_form_title, file.title, file.title); // 3
            // editorForm.addInput(lang.menuEditor_file_form_content, file.content, file.content); // 4

            editorForm.addLabel("");
            // “提交”按钮
            editorForm.addLabel(lang.menuEditor_file_diy_btn1);
            // 点击事件类型
            editorForm.addDropdown(lang.menuEditor_file_onclick_type, [
            lang.menuEditor_file_onclick_1type,
            lang.menuEditor_file_onclick_2type,
            lang.menuEditor_file_onclick_3type,
            lang.menuEditor_file_onclick_4type,
            lang.menuEditor_file_onclick_5type,
            lang.menuEditor_file_onclick_6type,
            lang.menuEditor_file_onclick_7type,
            lang.menuEditor_file_onclick_8type], menuEditor_file_onClick_strtoint(file.send.type)); // 6
            // 点击事件内容
            // editorForm.addInput(lang.menuEditor_file_onclick_run, file.send.run, file.send.run); // 7
            if (typeof(file.send.run) == "string") {
                /* 字符串单条命令 */
                editorForm.addInput(lang.menuEditor_file_onclick_run, file.send.run, file.send.run); // 7
            } else if (Array.isArray(file.send.run)) {
                /* 数组多条命令 */

                let mRun = file.send.run;
                let mRunToString = "";
                mRun.forEach(item => {
                    if (typeof(item) == "string") {
                        mRunToString += ", \"" + item + "\"";
                    } else {
                        mRunToString += ", " + item.toString();
                    }
                });
                mRunToString = "arr " + mRunToString.slice(2) + "";

                editorForm.addInput(lang.menuEditor_file_onclick_run, mRunToString, mRunToString); // 7
            } else {
                /* 不支持编辑的类型 */
                editorForm.addInput(lang.menuEditor_file_onclick_run, lang.menuEditor_cannot, lang.menuEditor_cannot); // 7
            }

            editorForm.addLabel("");
            // 关闭表单按钮
            editorForm.addLabel(lang.menuEditor_file_close_btn);
            // 点击事件类型
            editorForm.addDropdown(lang.menuEditor_file_onclick_type, [
            lang.menuEditor_file_onclick_1type,
            lang.menuEditor_file_onclick_2type,
            lang.menuEditor_file_onclick_3type,
            lang.menuEditor_file_onclick_4type,
            lang.menuEditor_file_onclick_5type,
            lang.menuEditor_file_onclick_6type,
            lang.menuEditor_file_onclick_7type,
            lang.menuEditor_file_onclick_8type], menuEditor_file_onClick_strtoint(file.exit.type)); // 10
            // 点击事件内容
            // editorForm.addInput(lang.menuEditor_file_onclick_run, file.exit.run, file.exit.run); // 11
            if (typeof(file.exit.run) == "string") {
                /* 字符串单条命令 */
                editorForm.addInput(lang.menuEditor_file_onclick_run, file.exit.run, file.exit.run); // 11
            } else if (Array.isArray(file.exit.run)) {
                /* 数组多条命令 */

                let mRun = file.exit.run;
                let mRunToString = "";
                mRun.forEach(item => {
                    if (typeof(item) == "string") {
                        mRunToString += ", \"" + item + "\"";
                    } else {
                        mRunToString += ", " + item.toString();
                    }
                });
                mRunToString = "arr " + mRunToString.slice(2) + "";

                editorForm.addInput(lang.menuEditor_file_onclick_run, mRunToString, mRunToString); // 11
            } else {
                /* 不支持编辑的类型 */
                editorForm.addInput(lang.menuEditor_file_onclick_run, lang.menuEditor_cannot, lang.menuEditor_cannot); // 11
            }


            editorForm.addLabel("");
            editorForm.addInput(lang.menuEditor_file_rename, fileName, fileName); // 13

            editorForm.addLabel("");
            editorForm.addStepSlider(lang.menuEditor_file_todo, [lang.menuEditor_file_todo_save, lang.menuEditor_file_todo_undo, lang.menuEditor_file_todo_del], 0); // 15

            // 发送表单
            player.sendForm(editorForm, function(player, data) {
                // 修改
                if (data[15] == 0) {
                    file.op = data[2] == true ? "true" : "false";
                    file.title = data[3];
                    // file.content = data[4];

                    file.send.type = menuEditor_file_onClick_inttostr(data[6]);
                    // file.send.run = data[7];
                    if (lang.menuEditor_cannot == data[7]) {
                        // 
                    } else if (data[7].substring(0, 5) == "arr \"") {
                        let mArray = "[" + data[7].slice(4) + "]";
                        mArray = ll.eval(mArray);
                        file.send.run = mArray;
                    } else {
                        file.send.run = data[7];
                    }

                    file.exit.type = menuEditor_file_onClick_inttostr(data[10]);
                    // file.exit.run = data[11];
                    if (lang.menuEditor_cannot == data[11]) {
                        // 
                    } else if (data[11].substring(0, 5) == "arr \"") {
                        let mArray = "[" + data[11].slice(4) + "]";
                        mArray = ll.eval(mArray);
                        file.exit.run = mArray;
                    } else {
                        file.exit.run = data[11];
                    }

                    // 写入文件
                    File.writeTo(path, JSON.stringify(file, null, 4));

                    if (data[13] != fileName) {
                        File.rename(path, lastPath + "\\" + data[13]);
                        path = lastPath + "\\" + data[13];
                    }
                } else if (data[15] == 1) {
                    // not do anything
                } else if (data[15] == 2) {
                    File.delete(path);
                }

                menuEditor_file_diy(player, path);

            });
        } else if (id == file.items.length + 1) {
            /* 添加一个控件 */
            let newIndex = file.items.length;

            let newItemForm = mc.newSimpleForm();
            newItemForm.setTitle(fileName);
            // 添加一个表单控件
            newItemForm.setContent(lang.menuEditor_file_diy_1_content);

            newItemForm.addButton(lang.menuEditor_file_diy_1item, "textures/ui/sign");
            newItemForm.addButton(lang.menuEditor_file_diy_2item, "textures/ui/book_frame");
            newItemForm.addButton(lang.menuEditor_file_diy_3item, "textures/ui/toggle_off");
            newItemForm.addButton(lang.menuEditor_file_diy_4item, "textures/ui/elipses");
            newItemForm.addButton(lang.menuEditor_file_diy_5item, "textures/ui/experiencenub");
            newItemForm.addButton(lang.menuEditor_file_diy_6item, "textures/ui/experiencebarempty");
            newItemForm.addButton(lang.menuEditor_file_diy_7item, "textures/ui/FriendsIcon");

            // 发送表单
            player.sendForm(newItemForm, function(player, id) {
                if (id == 0) {
                    /* 文本 */
                    file.items.push({
                        "type": "label",
                        "content": "(new) 新增文本 " + newIndex,
                        "assign": "${label" + newIndex + "}"
                    });
                } else if (id == 1) {
                    /* 输入框 */
                    file.items.push({
                        "type": "input",
                        "title": "(new) 新增输入框 " + newIndex,
                        "placeholder": "",
                        "default": "",
                        "assign": "${input" + newIndex + "}"
                    });
                } else if (id == 2) {
                    /* 开关 */
                    file.items.push({
                        "type": "switch",
                        "title": "(new) 新增开关 " + newIndex,
                        "default": false,
                        "assign": "${switch" + newIndex + "}"
                    });
                } else if (id == 3) {
                    /* 下拉菜单 */
                    file.items.push({
                        "type": "dropdown",
                        "title": "(new) 新增下拉菜单 " + newIndex,
                        "show": [],
                        "items": [],
                        "default": 0,
                        "assign": "${dropdown" + newIndex + "}"
                    });
                } else if (id == 4) {
                    /* 游标滑块 */
                    file.items.push({
                        "type": "slider",
                        "title": "(new) 新增游标滑块 " + newIndex,
                        "min": 0,
                        "max": 10,
                        "step": 1,
                        "default": 0,
                        "assign": "${slider" + newIndex + "}"
                    });
                } else if (id == 5) {
                    /* 步进滑块 */
                    file.items.push({
                        "type": "stepSlider",
                        "title": "(new) 新增步进滑块 " + newIndex,
                        "show": [],
                        "items": [],
                        "default": 0,
                        "assign": "${stepSlider" + newIndex + "}"
                    });
                } else if (id == 6) {
                    /* 在线玩家列表 - 下拉菜单 */
                    file.items.push({
                        "type": "player_dropdown",
                        "title": "(new) 新增在线玩家列表 " + newIndex,
                        "assign": "${player_dropdown" + newIndex + "}"
                    });
                }

                // 写入文件
                File.writeTo(path, JSON.stringify(file, null, 4));
                menuEditor_file_diy(player, path);
            });
        } else {
            /* 修改控件 */
            let mIndex = id - 1;

            let editorForm = mc.newCustomForm();
            if (file["items"][mIndex]["type"] == "label") {
                /* label */
                editorForm.setTitle(asVar(lang.menuEditor_file_diy_editor_title, [lang.menuEditor_file_diy_1item]));
                editorForm.addInput(lang.menuEditor_file_diy_label_content, file["items"][mIndex]["content"], file["items"][mIndex]["content"]); // 0
                editorForm.addInput(lang.menuEditor_file_diy_item_assign, file["items"][mIndex]["assign"], file["items"][mIndex]["assign"]); // 1

                editorForm.addLabel("");
                editorForm.addStepSlider(lang.menuEditor_file_todo, [lang.menuEditor_file_todo_save, lang.menuEditor_file_todo_undo, lang.menuEditor_file_diy_todo_del], 0); // 3
                // 发送表单
                player.sendForm(editorForm, function(player, data) {
                    if (data[3] == 0) {
                        file["items"][mIndex]["content"] = data[0];
                        file["items"][mIndex]["assign"] = data[1];

                        // 写入文件
                        File.writeTo(path, JSON.stringify(file, null, 4));
                    } else if (data[3] == 1) {
                        // not do anything
                    } else if (data[3] == 2) {
                        file["items"].splice(mIndex, 1);
                        File.writeTo(path, JSON.stringify(file, null, 4));
                    }

                    menuEditor_file_diy(player, path);
                });
            } else if (file["items"][mIndex]["type"] == "input") {
                /* input */
                editorForm.setTitle(asVar(lang.menuEditor_file_diy_editor_title, [lang.menuEditor_file_diy_2item]));
                editorForm.addInput(lang.menuEditor_file_diy_item_title, file["items"][mIndex]["title"], file["items"][mIndex]["title"]); // 0
                editorForm.addInput(lang.menuEditor_file_diy_1input, file["items"][mIndex]["placeholder"], file["items"][mIndex]["placeholder"]); // 1
                editorForm.addInput(lang.menuEditor_file_diy_2input, file["items"][mIndex]["default"], file["items"][mIndex]["default"]); // 2
                editorForm.addInput(lang.menuEditor_file_diy_item_assign, file["items"][mIndex]["assign"], file["items"][mIndex]["assign"]); // 3

                editorForm.addLabel("");
                editorForm.addStepSlider(lang.menuEditor_file_todo, [lang.menuEditor_file_todo_save, lang.menuEditor_file_todo_undo, lang.menuEditor_file_diy_todo_del], 0); // 5
                // 发送表单
                player.sendForm(editorForm, function(player, data) {
                    if (data[5] == 0) {
                        file["items"][mIndex]["title"] = data[0];
                        file["items"][mIndex]["placeholder"] = data[1];
                        file["items"][mIndex]["default"] = data[2];
                        file["items"][mIndex]["assign"] = data[3];

                        // 写入文件
                        File.writeTo(path, JSON.stringify(file, null, 4));
                    } else if (data[5] == 1) {
                        // not do anything
                    } else if (data[5] == 2) {
                        file["items"].splice(mIndex, 1);
                        File.writeTo(path, JSON.stringify(file, null, 4));
                    }

                    menuEditor_file_diy(player, path);
                });
            } else if (file["items"][mIndex]["type"] == "switch") {
                /* switch */
                editorForm.setTitle(asVar(lang.menuEditor_file_diy_editor_title, [lang.menuEditor_file_diy_3item]));
                editorForm.addInput(lang.menuEditor_file_diy_item_title, file["items"][mIndex]["title"], file["items"][mIndex]["title"]); // 0
                editorForm.addSwitch(lang.menuEditor_file_diy_switch, file["items"][mIndex]["default"]); // 1
                editorForm.addInput(lang.menuEditor_file_diy_item_assign, file["items"][mIndex]["assign"], file["items"][mIndex]["assign"]); // 2

                editorForm.addLabel("");
                editorForm.addStepSlider(lang.menuEditor_file_todo, [lang.menuEditor_file_todo_save, lang.menuEditor_file_todo_undo, lang.menuEditor_file_diy_todo_del], 0); // 4
                // 发送表单
                player.sendForm(editorForm, function(player, data) {
                    if (data[4] == 0) {
                        file["items"][mIndex]["title"] = data[0];
                        file["items"][mIndex]["default"] = data[1];
                        file["items"][mIndex]["assign"] = data[2];

                        // 写入文件
                        File.writeTo(path, JSON.stringify(file, null, 4));
                    } else if (data[4] == 1) {
                        // not do anything
                    } else if (data[4] == 2) {
                        file["items"].splice(mIndex, 1);
                        File.writeTo(path, JSON.stringify(file, null, 4));
                    }

                    menuEditor_file_diy(player, path);
                });
            } else if (file["items"][mIndex]["type"] == "dropdown") {
                /* dropdown */
                editorForm.setTitle(asVar(lang.menuEditor_file_diy_editor_title, [lang.menuEditor_file_diy_4item]));
                editorForm.addInput(lang.menuEditor_file_diy_item_title, file["items"][mIndex]["title"], file["items"][mIndex]["title"]); // 0
                editorForm.addInput(lang.menuEditor_file_diy_46_show, file["items"][mIndex]["show"].join(","), file["items"][mIndex]["show"].join(",")); // 1
                editorForm.addInput(lang.menuEditor_file_diy_46_items, file["items"][mIndex]["items"].join(","), file["items"][mIndex]["items"].join(",")); // 2
                editorForm.addInput(lang.menuEditor_file_diy_46_default, file["items"][mIndex]["default"].toString(), file["items"][mIndex]["default"].toString()); // 3
                editorForm.addInput(lang.menuEditor_file_diy_item_assign, file["items"][mIndex]["assign"], file["items"][mIndex]["assign"]); // 4

                editorForm.addLabel("");
                editorForm.addStepSlider(lang.menuEditor_file_todo, [lang.menuEditor_file_todo_save, lang.menuEditor_file_todo_undo, lang.menuEditor_file_diy_todo_del], 0); // 6
                // 发送表单
                player.sendForm(editorForm, function(player, data) {
                    if (data[6] == 0) {
                        file["items"][mIndex]["title"] = data[0];

                        file["items"][mIndex]["show"] = data[1] == "" ? [] : data[1].split(",");
                        // file["items"][mIndex]["show"] = data[1].split(",");
                        file["items"][mIndex]["items"] = data[2] == "" ? [] : data[2].split(",");
                        // file["items"][mIndex]["items"] = data[2].split(",");
                        file["items"][mIndex]["default"] = Number(data[3]);
                        file["items"][mIndex]["assign"] = data[4];

                        // 写入文件
                        File.writeTo(path, JSON.stringify(file, null, 4));
                    } else if (data[6] == 1) {
                        // not do anything
                    } else if (data[6] == 2) {
                        file["items"].splice(mIndex, 1);
                        File.writeTo(path, JSON.stringify(file, null, 4));
                    }

                    menuEditor_file_diy(player, path);
                });
            } else if (file["items"][mIndex]["type"] == "slider") {
                /* slider */
                editorForm.setTitle(asVar(lang.menuEditor_file_diy_editor_title, [lang.menuEditor_file_diy_5item]));
                editorForm.addInput(lang.menuEditor_file_diy_item_title, file["items"][mIndex]["title"], file["items"][mIndex]["title"]); // 0
                editorForm.addInput(lang.menuEditor_file_diy_slider_min, file["items"][mIndex]["min"].toString(), file["items"][mIndex]["min"].toString()); // 1
                editorForm.addInput(lang.menuEditor_file_diy_slider_max, file["items"][mIndex]["max"].toString(), file["items"][mIndex]["max"].toString()); // 2
                editorForm.addInput(lang.menuEditor_file_diy_slider_step, file["items"][mIndex]["step"].toString(), file["items"][mIndex]["step"].toString()); // 3
                editorForm.addInput(lang.menuEditor_file_diy_slider_default, file["items"][mIndex]["default"].toString(), file["items"][mIndex]["default"].toString()); // 4
                editorForm.addInput(lang.menuEditor_file_diy_item_assign, file["items"][mIndex]["assign"], file["items"][mIndex]["assign"]); // 5

                editorForm.addLabel("");
                editorForm.addStepSlider(lang.menuEditor_file_todo, [lang.menuEditor_file_todo_save, lang.menuEditor_file_todo_undo, lang.menuEditor_file_diy_todo_del], 0); // 7
                // 发送表单
                player.sendForm(editorForm, function(player, data) {
                    if (data[7] == 0) {
                        file["items"][mIndex]["title"] = data[0];
                        file["items"][mIndex]["min"] = Number(data[1]);
                        file["items"][mIndex]["max"] = Number(data[2]);
                        file["items"][mIndex]["step"] = Number(data[3]);
                        file["items"][mIndex]["default"] = Number(data[4]);
                        file["items"][mIndex]["assign"] = data[5];

                        // 写入文件
                        File.writeTo(path, JSON.stringify(file, null, 4));
                    } else if (data[7] == 1) {
                        // not do anything
                    } else if (data[7] == 2) {
                        file["items"].splice(mIndex, 1);
                        File.writeTo(path, JSON.stringify(file, null, 4));
                    }

                    menuEditor_file_diy(player, path);
                });
            } else if (file["items"][mIndex]["type"] == "stepSlider") {
                /* stepSlider */
                editorForm.setTitle(asVar(lang.menuEditor_file_diy_editor_title, [lang.menuEditor_file_diy_6item]));
                editorForm.addInput(lang.menuEditor_file_diy_item_title, file["items"][mIndex]["title"], file["items"][mIndex]["title"]); // 0
                editorForm.addInput(lang.menuEditor_file_diy_46_show, file["items"][mIndex]["show"].join(","), file["items"][mIndex]["show"].join(",")); // 1
                editorForm.addInput(lang.menuEditor_file_diy_46_items, file["items"][mIndex]["items"].join(","), file["items"][mIndex]["items"].join(",")); // 2
                editorForm.addInput(lang.menuEditor_file_diy_46_default, file["items"][mIndex]["default"].toString(), file["items"][mIndex]["default"].toString()); // 3
                editorForm.addInput(lang.menuEditor_file_diy_item_assign, file["items"][mIndex]["assign"], file["items"][mIndex]["assign"]); // 4

                editorForm.addLabel("");
                editorForm.addStepSlider(lang.menuEditor_file_todo, [lang.menuEditor_file_todo_save, lang.menuEditor_file_todo_undo, lang.menuEditor_file_diy_todo_del], 0); // 6
                // 发送表单
                player.sendForm(editorForm, function(player, data) {
                    if (data[6] == 0) {
                        file["items"][mIndex]["title"] = data[0];

                        file["items"][mIndex]["show"] = data[1] == "" ? [] : data[1].split(",");
                        // file["items"][mIndex]["show"] = data[1].split(",");
                        file["items"][mIndex]["items"] = data[2] == "" ? [] : data[2].split(",");
                        // file["items"][mIndex]["items"] = data[2].split(",");
                        file["items"][mIndex]["default"] = Number(data[3]);
                        file["items"][mIndex]["assign"] = data[4];

                        // 写入文件
                        File.writeTo(path, JSON.stringify(file, null, 4));
                    } else if (data[6] == 1) {
                        // not do anything
                    } else if (data[6] == 2) {
                        file["items"].splice(mIndex, 1);
                        File.writeTo(path, JSON.stringify(file, null, 4));
                    }

                    menuEditor_file_diy(player, path);
                });
            } else if (file["items"][mIndex]["type"] == "player_dropdown") {
                /* player_dropdown */
                editorForm.setTitle(asVar(lang.menuEditor_file_diy_editor_title, [lang.menuEditor_file_diy_7item]));
                editorForm.addInput(lang.menuEditor_file_diy_item_title, file["items"][mIndex]["title"], file["items"][mIndex]["title"]); // 0
                editorForm.addInput(lang.menuEditor_file_diy_item_assign, file["items"][mIndex]["assign"], file["items"][mIndex]["assign"]); // 1

                editorForm.addLabel("");
                editorForm.addStepSlider(lang.menuEditor_file_todo, [lang.menuEditor_file_todo_save, lang.menuEditor_file_todo_undo, lang.menuEditor_file_diy_todo_del], 0); // 3
                // 发送表单
                player.sendForm(editorForm, function(player, data) {
                    if (data[3] == 0) {
                        file["items"][mIndex]["title"] = data[0];
                        file["items"][mIndex]["assign"] = data[1];

                        // 写入文件
                        File.writeTo(path, JSON.stringify(file, null, 4));
                    } else if (data[3] == 1) {
                        // not do anything
                    } else if (data[3] == 2) {
                        file["items"].splice(mIndex, 1);
                        File.writeTo(path, JSON.stringify(file, null, 4));
                    }

                    menuEditor_file_diy(player, path);
                });
            } else {
                /* 匹配不到任何一个类型 */
                menuEditor_file_diy(player, path);
            }
        }
    });
}


/* onClick专用
 * @param string str
 * @return int
 */
function menuEditor_file_onClick_strtoint(str) {
    if (str == "") {
        /* 关闭点击事件 */
        return 0;
    } else if (str == "cmd") {
        /* 执行后台命令 */
        return 1;
    } else if (str == "OP_cmd") {
        /* 执行后台命令 (需要管理员权限) */
        return 2;
    } else if (str == "playerCmd") {
        /* 玩家执行命令 */
        return 3;
    } else if (str == "OP_playerCmd") {
        /* 玩家执行命令 (需要管理员权限) */
        return 4;
    } else if (str == "form") {
        /* 打开表单 */
        return 5;
    } else if (str == "eval") {
        /* 执行JavaScript */
        return 6;
    } else if (str == "OP_eval") {
        /* 执行JavaScript (需要管理员权限) */
        return 7;
    }
}

/* onClick专用
 * @param int int
 * @return string
 */
function menuEditor_file_onClick_inttostr(int) {
    if (int == 0) {
        /* 关闭点击事件 */
        return "";
    } else if (int == 1) {
        /* 执行后台命令 */
        return "cmd";
    } else if (int == 2) {
        /* 执行后台命令 (需要管理员权限) */
        return "OP_cmd";
    } else if (int == 3) {
        /* 玩家执行命令 */
        return "playerCmd";
    } else if (int == 4) {
        /* 玩家执行命令 (需要管理员权限) */
        return "OP_playerCmd";
    } else if (int == 5) {
        /* 打开表单 */
        return "form";
    } else if (int == 6) {
        /* 执行JavaScript */
        return "eval";
    } else if (int == 7) {
        /* 执行JavaScript (需要管理员权限) */
        return "OP_eval";
    }
}





/* 导入其他菜单文件
 * @param player player
 */
function another2mine(player) {
    /*
    §l§a#§eTips§r§6: 由于插件之间的菜单逻辑不同, 部分其他插件的菜单文件无法完美转换成TiMENU表单文件, 但我们会尽力还原您在其他插件上的体验!\n
    \n
    §l§a#§e支持转换的插件及介绍§r§6: \n
    §l§3  * CMENU:§r\n
    §bCMENU的菜单文件将会被转换成button按钮表单
    */
    
    showFormID(player, {
        type: "button",
        op: false,
        title: lang.another2mine_title, // 导入其他菜单文件
        content: lang.another2mine_content, // 看前面大注释
        buttons: [{
            title: "§e> §l§6一键转化§r§e <",
            image: "textures/ui/icon_iron_pickaxe",
            onClick: {
                type: "function",
                run: async function(player, mVar) {
                    await cmenu2timenu(player);
                }
            }
        }],
        exit: {
            type: "playerCmd",
            run: "menu set"
        }
    }, null, {});
}

/* await 导入表单 - CMENU
 * @param player player
 */
function cmenu2timenu(player) {
    return new Promise(function(resolve, reject) {
        let filesList = File.getFilesList('.\\plugins\\CMENU');
        if (File.exists('.\\plugins\\CMENU') == false || filesList.length == 0) {
            resolve(false);
        }

        // 最后执行的函数
        let endFun = function() {
            player.tell("§5/----- §dCMENU End§5 -----/");
            mc.runcmdEx("title " + player.name + " title §l§asuccess");
            mc.runcmdEx("title " + player.name + " subtitle §6CMENU §g-> §l§eTiMENU");
            resolve(true);
        }
        let endTimer;

        // 内部函数
        let mFun = {
            // 遍历这层文件夹
            list: function(path) {
                // 通知玩家
                player.tell("§d" + path + "...");
                mFun.notEnd();

                // 读取这层文件列表
                filesList = File.getFilesList(path);
                let mPath;
                // 遍历这层文件列表
                filesList.forEach(function(item, index, self) {
                    mPath = path + "\\" + item;
                    // 判断类型
                    if (File.checkIsDir(mPath)) {
                        /* 文件夹 */
                        // 递归
                        mFun.list(mPath);
                    } else {
                        /* 文件 */
                        // 交给下个函数
                        mFun.to(mPath);
                    }
                });
            },
            // 将文件转化
            to: function(path) {
                // 通知玩家
                player.tell("§d" + path + "...");
                mFun.notEnd();
                
                
            },
            // 还没有结束!
            notEnd: function() {
                clearInterval(endTimer);
                endTimer = setTimeout(function (){
                    endFun();
                }, 50);
            }
        };

        // start
        player.tell("§5/----- §dCMENU Start§5 -----/");
        mFun.list('.\\plugins\\CMENU');
        mFun.notEnd();
    })
}





/* ====工具函数start==== */

/* 快速编辑扩展包 - 选择icon
 * @param player player
 * @param int page
 * @param function callback(result)
 */
function selectIcon(player, page, callback) {
    // 一页可以最多显示多少个
    let maxShow = 12;

    let mForm = mc.newSimpleForm();
    // 图标选择器
    mForm.setTitle(lang.select_icon_title);
    // 请选择材质包图标
    mForm.setContent(lang.select_icon_content);

    // 读取扩展包
    let file = File.readFrom('.\\plugins\\TiMENU\\vanilla.json');
    if (file == null) {
        /* 文件内容为null */
        player.tell(lang.msg_head_err + asVar(lang.file_not_found, ['.\\plugins\\TiMENU\\vanilla']), 0);
        logger.error(asVar(lang.file_not_found, ['.\\plugins\\TiMENU\\vanilla']));

        // 返回null
        callback(null);
    } else {
        // 将文件内容解析为json
        file = JSON.parse(file);
        let icons = file.enums.icon;
        let mIcons = [];

        let maxPage = Math.ceil(icons.length / maxShow);
        let lastPage = page - 1;
        let nextPage = page + 1;
        let min = maxShow * lastPage;
        let max = maxShow * page;

        if (max > icons.length) {
            max = icons.length;
        }

        if (page == 1) {
            /* 第一页不能上一页 */
            // 前往最后一页
            mForm.addButton(asVar(lang.page_next, [maxPage + ""]));
        } else {
            // 返回上一页
            mForm.addButton(asVar(lang.page_last, [lastPage + ""]));
        }

        let endBtnId = 1;

        for (let i = min; i <= max; i++) {
            endBtnId++;
            mIcons[mIcons.length] = icons[i];
            mForm.addButton(icons[i], icons[i]);
        }

        if (page == maxPage) {
            /* 没有下一页了 */
            // 返回第一页
            mForm.addButton(asVar(lang.page_last, ["1"]));
        } else {
            // 前往下一页
            mForm.addButton(asVar(lang.page_next, [nextPage + ""]));
        }

        // 发送表单
        player.sendForm(mForm, function(player, id) {
            if (id == null) {
                /* 玩家取消了表单 */
                // 返回null
                callback(null);
            } else if (id == 0) {
                /* 第一个按钮 */
                if (page == 1) {
                    // 前往最后一页
                    selectIcon(player, maxPage, callback);
                } else {
                    // 返回上一页
                    selectIcon(player, lastPage, callback);
                }
            } else if (id == endBtnId) {
                /* 最后一个按钮 */
                if (page == maxPage) {
                    // 返回第一页
                    selectIcon(player, 1, callback);
                } else {
                    // 前往下一页
                    selectIcon(player, nextPage, callback);
                }
            } else {
                callback(mIcons[id - 1]);
            }
        });
    }
}

/* 快速编辑扩展包 - 选择物品(minecraft)
 * @param player player
 * @param int page
 * @param function callback(result)
 */
function selectItem(player, page, callback) {
    // 一页可以最多显示多少个
    let maxShow = 12;

    let mForm = mc.newSimpleForm();
    // 图标选择器
    mForm.setTitle(lang.select_item_title);
    // 请选择材质包图标
    mForm.setContent(lang.select_item_content);

    // 读取扩展包
    let file = File.readFrom('.\\plugins\\TiMENU\\vanilla.json');
    if (file == null) {
        /* 文件内容为null */
        player.tell(lang.msg_head_err + asVar(lang.file_not_found, ['.\\plugins\\TiMENU\\vanilla']), 0);
        logger.error(asVar(lang.file_not_found, ['.\\plugins\\TiMENU\\vanilla']));

        // 返回null
        callback(null);
    } else {
        // 将文件内容解析为json
        file = JSON.parse(file);
        let itemsJson = file.enums.item;
        let itemId = [];
        let itemName = [];
        let mItemId = [];
        // let mItemName = [];

        let key;
        for (key in itemsJson) {
            itemId[itemId.length] = key;
            itemName[itemName.length] = itemsJson[key];
        }

        //

        let maxPage = Math.ceil(itemId.length / maxShow);
        let lastPage = page - 1;
        let nextPage = page + 1;
        let min = maxShow * lastPage;
        let max = maxShow * page;

        if (max > itemId.length) {
            max = itemId.length;
        }

        if (page == 1) {
            /* 第一页不能上一页 */
            // 前往最后一页
            mForm.addButton(asVar(lang.page_next, [maxPage + ""]));
        } else {
            // 返回上一页
            mForm.addButton(asVar(lang.page_last, [lastPage + ""]));
        }

        let endBtnId = 1;

        for (let i = min; i <= max; i++) {
            endBtnId++;
            mItemId[mItemId.length] = itemId[i];
            mForm.addButton(itemName[i]);
        }

        if (page == maxPage) {
            /* 没有下一页了 */
            // 返回第一页
            mForm.addButton(asVar(lang.page_last, ["1"]));
        } else {
            // 前往下一页
            mForm.addButton(asVar(lang.page_next, [nextPage + ""]));
        }

        // 发送表单
        player.sendForm(mForm, function(player, id) {
            if (id == null) {
                /* 玩家取消了表单 */
                // 返回null
                callback(null);
            } else if (id == 0) {
                /* 第一个按钮 */
                if (page == 1) {
                    // 前往最后一页
                    selectItem(player, maxPage, callback);
                } else {
                    // 返回上一页
                    selectItem(player, lastPage, callback);
                }
            } else if (id == endBtnId) {
                /* 最后一个按钮 */
                if (page == maxPage) {
                    // 返回第一页
                    selectItem(player, 1, callback);
                } else {
                    // 前往下一页
                    selectItem(player, nextPage, callback);
                }
            } else {
                callback(mItemId[id - 1]);
            }
        });




    }
}

/* http下载文件到指定路径
 * 不支持二进制文件安全写入
 * @param string url
 * @param string path
 */
function downloadFile(url, path) {
    network.httpGet(url, function(status, result) {
        if (status == 200) {
            /* 成功连接到服务器 */

            // 判断是不是json文件
            if (path.substring(path.length - 5) == ".json") {
                /* 是json文件, 写入文件时进行格式化操作 */
                let jsonFile = JSON.parse(result);
                File.writeTo(path, JSON.stringify(jsonFile, null, 4));
            } else {
                File.writeTo(path, result);
            }
        } else {
            /* 状态码不正常 */
            logger.error(lang.server_http_failed);
            logger.error(url + ' -> ' + status + ' ' + result);
        }
    });
}

/* 解析字符串内变量
 * @param string str
 * @param array arr_to
 * @return string
 */
function asVar(str, arr_to) {
    if (str == null) {
        return "";
    }

    arr_to.forEach(function(item, index, self) {
        str = str.replaceAll('${' + index + '}', item);
    });
    return str;
}

/* 解析json自定义超级变量
 * @param string str
 * @param object mVar
 */
function useMVar(str, mVar) {
    for (key in mVar) {
        str = str.replaceAll("${" + key + "}", mVar[key]);
    }
    return str;
}

/* 超级变量支持
 * @param player player
 * @param string str
 * @param object mVar
 */
function superVar(player, str, mVar) {
    str = str.replaceAll("\\n", "\n");

    if (PAPI != null && str != null && player != null) {
        str = PAPI.translateString(str, player.xuid)
    }

    try {
        // 玩家名
        str = str.replaceAll('${player.name}', player.name);
        // 玩家所在坐标
        str = str.replaceAll('${player.pos.x}', player.pos.x.toString());
        str = str.replaceAll('${player.pos.y}', player.pos.y.toString());
        str = str.replaceAll('${player.pos.z}', player.pos.z.toString());
        str = str.replaceAll('${player.pos.dim}', player.pos.dim);
        str = str.replaceAll('${player.pos.dimid}', player.pos.dimid.toString());
        // 玩家所在的方块坐标
        str = str.replaceAll('${player.blockPos.x}', player.blockPos.x.toString());
        str = str.replaceAll('${player.blockPos.y}', player.blockPos.y.toString());
        str = str.replaceAll('${player.blockPos.z}', player.blockPos.z.toString());
        str = str.replaceAll('${player.blockPos.dim}', player.blockPos.dim);
        str = str.replaceAll('${player.blockPos.dimid}', player.blockPos.dimid.toString());

        /*
            # v 1.1.0
            > 删除五个关于 玩家上次死亡的坐标 的超级变量
            add: none
            remove: 
                - ${player.lastDeathPos.x}
                - ${player.lastDeathPos.y}
                - ${player.lastDeathPos.z}
                - ${player.lastDeathPos.dim}
                - ${player.lastDeathPos.dimid}
            revision: none
        */
        // 玩家上次死亡的坐标
        // 离大谱！player.lastDeathPos会报错？？？
        // 只在部分服务器上会, 不清楚原因, 好像是高版本(？
        // 只能忍痛删除了qwq, 超级变量数量 -5
        // 但还是可以通过高级变量获取的！
        // if (player.lastDeathPos != undefined) {
        // str = str.replaceAll('${player.lastDeathPos.x}', player.lastDeathPos.x.toString());
        // str = str.replaceAll('${player.lastDeathPos.y}', player.lastDeathPos.y.toString());
        // str = str.replaceAll('${player.lastDeathPos.z}', player.lastDeathPos.z.toString());
        // str = str.replaceAll('${player.lastDeathPos.dim}', player.lastDeathPos.dim);
        // str = str.replaceAll('${player.lastDeathPos.dimid}', player.lastDeathPos.dimid.toString());
        // }

        // 玩家的真实名字
        str = str.replaceAll('${player.realName}', player.realName);
        // 玩家Xuid字符串
        str = str.replaceAll('${player.xuid}', player.xuid);
        // 玩家Uuid字符串
        str = str.replaceAll('${player.uuid}', player.uuid);
        // 玩家的操作权限等级（0 - 4）
        str = str.replaceAll('${player.permLevel}', player.permLevel.toString());
        // 玩家的游戏模式（0 - 3）
        str = str.replaceAll('${player.gameMode}', player.gameMode.toString());
        // 玩家最大生命值
        str = str.replaceAll('${player.maxHealth}', player.maxHealth.toString());
        // 玩家当前生命值
        str = str.replaceAll('${player.health}', player.health.toString());
        // 玩家当前是否悬空
        str = str.replaceAll('${player.inAir}', player.inAir.toString());
        // 玩家当前是否在水中
        str = str.replaceAll('${player.inWater}', player.inWater.toString());
        // 玩家当前是否正在潜行
        str = str.replaceAll('${player.sneaking}', player.sneaking.toString());
        // 玩家当前速度
        str = str.replaceAll('${player.speed}', player.speed.toString());
        // 玩家当前朝向
        str = str.replaceAll('${player.direction.pitch}', player.direction.pitch.toString());
        str = str.replaceAll('${player.direction.yaw}', player.direction.yaw.toString());
        str = str.replaceAll('${player.direction.toFacing()}', player.direction.toFacing()
            .toString());
        // 玩家（实体的）唯一标识符
        str = str.replaceAll('${player.uniqueId}', player.uniqueId);
        // 玩家设置的语言的标识符(形如zh_CN)
        // str = str.replaceAll('${player.langCode}', player.langCode);
        // 玩家是否正在加载
        if (player.isLoading != undefined) {
            str = str.replaceAll('${player.isLoading}', player.isLoading.toString());
        }

        // 玩家设备信息
        let device = player.getDevice();
        // 玩家设备的IP地址
        str = str.replaceAll('${player.getDevice().ip}', device.ip);
        // 玩家的平均网络延迟时间（ms）
        str = str.replaceAll('${player.getDevice().avgPing}', device.avgPing.toString());
        // 玩家的平均网络丢包率（%）
        str = str.replaceAll('${player.getDevice().avgPacketLoss}', device.avgPacketLoss.toString());
        // 玩家的网络延迟时间（ms）
        if (device.lastPing != undefined) {
            str = str.replaceAll('${player.getDevice().lastPing}', device.lastPing.toString());
        }
        // 玩家的网络丢包率（%）
        if (device.lastPacketLoss != undefined) {
            str = str.replaceAll('${player.getDevice().lastPacketLoss}', device.lastPacketLoss.toString());
        }
        // 玩家设备的操作系统类型
        str = str.replaceAll('${player.getDevice().os}', device.os);
        // 玩家连接的地址
        str = str.replaceAll('${player.getDevice().serverAddress}', device.serverAddress);
        // 玩家客户端的识别码ID
        str = str.replaceAll('${player.getDevice().clientId}', device.clientId);

        // llmoney 获取玩家的存款金额
        // 有些人不用LLMoney qwq
        //str = str.replaceAll('${player.getMoney()}', money.get(player.xuid)
        //    .toString());

        /*
            # v 1.1.2
            > 超级大改版
            > 新增很多变量
            > 每个变量有个简便写法
            add: 
                - ${player.getMoney()}
                - ${mc.getBDSVersion()}
                - ${mc.getServerProtocolVersion()}
                - ${mc.getServerProtocolVersion()}
                - ${system.getTimeStr()}
                - ${system.getTimeObj()} ... x7
                - ${system.randomGuid()}
                - ${Format} ... x23
            remove: none
            revision: none
        */

        // 获取BDS服务端版本号
        str = str.replaceAll('${mc.getBDSVersion()}', mc.getBDSVersion());
        // 获取BDS服务端协议版本
        str = str.replaceAll('${mc.getServerProtocolVersion()}', mc.getServerProtocolVersion()
            .toString());
        // 获取当前时间字符串
        str = str.replaceAll('${system.getTimeStr()}', system.getTimeStr());

        // 获取当前的时间对象
        str = str.replaceAll('${system.getTimeObj().Y}', system.getTimeObj()
            .Y.toString());
        str = str.replaceAll('${system.getTimeObj().M}', system.getTimeObj()
            .M.toString());
        str = str.replaceAll('${system.getTimeObj().D}', system.getTimeObj()
            .D.toString());
        str = str.replaceAll('${system.getTimeObj().h}', system.getTimeObj()
            .h.toString());
        str = str.replaceAll('${system.getTimeObj().m}', system.getTimeObj()
            .m.toString());
        str = str.replaceAll('${system.getTimeObj().s}', system.getTimeObj()
            .s.toString());
        str = str.replaceAll('${system.getTimeObj().ms}', system.getTimeObj()
            .ms.toString());

        // 随机生成一个 GUID 字符串
        str = str.replaceAll('${system.randomGuid()}', system.randomGuid());

        // 格式化代码实用工具
        // 颜色代码
        str = str.replaceAll('${Format.Black}', '§0');
        str = str.replaceAll('${Format.DarkBlue}', '§1');
        str = str.replaceAll('${Format.DarkGreen}', '§2');
        str = str.replaceAll('${Format.DarkAqua}', '§3');
        str = str.replaceAll('${Format.DarkRed}', '§4');
        str = str.replaceAll('${Format.DarkPurple}', '§5');
        str = str.replaceAll('${Format.Gold}', '§6');
        str = str.replaceAll('${Format.Gray}', '§7');
        str = str.replaceAll('${Format.DarkGray}', '§8');
        str = str.replaceAll('${Format.Blue}', '§9');
        str = str.replaceAll('${Format.Green}', '§a');
        str = str.replaceAll('${Format.Aqua}', '§b');
        str = str.replaceAll('${Format.Red}', '§c');
        str = str.replaceAll('${Format.LightPurple}', '§d');
        str = str.replaceAll('${Format.Yellow}', '§e');
        str = str.replaceAll('${Format.White}', '§f');
        str = str.replaceAll('${Format.MinecoinGold}', '§g');
        // 格式代码
        str = str.replaceAll('${Format.Bold}', '§l');
        str = str.replaceAll('${Format.Italics}', '§o');
        str = str.replaceAll('${Format.Underline}', '§n');
        str = str.replaceAll('${Format.StrikeThrough}', '§m');
        str = str.replaceAll('${Format.Random}', '§k');
        str = str.replaceAll('${Format.Clear}', '§r');









        // 简洁语法

    } catch (err) {
        // 这些接口可能以前没什么人用了，没怎么维护，老是获取不到会出问题
    }


    // JavaScript #{...}
    str = str.replaceAll('\\{', '｛');
    str = str.replaceAll('\\}', '｝');

    let addMVar = "";
    for (key in mVar) {
        addMVar = addMVar + "var " + key + " = \"" + mVar[key] + "\";";
    }

    let jsArr = str.match(/#{(?:[^#{\\]|\\.)*}/g);
    let nowJS;
    let nowJsr;
    // let v;
    if (jsArr != null) {
        jsArr.forEach(item => {
            let runItem = item.replaceAll('｛', '{');
            runItem = runItem.replaceAll('｝', '}');

            nowJS = runItem.substring(2, runItem.length - 1);
            nowJsr = ll.eval(addMVar + "var player = mc.getPlayer(\"" + player.xuid + "\");" + nowJS + ";");
            // ll.eval("v = " + nowJS + ";");
            // 判断js输出的是否是字符串
            if (typeof(nowJsr) == "string") {
                str = str.replaceAll(item, nowJsr);
            } else if (nowJsr == null || nowJsr == undefined) {
                str = str.replaceAll(item, "");
            } else {
                // 不是的话，尝试转换成string
                str = str.replaceAll(item, nowJsr.toString());
            }
        });
    }

    str = str.replaceAll('｛', '{');
    str = str.replaceAll('｝', '}');

    return str;
}

/* 执行命令 (type以小驼峰命名法)
 * @param player player
 * @param string type
 * @param string/function send
 * @param object mVar
 */
function runCmd(player, type, send, mVar) {
    // 判断是否需要OP权限执行此命令

    if (type == undefined || type == null || type == "") {
        /* 关闭了点击事件 */
        return false;
    }

    // 隐藏方法
    // 给开发者用的~
    // 只有js能调用
    // 因为json不支持function
    // 示例
    /*
    onClick: {
        type: "function",
        run: function (player, mVar) {
            // doanything
        }
    }
    */
    if (type == "function") {
        send(player, mVar);
        return true;
    }



    if (type.indexOf("OP_") != -1) {
        /* 需要OP权限 */
        if (!player.isOP()) {
            /* 玩家没有OP权限 */
            player.tell(lang.msg_head_warn + lang.permission_denied, 0);
            logger.warn(player.name + " " + lang.permission_denied);
            return false;
        }
    }

    if (Array.isArray(send)) {
        /* 执行内容是数组 */
        send.forEach((item, index, arr) => {
            runCmd(player, type, send[index], mVar);
        });
        return true;
    }

    if (type == "form" && typeof(send) == "object") {
        /* 打开一个json类型的表单 */
        showFormID(player, send, null, mVar);
    }

    // 超级变量支持
    if (type != "eval" && type != "OP_eval") {
        send = superVar(player, send, mVar);
        send = useMVar(send, mVar);
        // send = send.replaceAll('${player.name}', player.name);
        // send = send.replaceAll('${player.realName}', player.realName);
        // send = send.replaceAll('${player.xuid}', player.xuid);
        // send = send.replaceAll('${player.uuid}', player.uuid);
    }

    if (type == "cmd" || type == "OP_cmd") {
        let res = mc.runcmdEx(send);
        logger.info(asVar(lang.cmd_run_info, [player.name, send]));
        if (res.success) {
            player.tell(res.output, 0);
            logger.info(lang.success + ": " + res.output);
        } else {
            player.tell(lang.failed + ": " + res.output, 0);
            logger.error(lang.failed + ": " + res.output);
        }
    } else if (type == "playerCmd" || type == "OP_playerCmd") {
        let runcmd = player.runcmd(send.replaceAll('@s', player.realName));
        if (!runcmd) {
            player.tell(lang.failed, 0);

            logger.error(asVar(lang.cmd_pl_run_err, [player.name, send]));
        }
    } else if (type == "form") {
        showForm(player, send);
        /*} else if (type == "OP_form") {
        tellpl(player, '命令执行type错误 (type已移除)', 1);
        logger.error('命令执行type错误 (type已移除)');*/
    } else if (type == "eval" || type == "OP_eval") {
        // 支持变量player

        // 真的会谢^ω^
        // ll.eval的执行逻辑不一样

        let addMVar = "";
        for (key in mVar) {
            addMVar = addMVar + "var " + key + " = \"" + mVar[key] + "\";";
        }

        ll.eval(addMVar + "var player = mc.getPlayer(\"" + player.xuid + "\");" + send);
    } else if (type == null || type == "" || type == "null") {} else {
        player.tell(lang.cmd_type_err, 0);
        logger.error(lang.cmd_type_err);
    }
}

/* 移动数组元素 (引用传值)
 * @param array list 送过来的数组
 * @param int i 下标
 * @param int num 就是用来控制移动的  值为：1和-1
 */
function array_move(list, i, num) {
    /*
        list.splice(i + num, 1)[0]  把移除的这个元素重新添加到指定位置
    */
    list.splice(i, 0, list.splice(i + num, 1)[0]);
}

/* 给于玩家主菜单物品
 * @param player player
 */
function giveMainItem(player) {
    // 获取配置的值
    let itemSet = {
        "item": config.getStr("mainMenu", "item", "minecraft:clock"),
        "name": config.getStr("mainMenu", "itemName", "§a打开§l§e[主菜单]"),
        "lore": config.getStr("mainMenu", "itemLore", "§5输入命令 §l§d/menu give §r§5可再拿一个")
            .split("|"),
        "aux": config.getInt("mainMenu", "itemAux", 0),
        "num": config.getInt("mainMenu", "itemNum", 1)
    };

    // 构建物品
    let mItem = mc.newItem(itemSet.item, itemSet.num);
    let mItemNBT = mItem.getNbt();
    mItemNBT.setTag("tag", new NbtCompound({
        "minecraft:item_lock": new NbtByte(2),
        "minecraft:keep_on_death": new NbtByte(1),
        "display": new NbtCompound({
            "Name": new NbtString(itemSet.name)
        })
    }));
    mItem.setNbt(mItemNBT);
    mItem.setAux(itemSet.aux);
    mItem.setLore(itemSet.lore);

    // 给玩家
    player.giveItem(mItem);
    player.refreshItems();
}

/* ====工具函数end==== */

// 导出函数
ll.export(function() {
    return version;
}, "TiMENU_version");

ll.export(function() {
    return language;
}, "TiMENU_language");

ll.export(function() {
    return expansionPack;
}, "TiMENU_expansionPack");

ll.export(function(xuid, page, callback) {
    return selectIcon(mc.getPlayer(xuid), page, callback);
}, "TiMENU_selectIcon");

ll.export(function(xuid, page, callback) {
    return selectItem(mc.getPlayer(xuid), page, callback);
}, "TiMENU_selectItem");

ll.export(function(url, path) {
    return downloadFile(url, path);
}, "TiMENU_downloadFile");

ll.export(function(xuid, name) {
    return showForm(mc.getPlayer(xuid), name);
}, "TiMENU_showForm");

ll.export(function(xuid, name, page_id, agrs) {
    return showFormID(mc.getPlayer(xuid), name, page_id, agrs);
}, "TiMENU_showFormID");

ll.export(function(str, mVar) {
    return useMVar(str, mVar);
}, "TiMENU_useMVar");

ll.export(function(xuid, str, mVar) {
    return superVar(mc.getPlayer(xuid), str, mVar);
}, "TiMENU_superVar");

ll.export(function(xuid, type, send, mVar) {
    return runCmd(mc.getPlayer(xuid), type, send, mVar);
}, "TiMENU_runCmd");




/* 服务器启动完毕Event */
mc.listen("onServerStarted", () => {
    // 注册主命令
    let cmd = mc.newCommand("menu", "TiMENU - Main", PermType.Any);
    cmd.setAlias("timenu"); // 设置指令别名

    // Any
    cmd.setEnum("AnyAction", ["open"]);
    cmd.optional("action", ParamType.Enum, "AnyAction", 1);
    cmd.optional("name", ParamType.RawText);
    cmd.overload(["AnyAction", "name"]);

    // giveAction
    cmd.setEnum("GiveAction", ["give"]);
    cmd.optional("action", ParamType.Enum, "GiveAction", 1);
    cmd.overload(["GiveAction"]);

    // MastersAction
    cmd.setEnum("MastersAction", ["set"]);
    cmd.mandatory("action", ParamType.Enum, "MastersAction", 1);
    cmd.overload(["MastersAction"]);

    cmd.setCallback((_cmd, _ori, out, res) => {
        switch (res.action) {
            case "open":
                /* 打开菜单 */
                showForm(_ori.player, res.name);
                return;
            case "give":
                /* 给于物品 */
                giveMainItem(_ori.player);
                return;
            case "set":
                /* 设置菜单 */
                if (!_ori.player.isOP()) {
                    /* 玩家没有OP权限 */
                    _ori.player.tell(lang.msg_head_warn + lang.permission_denied, 0);
                    logger.warn(_ori.player.name + " " + lang.permission_denied);
                    return out.error(lang.permission_denied);
                } else {
                    setPlugin(_ori.player);
                }
                return;
            default:
                // 打开默认菜单
                showForm(_ori.player, config.getStr("mainMenu", "name", "main"));
                return;
        }
    });
    cmd.setup(); // 将命令注册到 BDS 的命令系统当中
});

/* 插件加载逻辑 */
function onEnable() {
    // 插件注册
    ll.registerPlugin("TiMENU", "一款功能强大的GUI菜单插件", version, {
        "作者Author": "Cdm2883",
        "QQ": "1759370644",
        "Telegram": "@Cdm2883"
    });

    // 监听事件
    mc.listen("onUseItemOn", function(player, item) {
        if (player.getExtraData("itemOpenedMenu") !== true && item.type == config.getStr("mainMenu", "item", "minecraft:clock")) {
            //判断物品是否是配置文件中设置的
            
            // 打开主表单
            showForm(player, config.getStr("mainMenu", "name", "main"));
            
            // 防止短时间内重复多次打开
            player.setExtraData("itemOpenedMenu", true);
            setTimeout(function () {
                player.setExtraData("itemOpenedMenu", false);
            }, 1000);
        }
    });

    mc.listen("onJoin", function(player) {
        if (config.getBool("mainMenu", "autoGiveItem", true) == true && config.getBool("gave_item", player.xuid, false) != true) {
            /* 开启了自动给予物品, 并且之前没有自动给过物品 */
            config.set("gave_item", player.xuid, true); // 设置已经给予过了

            giveMainItem(player);

            // 旧方案, 局限性大
            // mc.runcmd('give ' + player.name + ' ' + config.getStr("mainMenu", "item", "minecraft:clock") + " 1 0 {\"minecraft:keep_on_death\":{},\"minecraft:item_lock\":{\"mode\":\"lock_in_inventory\"}}");
        }
    });

    // 控制台输出
    logger.setTitle("");
    logger.setConsole(true, 4);

    // 控制台是等宽字体<(｀^´)>
    logger.log('                                 ');
    logger.log('   _____ _ _____ _____ _____ _____ ');
    logger.log('  |_   _|_|     |   __|   | |  |  |');
    logger.log('    | | | | | | |   __| | | |  |  |');
    logger.log('    |_| |_|_|_|_|_____|_|___|_____|');
    logger.log('                                   ');
    /*
    logger.log('   ____________    __      _______________    ________     _________     __     __');
    logger.log('  /\\____   ____\\  /\\__\\    /\\  _____  ____ \\  /\\  _____\\   /\\  _____ \\   /\\ \\    /\\ \\');
    logger.log('  \\/___/\\  \\___/  \\/__/_   \\ \\ \\___/\\ \\___/\\ \\  \\ \\ \\____/_  \\ \\ \\  \\ \\ \\  \\ \\ \\   \\ \\ \\');
    logger.log('      \\ \\  \\        /\\ \\  \\ \\ \\  \\ \\ \\  \\ \\ \\ .\\ \\  _____\\  \\ \\ \\  \\ \\ \\  \\ \\ \\   \\ \\ \\');
    logger.log('       \\ \\  \\       \\ \\ \\  \\ \\ \\  \\ \\ \\  \\ \\ \\ .\\ \\ \\____/_  \\ \\ \\  \\ \\ \\  \\ \\ \\____\\_\\ \\');
    logger.log('        \\ \\__\\       \\ \\_\\  \\ \\_\\  \\ \\_\\  \\ \\_\\  \\ \\ ______\\  \\ \\_\\  \\ \\ \\  \\ \\__________\\');
    logger.log('         \\/__/        \\/_/   \\/_/   \\/_/   \\/_/   \\/_______/   \\/_/   \\/_/   \\/__________/');
    */
    logger.log(' [Version]: ' + version[0] + '.' + version[1] + '.' + version[2] + ' 重制版');
    logger.log(' [Author]: Cdm       TiMENU插件已加载');
    logger.log(' ');

    updatePlugin(); // 检查更新

    // 快速编辑扩展包
    if (File.exists('.\\plugins\\TiMENU\\vanilla.json') == true && expansionPack == false) {
        /* 扩展包文件存在, 但是关闭了快速编辑扩展包功能 */
        // 删除扩展包
        File.delete('.\\plugins\\TiMENU\\vanilla.json');
    } else if (File.exists('.\\plugins\\TiMENU\\vanilla.json') == false && expansionPack == true) {
        /* 扩展包文件不存在, 但是开启了快速编辑扩展包功能 */
        // 下载扩展包
        downloadFile(serverUrl + "vanilla.json", '.\\plugins\\TiMENU\\vanilla.json');
    }

    // 初始化
    logger.setTitle("TiMENU");

    //if (!File.exists('.\\plugins\\TiMENU')) {
    //    /* 文件夹不存在 */
    // 排除了半天错误，居然在这里!
    // 第一次启动插件，这一行不会执行(返回TRUE)
    // 因为在第19行配置了配置文件, 文件夹被自动创建了!
    // 在这里检查文件夹存不存在已经没意义了!

    if (config.getBool("plugin", "firstLoad", true) == true) {
        /* 第一次加载插件 */

        // 默认配置 不引入语言文件
        config.set("mainMenu", "name", "main");
        config.set("mainMenu", "item", "minecraft:clock");
        config.set("mainMenu", "itemName", "§a打开§l§e[主菜单]");
        config.set("mainMenu", "itemLore", "§5输入命令 §l§d/menu give §r§5可再拿一个");
        config.set("mainMenu", "itemAux", 0);
        config.set("mainMenu", "itemNum", 1);
        config.set("mainMenu", "autoGiveItem", true);
        config.set("plugin", "autoUpdate", true);

        config.set("plugin", "firstLoad", false);
        config.reload();

        // 从服务器下载默认表单文件
        File.mkdir('.\\plugins\\TiMENU\\forms');
        downloadFile(serverUrl + "forms/main.json", '.\\plugins\\TiMENU\\forms\\main.json');
        downloadFile(serverUrl + "forms/modal.json", '.\\plugins\\TiMENU\\forms\\modal.json');
        downloadFile(serverUrl + "forms/button.json", '.\\plugins\\TiMENU\\forms\\button.json');
        downloadFile(serverUrl + "forms/diy.json", '.\\plugins\\TiMENU\\forms\\diy.json');

        File.mkdir('.\\plugins\\TiMENU\\language');
        downLang(); // 下载最新语言文件
        logger.info('已创建初始文件');
    }
}

// Update主插件
function updatePlugin() {
    // http
    network.httpGet(serverUrl + "v.php", function(status, result) {
        if (status == 200) {
            /* 成功连接到服务器 */
            let latest = Number(result); // 最新版本号
            if (versionNum < latest && config.getBool("plugin", "autoUpdate", true) == true) {
                /* 当前主插件版本小于最新版本, 并且开启了自动更新 */
                logger.info(asVar(lang.auto_update_doing, [versionNum + "", latest + ""]));

                // 获取更新介绍
                network.httpGet(serverUrl + "vw.php", function(status, result) {
                    if (status == 200) {
                        /* 成功连接到服务器 */
                        logger.info("");
                        let mVw = result.split("\\n");
                        mVw.forEach(item => {
                            logger.info(item);
                        });
                    }
                });

                network.httpGet(serverUrl + "plugins/TiMENU_" + latest + ".js", function(status, result) {
                    if (status == 200) {
                        /* 成功连接到服务器 */
                        File.writeTo('.\\plugins\\TiMENU_' + versionNum + '.js', result);
                        File.rename('.\\plugins\\TiMENU_' + versionNum + '.js', '.\\plugins\\TiMENU_' + latest + '.js');
                        mc.runcmdEx('ll unload TiMENU_' + versionNum + '.js');
                        mc.runcmdEx('ll load ./plugins/TiMENU_' + latest + '.js');
                        logger.info(asVar(lang.auto_update_did, [latest + ""]));
                    } else {
                        /* 状态码不正常 */
                        logger.error(lang.server_http_failed);
                        logger.error(serverUrl + "plugins/TiMENU_" + latest + ".js" + ' -> ' + status + ' ' + result);
                    }
                });
            }
        } else {
            /* 状态码不正常 */
            logger.error(lang.server_http_failed);
            logger.error(serverUrl + "v.php" + ' -> ' + status + ' ' + result);
        }
    });
}

// 下载最新语言文件
function downLang() {
    network.httpGet(serverUrl + "language/" + language + ".json", function(status, result) {
        if (status == 200 && result != "") {
            /* 成功连接到服务器 */
            let jsonFile = JSON.parse(result);
            File.writeTo('.\\plugins\\TiMENU\\language\\' + language + '.json', JSON.stringify(jsonFile, null, 4));
            lang = jsonFile;
        } else {
            /* 状态码不正常 */
            logger.error(lang.server_http_failed);
            logger.error(serverUrl + "language/" + language + ".json" + ' -> ' + status + ' ' + result);
        }
    });
    // downloadFile();
}
