//LiteLoaderScript Dev Helper
/// <reference path="d:/Game/MC/Server/LiteloaderSE/JS/HelperLib-master/src/index.d.ts"/> 
/* jshint esversion: 6 */
/*jshint -W069 */

const INFO = {
    name: "XYZ",
    intro: "坐标记录与广播",
    version: [1, 6, 0],
    other: {
        auth: "Wn1027",
        thanks: "lgc2333、 LateralCircle83"
    }
};
ll.registerPlugin(INFO.name, INFO.intro, INFO.version, INFO.other);

//#############################################
//插件配置
let default_config = {
    maxPerson : 32,
    help_maxPerson: "个人坐标记录数量上限",

    maxPublic : 64,
    help_maxPublic: "公共坐标记录数量上限",

    xyzItem: "minecraft:compass",
    help_xyzItem : "召唤坐标菜单的物品",

    dieTip: true,
    help_dieTip: "死亡地点提示（默认开启)",

    dieBack : true,
    help_dieBack: "死亡回溯（默认关闭）: 传送到上次死亡地点 (命令:/back  重启服务器或重载插件后会清空上次死亡记录)",

    tp : false,
    help_tp : "坐标传送功能（默认关闭）: 传送到某个记录的坐标",

    canTpPublic: true,
    help_canTpPublic: "（需坐标传送功能开启） 是否可以传送到任意公共坐标, 关闭后则需要管理员手动设置可以Tp的公共坐标",

    maxTpCount: -1,
    help_maxTpCount: "（需坐标传送功能开启）个人传送点坐标数量上限, 设置为 -1 则玩家可以tp到个人记录的任意坐标",
};
let default_xyz = {
    "ver":[1,5,0],
    "public" : {
        "playerName":"public",
        "默认分类":[]
    }
    
};

let config = new JsonConfigFile("./plugins/xyz/config.json", JSON.stringify(default_config)); // 插件配置路径
let xyz_conf = new JsonConfigFile("./plugins/xyz/xyz.json", JSON.stringify(default_xyz)); // 坐标记录储存路径

//#############################################

// 根据玩家对象返回当前坐标字符串
var DIR = {}; //罗盘api
let dimStr = ["§e主世界","§c下界","§3末地"];
let PosStringReg = /§3<§r(.*)§3>§a (-?\d*), (-?\d*), (-?\d*), (§e主世界|§c下界|§3末地)(.*)/;
let xyzStr = (pl) => {return pl.blockPos.x+', '+pl.blockPos.y+', '+pl.blockPos.z+', '+dimStr[pl.blockPos.dimid];};
let nameStr = (name) => {return `<${name}>`;};
let temp_diexyz = {}; // 临时记录死亡地点
let ReceivedXyz = {}; // 收到的坐标消息

mc.listen('onServerStarted',function(){
    log(`● 坐标记录插件 ver ${INFO.version} 已加载 (by Wn1027)`);
    update(xyz_conf);
    // DIR = {                 //API导入
    //     add: add_direction,
    //     del: del_direction,
    //     list: list_direction
    // };

    //罗盘API
    if (ll.hasExported("direction", "add_direction")) {
        DIR = {                 //API导入
            add: ll.import('direction', 'add_direction'),
            del: ll.import('direction', 'del_direction'),
            list: ll.import("direction", "list_direction")
        };
    }else{
        logger.warn('罗盘api插件 未安装, 坐标记录的罗盘功能将不会启用');
        logger.warn('罗盘插件下载地址: https://www.minebbs.com/resources/api.5136/');
        return;
    }
});


//===================================================
//死亡地点提示
{
    mc.listen('onPlayerDie',function(pl,source){
        if (config.get("dieTip") == true){
            pl.sendText(`§b<死亡地点> ${xyzStr(pl)}`);
            if (config.get("dieBack") == true){
                temp_diexyz[pl.realName] = pl.blockPos;
            }
        }
    });

    if (config.get("dieBack") == true){
        mc.regPlayerCmd("back","返回死亡地点(掉岩浆和虚空不要用)",function(pl,args){
                if (temp_diexyz[pl.realName] == undefined){
                    pl.sendText('没有记录的上次死亡地点');
                }else{
                    pl.teleport(temp_diexyz[pl.realName]);
                    mc.broadcast(nameStr(pl.realName) + ' §7返回死亡地点');
                }
            
        },0);
    }
}  


//===================================================
// 物品点地坐标菜单(Win10防鬼畜)
let tmp = {};
mc.listen("onUseItemOn",function(pl,item){
    let xuid = pl.xuid;
    if (!tmp[xuid]) {
        tmp[xuid] = true;
        setTimeout(function () {
            delete tmp[xuid];
        }, 300);

        // 1.5.0 更新 playername - > xuid
        if (xyz_conf.get(pl.realName) != null){
            xyz_conf.set(pl.xuid, xyz_conf.get(pl.realName));
            xyz_conf.delete(pl.realName);
        }

        // 设置方块的功能菜单
        if (item.type == config.get("xyzItem")) {
            xyz_menu(pl);
        }

        
    }
});


// 坐标功能命令注册
//注册命令
mc.listen("onServerStarted", function () {
    let cmd = mc.newCommand("xyz","广播与记录坐标", PermType.Any); //PermType.Any: 任何人,  PermType.GameMasters: 仅OP, PermType.Console: 仅控制台
    cmd.setAlias("x")
    cmd.overload([]);
    cmd.setCallback((_cmd, _ori, out, res) => {
        let pl = _ori.player;
        if (pl == null){
            out.error('此命令仅允许玩家执行');
            return;
        }
        xyz_menu(pl);
        out.success();
    })
    cmd.setup()
})

