const Plugin_Version = [1, 5, 0];
const Plugin_Author = "Shiroha";
const Plugin_Description = "DogeLake";
const PATH = "./plugins/DogeLake";

const TIPS_CONF = new JsonConfigFile(PATH + "/Tips.json");
TIPS_CONF.init("hz", 90000);
TIPS_CONF.init("tips", []);
const TIPS = TIPS_CONF.get("tips");
const HZ = TIPS_CONF.get("hz");

const POINT_CONF = new JsonConfigFile(PATH + "/PointItemList.json");
POINT_CONF.init("items", []);
const POINT_ITEMS = POINT_CONF.get("items");

const NOTICE_CONF = new JsonConfigFile(PATH + "/Notice.json");
NOTICE_CONF.init("title", "Title");
NOTICE_CONF.init("content", "Content");
const CONTENT = NOTICE_CONF.get("content");
const TITLE = NOTICE_CONF.get("title");
File.createDir(PATH + "/NoticeData");
const NOTICE_CONF2 = new JsonConfigFile(PATH + "/NoticeReaders.json");
NOTICE_CONF2.init("players", []);

//1.全服定时广播
var Broadcast = {
    variables: [{
        n: "#PlayersNum",
        f: mc.getOnlinePlayers().length
    }, {
        n: "#BDSVersion",
        f: mc.getBDSVersion()
    }, {
        n: "#LLVersion",
        f: ll.versionString()
    }],
    Send: (arr) => {
        msg = arr[Math.floor(Math.random() * arr.length)];
        Broadcast.variables.forEach((v, i, arr) => {
            msg = msg.replace(v.n, v.f);
        });
        mc.broadcast("\n§a犬明湖§r的小提示:\n" + "§r" + msg, 1);
    },
    Run: () => {
        if (TIPS.length > 0) {
            setInterval(() => {
                Broadcast.Send(TIPS);
            }, HZ);
        }
    }
};

//2.入服提示
var Join = {
    Pre: pl => {
        mc.broadcast(pl.name + "§e正在尝试加入服务器...");
    },
    Join: pl => {
        let dv = pl.getDevice()
        let os = dv.os
        mc.broadcast(pl.name + "通过§e " + os + " §r加入服务器");
    }
}


//3.P点系统
var P = {
    UseItem: (pl, item) => {
        for (let i of POINT_ITEMS) {
            if (item.type == i.name) {
                let r = P.Reduce(pl, i.p);
                if (!r) {
                    pl.tell("§4点不足！", 5);
                    return false;
                }
            }
        }
    },
    /**
     *
     * @param {player} pl
     * @param {number} num
     * @returns {boolean} 是否成功操作
     */
    Reduce: (pl, num) => {
        let i = pl.getScore("p") - num;
        if (i < 0) {
            return false;
        } else {
            pl.reduceScore("p", num);
            pl.tell("§l" + pl.name + "§r§e减少*§r" + num);
            return true;
        }
    },
    Add: (pl, num) => {
        let i = pl.getScore("p") + num;
        if (i > 500) {
            return false;
        } else {
            pl.addScore("p", num);
            pl.tell("§l" + pl.name + "§r§e增加*§r" + num);
            return true;
        }
    },
    Set: (pls, num) => {
        if (num > 500 || num < 0) {
            return false;
        } else {
            pl.setScore("p", num);
            pl.tell("§l" + pl.name + "§r§e变动:§r" + num);
            return true;
        }
    }
}


//4.其他物品
    function UseItem(pl, item) {
        switch (item.type) {
            case "dogelake:camera":
                pl.runcmd("/home");
                break;
            case "dogelake:portable_audio":
                pl.runcmd("/mpm list");
                break;
            
        };
    };

