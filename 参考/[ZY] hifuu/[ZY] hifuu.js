// ==================== Title ====================

  /* ---------------------------------------- *\
   *  Name        :  Call of the Hifuu        *
   *  Description :  秘封的召唤                *
   *  Version     :  0.1.0                    *
   *  Author      :  ENIAC_Jushi              *
  \* ---------------------------------------- */
// Config


// ================== Initialize ===================
let version = 0.1
const COST = 10
const PATH = "plugins/DogeLake/hifuutp";
function load(){
    // logger output
    logger.setConsole(true);
    logger.setTitle('CallHifuu');
    logger.info('Call of the Hifuu is running');
    posManager.load();
    setMenu();
}

// Data
var posData = {}
var posManager = {
    write(){
        file.writeTo(PATH + "/last_position.js", JSON.stringify(posData, null , '\t'));
    },
    load(){
        let data_path = PATH + "/last_position.js"
        if(file.exists(data_path)){
            posData = JSON.parse(file.readFrom(data_path));
            return true;
        }
        else{
            file.writeTo(data_path, JSON.stringify({}, null , '\t'));
            return this.load();
        }
    },
    get(name, key){
        if(posData[name] == null){
            return null
        }
        else{
            return posData[name][key]
        } 
    },
    set(name, key, value){
        if(posData[name] == null){
            posData[name] = {}
        }
        posData[name][key] = value
        this.write()
    }
}

// Tool
function getMoney(pl){
    return pl.getScore("money");
}
function setMoney(pl, money){
    return (pl.setScore("money", money) != null);
}

function teleport_player(pl, desPos, cost){
    var teleport_cmd = `particle minecraft:totem_particle ${pl.pos.x} ${pl.pos.y} ${pl.pos.z}`
    setTimeout(function () {
        mc.runcmdEx(teleport_cmd)
        setTimeout(function () {
            mc.runcmdEx(teleport_cmd)
            setTimeout(function () {
                mc.runcmdEx(teleport_cmd)
                setTimeout(function () {
                    mc.runcmdEx(teleport_cmd)
                    setTimeout(function () {
                        // teleport
                        money = getMoney(pl) - cost
                        if( money >= 0){
                            setMoney(pl, money)
                            mc.runcmdEx(`particle minecraft:dragon_destroy_block ${pl.pos.x} ${pl.pos.y} ${pl.pos.z}`)
                            setTimeout(function () {
                                pl.teleport(desPos[0], desPos[1], desPos[2], desPos[3]) // 外界
                                setTimeout(function () {
                                    mc.runcmdEx(`particle minecraft:dragon_destroy_block ${desPos[0]} ${desPos[1]} ${desPos[2]}`)
                                }, 150);
                            }, 150);
                        }
                        else{
                            pl.sendText("传送失败，你没有节操^ ^")
                        }
                    }, 500);
                }, 500);
            }, 500);
        }, 500);
    }, 500);
}

// 判断坐标是否在某区域内 (2D, 包含边界)
function pointInArea_2D(x,z,areaStart_x,areaStart_z,areaEnd_x,areaEnd_z){

    if(areaStart_x < areaEnd_x){
        if(x < areaStart_x || areaEnd_x < x){
            return false;
        }
    }
    else{
        if(x < areaEnd_x || areaStart_x < x){
            return false;
        }
    }

    if(areaStart_z < areaEnd_z){
        if(z < areaStart_z || areaEnd_z < z){
            return false;
        }
    }
    else{
        if(z < areaEnd_z || areaStart_z < z){
            return false;
        }
    }

    return true;
}
function pointInArea_3D(x,y,z,areaStart_x,areaStart_y,areaStart_z,areaEnd_x,areaEnd_y,areaEnd_z){
    if(areaStart_x < areaEnd_x){
        if(x < areaStart_x || areaEnd_x < x){
            return false;
        }
    }
    else{
        if(x < areaEnd_x || areaStart_x < x){
            return false;
        }
    }
    if(areaStart_y < areaEnd_y){
        if(y < areaStart_y || areaEnd_y < y){
            return false;
        }
    }
    else{
        if(y < areaEnd_y || areaStart_y < y){
            return false;
        }
    }
    if(areaStart_z < areaEnd_z){
        if(z < areaStart_z || areaEnd_z < z){
            return false;
        }
    }
    else{
        if(z < areaEnd_z || areaStart_z < z){
            return false;
        }
    }
    return true;

}