// 菜单 - 功能主菜单
function xyz_menu(pl){
    let menu_xyz = mc.newSimpleForm();
    menu_xyz.setTitle("§l坐标");
    if (pl.blockPos.dimid == 0){
        menu_xyz.setContent(`\n§b当前坐标: ${xyzStr(pl)}\n§7(对应下界坐标: §c${Math.floor(pl.blockPos.x/8)}§7, §c~§7, §c${Math.floor(pl.blockPos.z/8)}§7)\n `);
    }else if (pl.blockPos.dimid == 1){
        menu_xyz.setContent(`\n§b当前坐标: ${xyzStr(pl)}\n§7(对应主世界坐标: §a${Math.floor(pl.blockPos.x*8)}§7, §a~§7, §a${Math.floor(pl.blockPos.z*8)}§7)\n `);
    }else {
        menu_xyz.setContent(`\n§b当前坐标: ${xyzStr(pl)}\n `);
    }
    menu_xyz.addButton("§3§l当前坐标");
    menu_xyz.addButton("§2§l记录当前坐标");
    menu_xyz.addButton("§l查看个人坐标记录");
    menu_xyz.addButton("§l查看公共坐标记录");
    menu_xyz.addButton("§l个人设置");
    if (hasNavigationTask(pl.xuid)){
        menu_xyz.addButton("§c§l■ 终止当前导航");
    }
    if (pl.isOP()){
        menu_xyz.addButton("§l管理员设置");
    }
    

    pl.sendForm(menu_xyz,xyz_run);

    function xyz_run(pl,id){
        if (id == null){return '菜单已放弃';}
        switch(id){
            case 0: // 广播我的坐标
                let menu_current = mc.newSimpleForm();
                menu_current.setTitle("§l发送当前坐标到..");
                menu_current.setContent(`\n§b发送当前坐标: §r${xyzStr(pl)}\n `);
                let pls = mc.getOnlinePlayers();
                menu_current.addButton(`§3§l广播坐标给所有人`);
                if (ReceivedXyz[pl.xuid] == undefined){
                    menu_current.addButton(`§2§l导航收到的坐标\n§r§7§o(没有收到坐标)`);
                }else{
                    menu_current.addButton(`§2§l导航收到的坐标\n${ReceivedXyz[pl.xuid]}`);
                }
                
                for (let i = 0; i<pls.length; i++){
                    menu_current.addButton("发送给: "+pls[i].realName);
                }
                
                
                pl.sendForm(menu_current, current_run);

                function current_run(pl, id){
                    if (id == null){return '菜单已放弃';}
                    
                    // 广播坐标
                    if (id == 0){
                        pl.talkAs('§b我在这里: §r'+xyzStr(pl));
                        pls.forEach((pl_1)=>{if(pl_1.xuid == pl.xuid){return;}ReceivedXyz[pl_1.xuid] = `§3<§r${pl.realName}§3>§a ${xyzStr(pl)}`;});
                        return;
                    }
                    
                    // 导航收到的坐标
                    if (id == 1){
                        if (ReceivedXyz[pl.xuid] == undefined){
                            menu_end_run(pl, "§a§l导航收到的坐标", '§c你没有收到过坐标', menu_xyz, xyz_run);
                            return;
                        }
                        let warp = getxyz(ReceivedXyz[pl.xuid]);
                        
                        if (Object.keys(DIR) != 0) {
                            let allDir = DIR.list(pl);
                            if (allDir != null && Object.keys(allDir).length != 0){
                                DIR.del(pl, "all");
                                pl.runcmd(`/direction stop`);
                            }
                            pl.runcmd(`/direction start`);
                            DIR.add(pl, warp.pos, warp.name, "§d✿§r");
                        }
                        newNavigationTask(pl.xuid, warp);
                        return;
                        
                    } else{ // 私聊坐标
                        if (pls[id-2].xuid == pl.xuid){ //发送给自己
                            pl.sendText(`§a<${pls[id-2].realName}§a> §r私聊:\n§b我在这里: §r${xyzStr(pl)}`);
                            //开发测试
                            //ReceivedXyz[pls[id-2].xuid] = `§3<§r${pl.realName}§3>§a ${xyzStr(pl)}`;
                            return;
                        }
                        if (pls[id-2].sendText(`§a<${pl.realName}§a> §r私聊:\n§b我在这里: §r${xyzStr(pl)}`) == true){ // 别人收到私聊
                            ReceivedXyz[pls[id-2].xuid] = `§3<§r${pl.realName}§3>§a ${xyzStr(pl)}`;
                            pl.sendText(`§a<${pls[id-2].realName}§a> §r私聊:\n§b我在这里: §r${xyzStr(pl)}`); // 自己提示私聊
                        }else{
                            pl.sendText(`§c发送失败, 玩家已下线`);
                        }
                    }
                    
                }
                
                break;

            case 1: // 记录当前坐标
                let xyz_plData = xyz_conf.get(pl.xuid);
                let categories;
                if (xyz_plData == null){
                    categories = ["默认分类"];
                }else{
                    categories = Object.keys(xyz_plData);
                    categories.splice(0, 1);
                }
                
                let xyz_pulicData = xyz_conf.get("public");
                let publicCategories = Object.keys(xyz_pulicData);
                publicCategories.splice(0, 1);

                let menu_xyzlog = mc.newCustomForm();
                menu_xyzlog.setTitle("§l记录当前坐标"); 
                menu_xyzlog.addLabel(`\n§b当前坐标: §r${xyzStr(pl)}\n `);
                menu_xyzlog.addInput(`§l坐标名称: §r§7(个人剩余: ${config.get("maxPerson") - xyzCount(xyz_plData)}个)`);
                if (config.get("tp") == true && (config.get("maxTpCount") != -1 || (pl.isOP() && config.get("canTpPublic") == false))){
                    if (config.get("maxTpCount") != -1){
                        menu_xyzlog.addSwitch(`记录为传送点坐标 §7(传送点剩余: ${Math.min(config.get("maxTpCount"), config.get("maxPerson")) - xyzCount(xyz_plData) - tpXyzCount(xyz_plData)}个)`, false);
                    }else{
                        menu_xyzlog.addSwitch(`记录为传送点坐标`, false);
                    }
                    
                }
                
                menu_xyzlog.addDropdown("选择个人坐标分类", categories, 0);
                menu_xyzlog.addSwitch("§e记录到公共坐标(不会记录到个人坐标)",false);
                menu_xyzlog.addDropdown("§e选择公共坐标分类", publicCategories, 0)                     
                
                pl.sendForm(menu_xyzlog,xyzlog_run);

                function xyzlog_run(pl,data){
                    if (data == null){return '菜单已放弃';}
                    if (config.get("tp") == true && (config.get("maxTpCount") != -1 || (pl.isOP() && config.get("canTpPublic") == false))){
                        var xyz_name = data[1];
                        var isTpPos = data[2];
                        var person_Category = categories[data[3]];
                        var isPublic = data[4];
                        var public_Category = publicCategories[data[5]];

                    }else{
                        var xyz_name = data[1];
                        var isTpPos = false;
                        var person_Category = categories[data[2]];
                        var isPublic = data[3];
                        var public_Category = publicCategories[data[4]];

                    }
                    

                    // 输入空
                    if (xyz_name == ''){
                        menu_end_run(pl, "§l记录当前坐标", '记录当前坐标: §c坐标名称不能为空', menu_xyz, xyz_run);
                        return '坐标名称不能为空';
                    }

                    //组装记录信息
                    if (isTpPos == false){
                        var logmsg ='§3<§r' +xyz_name + '§3>§a '+xyzStr(pl)+"§r";
                    }else{
                        if (isPublic == true){ // 公共传送坐标
                            if (pl.isOP()){
                                var logmsg ='§3<§r§✈' +xyz_name + '§3>§a '+xyzStr(pl)+"§r";
                            }else{
                                var logmsg ='§3<§r' +xyz_name + '§3>§a '+xyzStr(pl)+"§r";
                            }
                        }else{ // 个人传送坐标
                            var logmsg ='§3<§r§✈' +xyz_name + '§3>§a '+xyzStr(pl)+"§r";
                        }
                        
                    }
                    

                    if (isPublic != 1){  // 个人坐标记录
                        let xyz_plData = xyz_conf.init(pl.xuid, {playerName: pl.realName, "默认分类": []});  // 个人的坐标记录列表
                        
                        // 可tp的个人坐标 数量上限
                        if (isTpPos == true){ 
                            if (config.get("maxTpCount") != -1){
                                if (tpXyzCount(xyz_plData) > config.get("maxTpCount")){
                                    menu_end_run(pl,"§l记录当前坐标",`§c记录失败, 传送点坐标数量达到上限(最大为 ${config.get("maxTpCount")} )\n\n你可以删除无用坐标以节省空间\n\n${logmsg}`, menu_xyz, xyz_run);
                                    return;
                                }
                            }
                        }
                        
                        // 个人坐标 数量上限
                        if (xyzCount(xyz_plData) > config.get("maxPerson")){
                            menu_end_run(pl,"§l记录当前坐标",`§c记录失败, 坐标数量达到上限(最大为 ${config.get("maxPerson")} )\n\n你可以删除无用坐标以节省空间\n\n${logmsg}`, menu_xyz, xyz_run);  
                            return '坐标数量达到上限';
                        }

                        xyz_plData[person_Category].unshift(logmsg);
                        xyz_conf.set(pl.xuid, xyz_plData); 
                        if (isTpPos == false){
                            menu_end_run(pl, "§l记录当前坐标",'§b§l个人坐标记录成功\n\n'+logmsg, menu_xyz, xyz_run);
                        }else{
                            menu_end_run(pl, "§l记录当前坐标",'§b§l个人传送点坐标记录成功\n\n'+logmsg, menu_xyz, xyz_run);
                        }
                        
                        return '个人坐标记录成功';
                    }

                    if (isPublic == 1){ // 公共坐标记录
                        let xyz_plData = xyz_conf.init('public',[]);
                        if (xyzCount(xyz_pulicData) <= config.get("maxPublic")){  // 公共坐标 数量上限
                            xyz_pulicData[public_Category].unshift([logmsg, pl.realName]); // 公共坐标格式[坐标记录信息，记录该坐标的玩家名]
                            xyz_conf.set('public', xyz_pulicData);
                            if (isTpPos == false || pl.isOP()){
                                menu_end_run(pl,"§l记录当前坐标",'§b§l公共坐标记录成功\n\n'+logmsg, menu_xyz, xyz_run);
                            }else if(!pl.isOP()){
                                menu_end_run(pl,"§l记录当前坐标",'§b§l公共坐标记录成功\n§c但你没有记录公共传送点坐标的权限\n\n'+logmsg, menu_xyz, xyz_run);
                            }
                            
                            mc.broadcast(nameStr(pl.realName) +' §b§l记录了公共坐标\n'+logmsg);
                            return '公共坐标记录成功';

                        }else{
                            let title = "§l记录当前坐标";
                            let endmsg = `§c记录失败, 坐标数量达到上限(最大为 ${config.get("maxPublic")} )\n\n请联系§6管理员\n\n${logmsg}`;
                            menu_end_run(pl, title, endmsg, menu_xyz, xyz_run);
                            return '公共坐标数量达到上限';
                            
                        }
                        
                    }
                }
                break;

            case 2: // 查看个人坐标记录
                xyzquery(pl,'person',menu_xyz, xyz_run);
                break;
            
            case 3: // 查看公共坐标记录
                xyzquery(pl,'public',menu_xyz, xyz_run);
                break;
            
            case 4: // 个人设置
                let menu_personSet = mc.newSimpleForm();
                menu_personSet.setTitle("§l个人坐标设置");
                menu_personSet.addButton("添加坐标分类");
                menu_personSet.addButton("设置或删除某个分类");
                menu_personSet.addButton("返回上一页");

                pl.sendForm(menu_personSet, personSet_run);

                function personSet_run(pl, id){
                    if (id == null){return;}

                    switch (id){
                        case 0: //添加分类
                            
                            let menu_addCategory = mc.newCustomForm();
                            menu_addCategory.setTitle("§l个人坐标-添加坐标分类");
                            menu_addCategory.addInput("\n§a新类别名称", "请输入新类别名称");

                            pl.sendForm(menu_addCategory, function(pl, data){
                                let xyz_plData = xyz_conf.init(pl.xuid, {playerName: pl.realName, "默认分类": []});
                                if (data == null){return '菜单已放弃';}
                                if (data[0] == ""){
                                    menu_end_run(pl, "§l个人坐标-添加坐标分类", "§cERROR 新类别名称不能为空", menu_personSet, personSet_run);
                                    return;
                                }

                                xyz_plData[data[0]] = [];
                                xyz_conf.set(pl.xuid, xyz_plData);

                                menu_end_run(pl, "§l个人坐标-添加坐标分类", `§a新个人坐标分类:\n    §r${data[0]}`, menu_personSet, personSet_run);
                                return;
                            });

                            break;

                        case 1: // 设置或删除某个分类

                            let xyz_plData = xyz_conf.get(pl.xuid);
                            if (xyz_plData == null){
                                menu_end_run(pl, "§l个人坐标-设置或删除坐标分类", `§c你没有记录任何坐标`, menu_personSet, personSet_run);
                                return;
                            }
                            let categories = Object.keys(xyz_plData);
                            categories.splice(0, 2);

                            let menu_delCategory = mc.newCustomForm();
                            menu_delCategory.setTitle("§l个人坐标-设置或删除坐标分类");
                            menu_delCategory.addDropdown("选择类别", categories);
                            menu_delCategory.addInput("修改该分类名称")
                            menu_delCategory.addSwitch("删除该分类");

                            pl.sendForm(menu_delCategory, function(pl, data){
                                if (data == null){return '菜单已放弃';}
                                let categories = Object.keys(xyz_plData);
                                categories.splice(0, 2);
                                let key = categories[data[0]];
                                if (key == null){
                                    pl.sendForm(menu_personSet, personSet_run);
                                    return;
                                }
                                if (data[1] != ""){
                                    
                                    xyz_plData[data[1]] = xyz_plData[key];
                                    delete xyz_plData[key];
                                    xyz_conf.set(pl.xuid, xyz_plData);
                                    menu_end_run(pl, "§l个人坐标-设置或删除坐标分类", `§a重命名个人坐标分类:\n    ${key} §r-> ${data[1]}`, menu_personSet, personSet_run);
                                    return;
                                }

                                if (data[2] == true){
                                    let menu_confirm = mc.newSimpleForm();
                                    menu_confirm.setTitle("§l个人坐标-设置或删除坐标分类");
                                    menu_confirm.setContent(`\n  确认删除坐标分类: ${key}?\n\n    §c该分类下所有坐标记录都会清除!\n\n\n`);
                                    menu_confirm.addButton("§c§l确认删除");
                                    menu_confirm.addButton("§l取消");

                                    pl.sendForm(menu_confirm, function(pl, id){
                                        if (id == null){return;}
                                        if (id == 0){
                                            delete xyz_plData[key];
                                            xyz_conf.set(pl.xuid, xyz_plData);
                                            menu_end_run(pl, "§l个人坐标-设置或删除坐标分类", `§c成功删除分类: ${key}`, menu_personSet, personSet_run);
                                            return;

                                        }else{
                                            pl.sendForm(menu_personSet, personSet_run);
                                            return;
                                        }

                                    });
                                    return;
                                }

                                pl.sendForm(menu_personSet, personSet_run);
                                return;

                            });
                            break;
                        
                        case 2: // 返回上一页
                            pl.sendForm(menu_xyz,xyz_run);
                            break;
                    }

                }
                break;

            case 5: // 终止当前导航 || 管理员设置
                if (hasNavigationTask(pl.xuid)){
                    clearNavigationTask(pl.xuid);
                    return;
                }                

                if (pl.isOP()){
                    opSet(pl);
                    return;
                }
                break;

            case 6: // 管理员设置
                if (pl.isOP()){
                    opSet(pl);
                    return;
                }
                break;
            
            default:
                pl.sendText('表单错误');
            break;
        } 
    }

    // 管理员设置
    function opSet(pl){
        let menu_personSet = mc.newSimpleForm();
        menu_personSet.setTitle("§l管理员设置");
        menu_personSet.addButton("添加公共坐标分类");
        menu_personSet.addButton("设置或删除公共分类");
        menu_personSet.addButton("返回上一页");

        pl.sendForm(menu_personSet, personSet_run);

        function personSet_run(pl, id){
            if (id == null){return;}
            let xyz_plData;
            switch (id){
                case 0: //添加分类
                    xyz_plData = xyz_conf.get("public");

                    let menu_addCategory = mc.newCustomForm();
                    menu_addCategory.setTitle("§l公共坐标-添加坐标分类");
                    menu_addCategory.addInput("新类别名称", "请输入新类别名称");

                    pl.sendForm(menu_addCategory, function(pl, data){
                        if (data == null){return '菜单已放弃';}
                        if (data[0] == ""){
                            menu_end_run(pl, "§l公共坐标-添加坐标分类", "§cERROR 新类别名称不能为空", menu_personSet, personSet_run);
                            return;
                        }

                        xyz_plData[data[0]] = [];
                        xyz_conf.set("public", xyz_plData);

                        menu_end_run(pl, "§l公共坐标-添加坐标分类", `§a新公共坐标分类:\n    §r${data[0]}`, menu_personSet, personSet_run);
                        return;
                    });

                    break;

                case 1: // 设置或删除某个分类

                    xyz_plData = xyz_conf.get("public");

                    let categories = Object.keys(xyz_plData);
                    categories.splice(0, 2);

                    let menu_delCategory = mc.newCustomForm();
                    menu_delCategory.setTitle("§l公共坐标-设置或删除坐标分类");
                    menu_delCategory.addDropdown("选择类别", categories);
                    menu_delCategory.addInput("修改该分类名称");
                    menu_delCategory.addSwitch("删除该分类");

                    pl.sendForm(menu_delCategory, function(pl, data){
                        if (data == null){return '菜单已放弃';}
                        let categories = Object.keys(xyz_plData);
                        categories.splice(0, 2);
                        let key = categories[data[0]];
                        if (key == null){
                            pl.sendForm(menu_personSet, personSet_run);
                            return;
                        }

                        // 重命名分类
                        if (data[1] != ""){
                            xyz_plData[data[1]] = xyz_plData[key];
                            delete xyz_plData[key];
                            xyz_conf.set("public", xyz_plData);
                            menu_end_run(pl, "§l公共坐标-设置或删除坐标分类", `§a重命名公共坐标分类:\n    ${key} §r-> ${data[1]}`, menu_personSet, personSet_run);
                            return;
                        }

                        // 删除分类
                        if (data[2] == true){
                            let menu_confirm = mc.newSimpleForm();
                            menu_confirm.setTitle("§l公共坐标-设置或删除坐标分类");
                            menu_confirm.setContent(`\n  确认删除坐标分类: ${key}?\n\n    §c该分类下所有坐标记录都会清除!\n\n\n`);
                            menu_confirm.addButton("§c§l确认删除");
                            menu_confirm.addButton("§l取消");

                            pl.sendForm(menu_confirm, function(pl, id){
                                if (id == null){return;}
                                if (id == 0){
                                    delete xyz_plData[key];
                                    xyz_conf.set("public", xyz_plData);
                                    menu_end_run(pl, "§l公共坐标-设置或删除坐标分类", `§c成功删除分类: ${key}`, menu_personSet, personSet_run);
                                    return;

                                }else{
                                    pl.sendForm(menu_personSet, personSet_run);
                                    return;
                                }

                            });
                            return;
                        }

                        pl.sendForm(menu_personSet, personSet_run);
                        return;



                    });
                    break;
                
                case 2: // 返回上一页
                    pl.sendForm(menu_xyz,xyz_run);
                    break;
            }

        }
    }


}