//5.公告
var Notice = {
    GetLastIndex: () => {
        let arr = File.getFilesList(PATH + "/NoticeData/");
        let newArr = [];
        for (let f of arr) {
            let i = f.replace(/[^\d]/g, "");
            newArr.push(i);
        };
        newArr.sort((a, b) => {
            return a - b;
        });
        let i = parseInt(newArr.pop());
        return i;
    },
    Check: () => {
        let index = Notice.GetLastIndex();
        let content = new JsonConfigFile(PATH + "/NoticeData/Notice_" + index + ".json");
        if (content.get("title") != TITLE) {
            index++;
            let conf = new JsonConfigFile(PATH + "/NoticeData/Notice_" + index + ".json");
            conf.init("title", TITLE);
            conf.init("content", CONTENT);
            NOTICE_CONF2.set("players", []);
        }
    },
    Display: (pl) => {
        let c = NOTICE_CONF2.get("players")
            .filter((a => a == pl.name));
        if (c.length == 0) {
            pl.sendModalForm(TITLE, CONTENT, "我知道了", "不再提示", (pl, r) => {
                if (!r) {
                    let arr = NOTICE_CONF2.get("players");
                    arr.push(pl.name);
                    NOTICE_CONF2.set("players", arr);
                }
            });
        }
    },
    Menu: (pl) => {
        let arr = File.getFilesList(PATH + "/NoticeData/");
        let fm = mc.newSimpleForm();
        fm.setTitle("§l选择一个公告");
        for (let i of arr) {
            let title = new JsonConfigFile(PATH + "/NoticeData/" + i)
                .get("title");
            fm.addButton(title);
        };
        pl.sendForm(fm, (pl, id) => {
            let m = new JsonConfigFile(PATH + "/NoticeData/Notice_" + id + ".json");
            pl.sendSimpleForm(m.get("title"), m.get("content"), [], [], (p, r) => {});
            let fm2 = mc.newSimpleForm();
            fm2.setTitle(m.get("title"));
            fm2.setContent(m.get("content"));
            pl.sendForm(fm2, (pl, id) => {});
        });
    },
    Init: () => {
        let c = new JsonConfigFile(PATH + "/NoticeData/Notice_0.json");
        c.init("content", "Content");
        c.init("title", "Title");
    }
}

mc.listen("onPreJoin", pl => Join.Pre(pl));
mc.listen("onJoin", pl => {
    Join.Join(pl);
    Notice.Display(pl);
   // pl.runcmd('menu open ad1');//广告
});
mc.listen("onUseItemOn", (pl, item, block, side, pos) => UseItem(pl, item));
mc.listen("onUseItem", (pl, item) => P.UseItem(pl, item));

mc.listen("onServerStarted", () => {
    setCommand();
});

function setCommand(){
    setCommand_power_point();
    setCommand_tpworld();
}
function setCommand_tpworld(){
    var tpworld = mc.newCommand("dogeworld", "跨服传送.", PermType.Any, 0x80);
    tpworld.setEnum  ("e_world"         , ["ow", "bv"]);
    tpworld.mandatory("world"   , ParamType.Enum, "e_world"  , 1 );
    tpworld.overload(["world"]);
    
    tpworld.setCallback((cmd, origin, output, results) => {
        if(!origin.player) return;
        let pl = origin.player;
        switch (results.world) {
            case "ow":
                mc.runcmd(`tellraw @a {"rawtext":[{"text":"「§2幻想の境界§7~§6八雲 紫§f」 将 §e${origin.name}§f 送往常世.."}]}`);
                setTimeout(()=>{pl.transServer('mc29.rhymc.com', 29033);}, 1500);
                break;
            case "bv":
                mc.runcmd(`tellraw @a {"rawtext":[{"text":"「§2幻想の境界§7~§6八雲 紫§f」 将 §e${origin.name}§f 送往天界.."}]}`);
                setTimeout(()=>{pl.transServer('mc29.rhymc.com', 29034);}, 1500);
                break;
        }
    });
    tpworld.setup();
}
function setCommand_power_point(){
    var command = {};
    command.p = mc.newCommand("pp", "用于管理Power Point.", PermType.GameMasters, 0x80);
    command.p.setEnum("menu", ["add", "reduce", "set"]);
    command.p.mandatory("player", ParamType.Player, "player", "player", 1);
    command.p.mandatory("count", ParamType.Int, "count", "count", 1);
    command.p.mandatory("main", ParamType.Enum, "menu", "menu", 1);
    command.p.overload(["main", "player", "count"]);
    command.p.setCallback((cmd, origin, output, results) => {
        switch (results.main) {
            case "add":
                for (let pl of results.player) {
                    P.Add(pl, results.count);
                }
                break;
            case "reduce":
                for (let pl of results.player) {
                    P.Reduce(pl, results.count);
                }
                break;
            case "set":
                for (let pl of results.player) {
                    P.Set(pl, results.count);
                }
                break;
        }
    });
    command.p.setup();

    command.notice = mc.newCommand("notice", "查看服务器公告.", PermType.Any, 0x80);
    command.notice.overload([]);
    command.notice.setCallback((cmd, origin, output, results) => {
        Notice.Menu(origin.player);
    })
    command.notice.setup();
}

Broadcast.Run();
Notice.Init();
Notice.Check();

ll.registerPlugin(Plugin_Description, Plugin_Author, Plugin_Version);