// Menu
function setMenu(){
    menu_hearn.set()
    menu_yukari.set()
}
// 到梅莉
var menu_hearn = {
    value: mc.newSimpleForm(),
    set:function(){
        this.value.setTitle("Hifuu TelePhone");
        this.value.setContent(` 是否施展传送秘术？\n 目标位置为 §e玛艾露贝莉·赫恩§f 将会消耗${COST}节操。`)
        this.value.addButton("施展!");
        this.value.addButton("不要施展");
    },
    callBack(player, id){
        if(id == 0){
            money = getMoney(player) - COST
            if( money >= 0){
                posManager.set(player.realName, "out", [Math.floor(player.pos.x), Math.floor(player.pos.y), Math.floor(player.pos.z)])
                player.sendText("传送到 §e玛艾露贝莉·赫恩§f ...", 0)
                teleport_player(player, [4185, 68, 16572, 0], COST)
            }
            else{
                player.sendText("你没节操^ ^", 0)
            }
        }
        if(id == 1){ return; }
    },
    send(pl){
        pl.sendForm(this.value, this.callBack);
    }
}
// 常世外返回
var menu_out = {
    set:function(pos){
        var value =  mc.newSimpleForm()
        value.setTitle("Hifuu TelePhone");
        value.setContent(` 是否施展传送秘术？\n 目标位置为 §a${pos[0]} ${pos[1]} ${pos[2]}§f 将会消耗${COST}节操。`)
        value.addButton("施展!");
        value.addButton("不要施展");
        return value
    },
    callBack(player, id){
        if(id == 0){
            money = getMoney(player) - COST
            if( money >= 0){
                var pos = posManager.get(player.realName, "out")
                if(pos == null){
                    player.sendText("暂无可使用的返回点", 0)
                }
                else{
                    player.sendText(`传送到 §a${pos[0]} ${pos[1]} ${pos[2]}§f ...`, 0)
                    teleport_player(player, [pos[0], pos[1], pos[2], 0], COST)
                }
            }
            else{
                player.sendText("你没节操^ ^", 0)
            }
        }
        if(id == 1){ return; }
    },
    send(pl, pos){
        pl.sendForm(this.set(pos), this.callBack);
    }
}

// 到紫
var menu_yukari = {
    value: mc.newSimpleForm(),
    set:function(){
        this.value.setTitle("Hifuu TelePhone");
        this.value.setContent(` 是否施展传送秘术? \n 目标位置为 §e八云 紫§f 将会消耗${COST}节操。`)
        this.value.addButton("施展!");
        this.value.addButton("不要施展");
    },
    callBack(player, id){
        if(id == 0){
            money = getMoney(player) - COST
            if( money >= 0){
                posManager.set(player.realName, "ow", [Math.floor(player.pos.x), Math.floor(player.pos.y), Math.floor(player.pos.z)])
                player.sendText("传送到 §e八云 紫§f...", 0)
                teleport_player(player, [3218, 41, 3574, 0], COST) // 常世
            }
            else{
                player.sendText("你没节操^ ^", 0)
            }
        }
        if(id == 1){ return; }
    },
    send(pl){
        pl.sendForm(this.value, this.callBack);
    }
}
// 常世内返回
var menu_ow = {
    set:function(pos){
        var value = mc.newSimpleForm()
        value.setTitle("Hifuu TelePhone");
        value.setContent(` 是否施展传送秘术？\n 目标位置为 §a${pos[0]} ${pos[1]} ${pos[2]}§f 将会消耗${COST}节操。`)
        value.addButton("施展!");
        value.addButton("不要施展");
        return value
    },
    callBack(player, id){
        if(id == 0){
            money = getMoney(player) - COST
            if( money >= 0){
                var pos = posManager.get(player.realName, "ow")
                if(pos == null){
                    player.sendText("暂无可使用的返回点", 0)
                }
                else{
                    player.sendText(`传送到 §a${pos[0]} ${pos[1]} ${pos[2]}§f ...`, 0)
                    teleport_player(player, [pos[0], pos[1], pos[2], 0], COST)
                }
            }
            else{
                player.sendText("你没节操^ ^", 0)
            }
        }
        if(id == 1){ return; }
    },
    send(pl, pos){
        pl.sendForm(this.set(pos), this.callBack);
    }
}


// Command
var CommandManager = {
    set:function(){
        var cmd = mc.newCommand("hifuutp", "hifuu teleport", PermType.Any)
        cmd.overload ();
        cmd.setCallback((_cmd, _ori, out, res) => {
            if(_ori.player){
                var pos = _ori.player.pos
                if(pos.dimid == 0){
                    // 常世
                    if(Math.abs(pos.x)<=6000 && Math.abs(pos.z)<=6000){
                        // 基地内, 返回上次传送前位置
                        if(pointInArea_2D(pos.x, pos.z, 3214, 3578, 3222, 3570)){
                            pos = posManager.get(_ori.player.realName, "ow")
                            if(pos != null){
                                menu_ow.send(_ori.player, pos);
                            }
                            else{
                                return out.success("暂无可用的返回点")
                            }
                        }
                        // 基地外, 返回基地
                        else{
                            menu_yukari.send(_ori.player);
                            return out.success("与八云紫取得联系...");
                        }
                    }
                    // 外界
                    else{
                        // 基地内
                        if(pointInArea_2D(pos.x, pos.z, 4183, 16573, 4189, 16571)){
                            pos = posManager.get(_ori.player.realName, "out")
                            if(pos != null){
                                menu_out.send(_ori.player, pos);
                            }
                            else{
                                return out.success("暂无可用的返回点")
                            }
                        }
                        // 基地外
                        else{
                            menu_hearn.send(_ori.player)
                            return out.success("与玛艾露贝莉·赫恩取得联系...")
                        }
                    }
                }
                else{
                    return out.success("无法与社团取得联系...");
                }
            }
        });
        cmd.setup();
    },

}
// ============== MC Events ========================
mc.listen("onServerStarted", () => {
    CommandManager.set();
});

load();