// 菜单 - 坐标记录查询 坐标分类页（可有可无）
function xyzquery(pl, xyz_type, lastForm, lastForm_run){
    //（pl：玩家对象，whose：[个人记录：my]）
    // 功能：广播、私聊、删除、导航、传送
    
    // 个人记录
    let categories;
    let xyz_plData;
    if (xyz_type == 'person'){  
        xyz_plData = xyz_conf.get(pl.xuid);
        if (xyz_plData == null){
            menu_end_run(pl,'§l坐标','§c你没有记录过个人坐标', lastForm, lastForm_run);
            return '你没有记录过个人坐标';
        }
        categories = Object.keys(xyz_plData);
        categories.splice(0, 1);

    // 公共记录
    }else{
        xyz_plData = xyz_conf.get('public');
        if (xyz_plData == null){
            menu_end_run(pl,'§l坐标','§c没有公共坐标记录',lastForm, lastForm_run);
            return '没有公共坐标记录';
        }

        categories = Object.keys(xyz_plData);
        categories.splice(0, 1);
    }

    // 坐标只有默认分类
    if (categories.length == 1){ // 坐标只有默认分类
        let menu_query = mc.newCustomForm();
        // 为菜单生成坐标列表 执行坐标功能
        if (xyz_type == 'person'){
            menu_query.setTitle('§l默认分类 - 个人坐标');
        }else{
            menu_query.setTitle('§l默认分类 - 公共坐标');
        }
        xyzFunction(pl, menu_query, xyz_plData["默认分类"], "默认分类", xyz_type, lastForm, lastForm_run);
        return;
    }

     // 坐标多分类
    let menu_query = mc.newSimpleForm();
    if (xyz_type == 'person'){
        menu_query.setTitle(`选择分类- 个人坐标`);
    }else{
        menu_query.setTitle(`选择分类 - 公共坐标`);
    }

    menu_query.setContent("\n  §a选择一个分类进行查看:\n ");

    for (let i = 0; i<categories.length; i++){
        menu_query.addButton(`§l${categories[i]} §2(${xyz_plData[categories[i]].length})`);
    }
    
    pl.sendForm(menu_query, query_run);

    function query_run(pl, id){
        if (id == null){return '菜单已放弃';}
        let xyzList =  xyz_plData[categories[id]];
        let menu_category = mc.newCustomForm();
        
        if (xyz_type == 'person'){
            menu_category.setTitle(`${categories[id]} - 个人坐标`);
        }else{
            menu_category.setTitle(`${categories[id]} - 公共坐标`);
        }
        xyzFunction(pl, menu_category, xyzList, categories[id], xyz_type, lastForm, lastForm_run);
        return;
    }  
}


// 菜单 - 执行坐标功能 坐标列表页
function xyzFunction(pl, menu_xyzList, xyzList, category, xyz_type, lastForm, lastForm_run){
    let content = '';
    
    // 坐标列表页
    // 按tp是否开关，生成不同序号样式的坐标列表
    if (config.get("tp") == true){
    //if (xyz_type == "person"){
        //if (config.get("tp") == true){ 
        // (xyz_type == "person" || (xyz_type == "public" && config.get("canTpPublic") == true)) && (xyz_type == "person" && config.get("maxTpCount") == -1 || (config.get("maxTpCount") != -1 && PosStringReg.exec(pos_string)[1][1] == "✈"))
       
        if (xyz_type == "person"){  // 个人坐标
            if (config.get("maxTpCount") == -1){
                // 所有个人坐标均可传送
                for (let i=0; i<xyzList.length; i++){ 
                    content = content + '§r§b# '+(i+1)+' §7| '+xyzList[i]+'\n'; 
                }
            }else{
                // 验证传送标记
                for (let i=0; i<xyzList.length; i++){
                    if (PosStringReg.exec(xyzList[i])[1][1] == "✈"){
                        content = content + '§r§b# '+(i+1)+' §7| '+xyzList[i]+'\n';
                    }else{
                        content = content + '§r§d# '+(i+1)+' §7| '+xyzList[i]+'\n';
                    }
                }
            } 
        }else{ // 公共坐标
            if (config.get("canTpPublic") == true){
                // 所有公共坐标均可传送
                for (let i=0; i<xyzList.length; i++){ 
                    content = content + '§r§b# '+(i+1)+' §7| '+xyzList[i][0]+'\n'; 
                }
            }else{
                // 验证传送标记
                for (let i=0; i<xyzList.length; i++){
                    try{
                        if (PosStringReg.exec(xyzList[i])[1][1] == "✈"){
                            content = content + '§r§b# '+(i+1)+' §7| '+xyzList[i][0]+'\n';
                        }else{
                            content = content + '§r§d# '+(i+1)+' §7| '+xyzList[i][0]+'\n';
                        }
                    }catch{
                        content = content + '§r§d# '+(i+1)+' §7| '+xyzList[i][0]+'\n';
                    }
                }
            }
        }
        // for (let i=0; i<xyzList.length; i++){
        //     content = content + '§r§d# '+(i+1)+' §7| '+xyzList[i]+'\n';
        // }
        
    }else{ // TP关闭
        if (xyz_type == "person"){
            for (let i=0; i<xyzList.length; i++){
                content = content + '§r§d# '+(i+1)+' §7| '+xyzList[i]+'\n';
            }
        }else{
            for (let i=0; i<xyzList.length; i++){
                content = content + '§r§d# '+(i+1)+' §7| '+xyzList[i][0]+'\n';
            }
        }
    }

    menu_xyzList.addLabel(content);
    menu_xyzList.addInput("§6■ 选择坐标并执行功能", "请输入坐标序号: 正整数");
    
    pl.sendForm(menu_xyzList, xyzList_run);

    // 单个坐标功能页
    // 处理选择的坐标序号
    function xyzList_run(pl, data){
        if (data == null){return pl.sendForm(lastForm, lastForm_run);}
        
        // 空判断
        if (data[1] == ""){
            pl.sendForm(lastForm, lastForm_run);
            return;
        }

        // 正整数判断
        if (!(/(^[1-9]\d*$)/.test( Number(data[1]) ))){
            menu_end_run(pl, "§l选择坐标并执行功能", "§cERROR 请输入正整数", menu_xyzList, xyzList_run);
            return;
        }

        // 编号超出判断
        if (Number(data[1]) > xyzList.length){
            let title = '§l选择坐标并执行功能';
            let endmsg = '§cERROR 序号为 '+data[1]+' 的记录不存在';
            menu_end_run(pl, title, endmsg, menu_xyzList, xyzList_run);
            return;
        }

        // 获取所选坐标相关信息
        let pos = {
            category: undefined,
            index: undefined,
            type: undefined, // {public / person}
            string: undefined,
            by: undefined,
            warp: undefined,
        };

        pos.category = category;
        pos.index = Number(data[1]) - 1;
        pos.type = xyz_type;

        if (xyz_type == "person"){
            pos.string = xyzList[pos.index];
            pos.warp = getxyz(pos.string);
            if (pos.warp == null){
                menu_end_run(pl, "§l选择坐标并执行功能", "§cERROR 不接受此坐标字符串格式", menu_xyzList, xyzList_run);
                return;
            }
        }else {
            pos.string = xyzList[pos.index][0];
            pos.by = xyzList[pos.index][1];
            pos.warp = getxyz(pos.string);
            if (pos.warp == null){
                menu_end_run(pl, "§l选择坐标并执行功能", "§cERROR 不接受此坐标字符串格式", menu_xyzList, xyzList_run);
                return;
            }
        }
        
        // 构建所选坐标功能菜单
        let menu_xyzFunc = mc.newSimpleForm();
        menu_xyzFunc.setTitle("§l选择坐标并执行功能");
        if (xyz_type == 'person'){
            menu_xyzFunc.setContent(`\n  §9已选择坐标: §r${pos.string}\n `);
        }else{
            menu_xyzFunc.setContent(`\n  §9已选择坐标: §r${pos.string}\n  §7记录者: ${pos.by} \n `);
        }
        
        // 功能：私聊、广播、删除、导航、收藏、传送
        menu_xyzFunc.addButton("§l● 私聊该坐标");
        menu_xyzFunc.addButton("§3§l☁ 广播该坐标");
        menu_xyzFunc.addButton("§l§c✖ 删除该坐标");
        menu_xyzFunc.addButton("§2§l▣ 导航该坐标");
        if (xyz_type == "public"){
            menu_xyzFunc.addButton("§6§l★ 收藏该坐标");
        }
        if (config.get("tp") == true ){
            if (pl.isOP()){
                menu_xyzFunc.addButton("§d§l✈ 传送到坐标");
            }else{
                if (xyz_type == "person"){
                    if (config.get("maxTpCount") == -1){
                        menu_xyzFunc.addButton("§d§l✈ 传送到坐标");
                    }else if (PosStringReg.exec(pos.string)[1][1] == "✈"){
                        menu_xyzFunc.addButton("§d§l✈ 传送到坐标");
                    }
                }else{
                    if (config.get("canTpPublic") == true){
                        menu_xyzFunc.addButton("§d§l✈ 传送到坐标");
                    }else{
                        if (PosStringReg.exec(pos.string)[1][1] == "✈"){
                            menu_xyzFunc.addButton("§d§l✈ 传送到坐标");
                        }
                    }
               }

            }
           
        }

        pl.sendForm(menu_xyzFunc, xyzFunc_run);

        function xyzFunc_run(pl, id){
            if (id == null){return pl.sendForm(menu_xyzList, xyzList_run);}

            switch(id){
                case 0: // 私聊
                    funs.msg(pl, pos);
                    break;

                case 1: // 广播
                    funs.broadcast(pl, pos);
                    break;

                case 2: // 删除
                    funs.delete(pl, pos, lastForm, lastForm_run);
                    break;

                case 3: // 导航
                    funs.direction(pl, pos);
                    funs.navigate(pl, pos);
                    
                    break;

                case 4: // 收藏
                    // 此处逻辑仅负责调整菜单顺序，在菜单构建时就已判断是否执行功能
                    if (xyz_type == "public"){
                        funs.collect(pl, pos, lastForm, lastForm_run);
                    }else{
                        funs.tp(pl, pos);                        
                    }
                    break;

                case 5: // 传送
                    funs.tp(pl, pos);
                    break;

            }
        }
    }
}

// 坐标功能函数：私聊、广播、删除、导航、传送
let funs = {

    /**
     * 私聊该坐标
     * @param {pl} pl 玩家对象
     * @param {obj} pos 坐标信息对象
     * @returns 
     */
    msg(pl, pos){
        let menu_msg = mc.newSimpleForm();
        menu_msg.setTitle("§l私聊该坐标");
        menu_msg.setContent(`\n  §9已选择坐标: §r${pos.string}\n`);
        let pls = mc.getOnlinePlayers();
        for (let i = 0; i<pls.length; i++){
            menu_msg.addButton(pls[i].realName);
        }

        pl.sendForm(menu_msg, function(pl, id){
            if (id == null){return;}
            if (pls[id].xuid == pl.xuid){ //私聊自己
                pl.sendText(`§a<${pls[id].realName}§a> §r私聊:\n${pos.string}`);
                ReceivedXyz[pl.xuid] = pos.string;
                return;
            }
            if (pls[id].sendText(`§a<${pl.realName}§a> §r私聊:\n${pos.string}`) == true){
                ReceivedXyz[pls[id].xuid] = pos.string;
                pl.sendText(`§a<${pls[id].realName}§a> §r私聊:\n${pos.string}`);
            }else{
                pl.sendText(`§c发送失败, 玩家已下线`);
            }
        });
    },

    /**
     * 广播该坐标
     * @param {pl} pl 玩家对象
     * @param {obj} pos 坐标信息对象
     * @returns 
     */
    broadcast(pl, pos){
        pl.talkAs(pos.string);
        let pls = mc.getOnlinePlayers();
        pls.forEach((pl_1)=>{ReceivedXyz[pl_1.xuid] = pos.string;});
        return;
    },


    /**
     * 删除该坐标
     * @param {pl} pl 玩家对象
     * @param {obj} pos 坐标信息对象
     * @param {obj} lastForm 上级表单
     * @param {function} lastForm_run 上级表单回调函数
     * @returns 
     */
    delete(pl, pos, lastForm, lastForm_run){
        if (pos.type == 'person'){  
            var xyz_plData = xyz_conf.get(pl.xuid);
        }else{
            var xyz_plData = xyz_conf.get('public');
        }
        
        let menu_confirm = mc.newSimpleForm();
        menu_confirm.setTitle("§c§l删除该坐标");
        menu_confirm.setContent(`\n  §c确认删除坐标:\n\n    ${pos.string}\n §r`);
        menu_confirm.addButton("§c§l确认删除");
        menu_confirm.addButton("§l取消");

        pl.sendForm(menu_confirm, function(pl, id){
            if (id == null){return;}
            if (id == 0){
                // 个人坐标
                if (pos.type == 'person'){ 
                    menu_end_run(pl, "§c§l删除该坐标", `§c个人坐标删除成功\n  §r${xyz_plData[pos.category][pos.index]}`, lastForm, lastForm_run);
                    xyz_plData[pos.category].splice(pos.index, 1);
                    xyz_conf.set(pl.xuid, xyz_plData);
                    return;
                }else{

                // 公共坐标
                    if (xyz_plData[pos.category][pos.index][1] != pl.realName && (!pl.isOP())){
                        menu_end_run(pl, "§c§l删除该坐标", `§cERROR 该公共坐标不是你记录的，你无权删除它\n  §r${xyz_plData[pos.category][pos.index][0]}`, lastForm, lastForm_run)
                        return;
                    }
                    mc.broadcast(nameStr(pl.realName)+' §6公共坐标记录删除成功\n§r'+ xyz_plData[pos.category][pos.index][0]);
                    log('<'+pl.realName+'> 公共坐标记录删除成功 '+xyz_plData[pos.category][pos.index][0]);
                    menu_end_run(pl, "§c§l删除该坐标", `§c公共坐标删除成功\n  §r${xyz_plData[pos.category][pos.index][0]}`, lastForm, lastForm_run);
                    xyz_plData[pos.category].splice(pos.index, 1);
                    xyz_conf.set('public', xyz_plData);
                }

                return;
                
            }
            if (id == 1){
                pl.sendForm(lastForm, lastForm_run);
                return;
            }
        });

        
    },


    /**
     * 导航该坐标
     * @param {pl} pl 玩家对象
     * @param {obj} pos 坐标信息对象
     * @returns 
     */

    navigate(pl, pos){
        newNavigationTask(pl.xuid, pos.warp);
        return;
    },

    /**
     * 指南该坐标
     * @param {player} pl 玩家对象
     * @param {pos} pos 坐标对象,与llse的pos对象一致
     * @param {string} name 名称,可以是Englese
     * @param {string} _color 显示的指向标字符[1]不填默认为§e+§r
     * @returns {Boolean}
     */
    direction(pl, pos){
        if (Object.keys(DIR) == 0) {return;}
        let allDir = DIR.list(pl);
        if (allDir != null && Object.keys(allDir).length != 0){
            DIR.del(pl, "all");
            pl.runcmd(`/direction stop`);
        }
        pl.runcmd(`/direction start`);
        DIR.add(pl, pos.warp.pos, pos.warp.name, "§d✿§r");
    },

    /**
     * 收藏该坐标
     * @param {pl} pl 玩家对象
     * @param {obj} pos 坐标信息对象
     * @param {obj} lastForm 上级表单
     * @param {function} lastForm_run 上级表单回调函数
     * @returns 
     */

    collect(pl, pos, lastForm, lastForm_run){
        let xyz_plData = xyz_conf.init(pl.xuid, {playerName: pl.realName, "默认分类": []});
        let categories = Object.keys(xyz_plData);
        categories.splice(0, 1);

        let menu_collect = mc.newCustomForm();
        menu_collect.setTitle("§l收藏该坐标");
        menu_collect.addLabel(`\n  §9已选择坐标: §r${pos.string}\n`);
        menu_collect.addDropdown("§l选择收藏到分类", categories);

        pl.sendForm(menu_collect, function(pl, data){
            if (data == null){return;}
              // 个人的坐标记录列表
            if (xyz_plData[categories[data[1]]].indexOf(pos.string) != -1){
                menu_end_run(pl,"§l收藏该坐标",`§cERROR 收藏失败, 该坐标记录已存在`, lastForm, lastForm_run);
                return;
            }

            if (xyzCount(xyz_plData) <= config.get("maxPerson")){// 个人坐标 数量上限
                xyz_plData[categories[data[1]]].unshift(pos.string);
                xyz_conf.set(pl.xuid, xyz_plData); 
                
            }else{
                menu_end_run(pl,"§l收藏该坐标",`§cERROR 收藏失败, 坐标数量达到上限(最大为 ${config.get("maxPerson")} )\n\n你可以删除无用坐标以节省空间\n\n${pos.string}`, lastForm, lastForm_run);
                return;
            }
            menu_end_run(pl, "§l收藏该坐标",`§b§l收藏坐标成功\n\n§r[${categories[data[1]]}] ${pos.string}`, lastForm, lastForm_run);
            return;

        });

        
    },

    /**
     * 传送该坐标
     * @param {pl} pl 玩家对象
     * @param {obj} pos 坐标信息对象
     * @returns 
     */
    tp(pl, pos){
        pl.teleport(pos.warp.pos.x, pos.warp.pos.y, pos.warp.pos.z, pos.warp.pos.dimid);
        mc.runcmdEx(`title "${pl.realName}" title ${pos.warp.name}`);
        if (pos.type == "person"){
            pl.sendText(`§d传送到: §r${pos.warp.name}`);
        }else{
            mc.broadcast(`${nameStr(pl.realName)} §d传送到: §r${pos.warp.name}`);
        }
    }
};

// ============================
// 工具函数

//结束&返回上一页
function menu_end_run(pl, title, endmsg, lastForm, lastForm_run){
    //（玩家对象，标题，结束信息，上一页表单，上一页表单处理函数）
    let menu_end = mc.newSimpleForm();
    menu_end.setTitle(title);
    menu_end.setContent('\n\n'+endmsg+'\n\n\n\n');
    menu_end.addButton('§l返回上一页');
    menu_end.addButton('§6§l退出菜单');
    
    
    pl.sendForm(menu_end,function(pl,id){
        if (id == null){return '菜单已放弃';}
        if (id == 0){
            pl.sendForm(lastForm,lastForm_run);
            return '返回上一页';
        }
    });
}

//根据记录获取坐标
function getxyz(xyzlogstr){
    let warp = {pos:{x:0, y:100, z:0, dimid:0},name:""};
    let regTemp = PosStringReg.exec(xyzlogstr);
    if (regTemp == null){
        return null;
    }

    warp.name = regTemp[1];
    warp.pos.x = Number(regTemp[2]);
    warp.pos.y = Number(regTemp[3]);
    warp.pos.z = Number(regTemp[4]);
    

    if (regTemp[5] == "§e主世界"){
        warp.pos.dimid = 0;
    }else if (regTemp[5] == "§c下界"){
        warp.pos.dimid = 1;
    }else if (regTemp[5] == "§3末地"){
        warp.pos.dimid = 2;
    }else{
        logger.error("坐标字符串错误");
        return null;
    }
    return warp;
    
}

// 坐标数量计数（防止超过最大个人/公共坐标数量）
function xyzCount(xyzData){
    let count = 0;
    for (let key in  xyzData){
        if (key != "playerName"){
            count += xyzData[key].length;
        }
    }
    return count;
}

// 可Tp坐标数量计数
function tpXyzCount(xyzData){
    let count = 0;
    for (let key in  xyzData){
        if (key == "playerName"){continue;}
        for (let i = 0; i< xyzData[key].length; i++){
            if (xyzData[key][i][6] == "✈"){
                count += 1;
            }        
        }
    }
    return count;
}

//版本格式升级
function update(data_conf){
    let data_ver = data_conf.get("ver");
    // 1.5.0 更新
    if (data_ver == null || (data_ver[0] <= 1 && data_ver[1] <= 4)){
        
        if (!File.exists("./plugins/xyz/backup/xyz_1.4.0.json")){
            File.createDir("./plugins/xyz/backup/");
            File.copy("./plugins/xyz/xyz.json", "./plugins/xyz/backup/xyz_1.4.0.json");
        }
        
        let data = JSON.parse(data_conf.read());
        let reg = /§3<§r(.*)§3> §a(-?\d*)§f, §a(-?\d*)§f, §a(-?\d*)§f, §a(§e主世界|§c下界|§3末地)(.*)/;
        for (let key in data){
            if (data[key] instanceof Array){

                if (data[key][0] instanceof Array){ 
                    // 公共坐标
                    for (let i = 0; i<data[key].length; i++){
                        let regResult = reg.exec(data[key][i][0]);
                        if (regResult == null){continue;}
                        if (regResult[6] == ""){
                            data[key][i][0] = `§3<§r${regResult[1]}§3>§a ${regResult[2]}, ${regResult[3]}, ${regResult[4]}, ${regResult[5]}§r`;
                        }else{
                            data[key][i][0] = `§3<§r${regResult[1]}§3>§a ${regResult[2]}, ${regResult[3]}, ${regResult[4]}, ${regResult[5]}§r, ${regResult[6]}`;
                        }
                    }
                }else{
                    //个人坐标
                    for (let i = 0; i<data[key].length; i++){ 
                        let regResult = reg.exec(data[key][i]);
                        if (regResult == null){continue;}
                        if (regResult[6] == ""){
                            data[key][i] = `§3<§r${regResult[1]}§3>§a ${regResult[2]}, ${regResult[3]}, ${regResult[4]}, ${regResult[5]}§r`;
                        }else{
                            data[key][i] = `§3<§r${regResult[1]}§3>§a ${regResult[2]}, ${regResult[3]}, ${regResult[4]}, ${regResult[5]}§r, ${regResult[6]}`;
                        }
                    }
                }
                
                data[key] = {playerName:key, "默认分类": data[key]};
            }

        }
        data["ver"] = [1,5,0];
        if (data_conf.write(JSON.stringify(data, null, 4)) == true){
            log("● 1.5.0 版本坐标格式升级成功");
        }
        
    }
    
}


// ============================= 
// 开发者自定义函数实例——自动记录末地船坐标
// function addxyz(){
//     let xyzmsg =`§3<§r末地船§3> ${xyzStr(pl)} ${system.getTimeStr()}`; // 坐标记录
//     let logmsg =`<${pl.realName}> ${xyzStr(pl)} ${system.getTimeStr()}`; // 控制台消息

//     let xyz_plData = xyz_conf.init(pl.xuid,{playerName:pl.realName, "默认分类":[]}); // 初始化个人坐标
//     let xyz_endcity = xyz_conf.init('endcity',{playerName:"endcity", "默认分类":[]}); // 初始化末地船坐标

//     xyz_plData.unshift(xyzmsg); // 添加个人坐标记录
//     xyz_endcity.unshift(logmsg); // 添加末地船记录

//     xyz_conf.set(pl.xuid, xyz_plData); // 保存记录
//     xyz_conf.set('endcity', xyz_endcity);// 保存记录
// }


// ============================= 
//导航API


const pluginName = 'NavigationAPI';
const exportNamespace = 'NavAPI';
const tasks = new Map();
const { Red, Green, Aqua, White, LightPurple, Clear, MinecoinGold } = Format;

function formatPos(pos) {
  const { x, y, z, dimid } = pos;
  const dim = (() => {
    switch (dimid) {
      case 0:
        return '主世界';
      case 1:
        return '地狱';
      case 2:
        return '末地';
      default:
        return '未知';
    }
  })();
  return (
    `${Clear}${x}, ` +
    `${y}, ` +
    `${z}, ` +
    `${LightPurple}${dim}`
  );
}

/**
 * 停止导航任务
 *
 * @param {String} xuid 玩家Xuid
 * @returns {Boolean} 是否成功
 */
function clearNavigationTask(xuid) {
  const pl = mc.getPlayer(xuid);
  const taskId = tasks.get(xuid);

  if (!taskId) {
    pl.tell(`${Red}没有导航进行中`);
    return false;
  }

  clearInterval(taskId);
  tasks.delete(xuid);
  //pl.removeBossBar(Math.floor((Number(pl.xuid) - 16) / 2));

  //终止罗盘
  if (Object.keys(DIR) != 0) {
      let allDir = DIR.list(pl);
      if (allDir != null && Object.keys(allDir).length != 0){
          DIR.del(pl, "all");
          pl.runcmd(`/direction stop`);
      }
  }

  pl.tell(`${Green}本次导航完成~欢迎下次使用~`, 5);

  return true;
}

/**
 * 获取玩家是否正在导航中
 *
 * @param {String} xuid 玩家Xuid
 * @returns {Boolean} 玩家导航状态 true为正在导航
 */
function hasNavigationTask(xuid) {
  return !!tasks.get(xuid); // to boolean
}

/**
 * 新建导航任务
 *
 * warp对象必须包含的项目示例
 * {
 *     "pos": {
 *         "x": 39.43924331665039,
 *         "y": 65.62001037597656,
 *         "z": 92.11305236816406,
 *         "dimid": 0
 *     },
 *     "name": "岩浆池"
 * }
 *
 * @param {String} xuid 玩家Xuid
 * @param {Object} warp warp对象，示例见上
 * @returns {Boolean} 是否成功
 */
function newNavigationTask(xuid, warp) {
  const tmpPl = mc.getPlayer(xuid);

  function formatXZPos(x, z) {
    return `${Green}${x.toFixed()} ${Red}~ ${Aqua}${z.toFixed()}`;
  }

  if (hasNavigationTask(xuid)) {
    // tmpPl.tell(`${Red}已有导航正在进行中，请先结束`);
    // return false;
    clearNavigationTask(xuid);
  }

  function task() {
    const pl = mc.getPlayer(xuid);
    const {
      pos: { x, y, z, dimid: dimid },
    } = pl;
    const { pos, name } = warp;
    const { x: dx, y: dy, z: dz, dimid: dDim } = pos;
    const distance = Math.sqrt(
      (x - dx) * (x - dx) + (y - dy) * (y - dy) + (z - dz) * (z - dz)
    ).toFixed();

    let msg =
      `§a${name}${Clear} | ` +
      `${MinecoinGold}目标: ${formatPos(pos)}${Clear} | `;
    if (dimid !== dDim) {
      msg += (() => {
        if (dimid === 2 || dDim === 2) return `${Red}维度不匹配`;
        if (dDim === 1)
          // warp点在地狱
          return `${MinecoinGold}主世界坐标：${formatXZPos(dx * 8, dz * 8)}`;
        if (dDim === 0)
          // warp点在主世界
          return `${MinecoinGold}地狱坐标：${formatXZPos(dx / 8, dz / 8)}`;
        return `${Red}非法导航`;
      })();
    } else {
      if (distance <= 3) {
        clearNavigationTask(pl.xuid);
        return;
      }

      msg += `${MinecoinGold}距离 ${Green}${distance} ${MinecoinGold}方块`;
    }
    pl.tell(msg, 5);
    //mc.runcmdEx(`title "${pl.realName}" actionbar ${msg}`);
    //pl.setBossBar(Math.floor((Number(pl.xuid) - 16) / 2), msg, 100, 0);
  }

  tmpPl.tell(`${Green}开始为您导航~`);
  tmpPl.tell(`${Green}开始为您导航~`, 5);
  const taskId = setInterval(task, 500);
  tasks.set(xuid, taskId);
  return true;
}

mc.listen('onLeft', (pl) => clearNavigationTask(pl.xuid));

mc.listen("onServerStarted", function () {
  let cmd = mc.newCommand('stopnav_xyz', '停止导航', PermType.Any);
  cmd.setCallback((_, origin, out) => {
    if (!origin.player) {
      out.error(
        '该指令只能由玩家执行，请使用execute命令模拟目标玩家执行该指令'
      );
      return false;
    }
    return clearNavigationTask(origin.player.xuid);
  })
  cmd.overload()
  cmd.setup()
})

// ll.export(newNavigationTask, `${exportNamespace}_newTask`);
// ll.export(clearNavigationTask, `${exportNamespace}_clearTask`);
// ll.export(hasNavigationTask, `${exportNamespace}_hasTask`);

// ll.registerPlugin(pluginName, '导航API', [0, 1, 2], {
//   Author: 'student_2333',
//   License: 'Apache-2.0',
// });
