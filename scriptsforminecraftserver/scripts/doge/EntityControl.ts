/* ---------------------------------------- *\
*  Name        :  生物数量控制                *
*  Description :  分类统计生物数量并清理       *
*  Version     :  1.0.0                     *
*  Author      :  ENIAC_Jushi               *
\* ---------------------------------------- */

import { Player, system, world } from "@minecraft/server";
import { Command } from "../libs/Command";
import { Permission } from "../libs/Permission";
import { Gui } from "../libs/Gui";

/**
 * 开始统计和清理任务
 */
export function entityClean(player: Player) {
  let m = new Map<string, number>();
  // 统计数量
  for (let entity of player.dimension.getEntities({ "excludeTypes": ["player"] })) {
    let amount = m.get(entity.typeId);
    if (amount === undefined) {
      m.set(entity.typeId, 1);
    } else {
      m.set(entity.typeId, amount + 1);
    }
  }
  if (m.size === 0) {
    return;
  }

  // 排序
  let arr = Array.from(m);
  arr.sort((a, b) => {
    return b[1] - a[1];
  });

  // 发送表单
  const form = Gui.simpleForm("实体列表");
  form.title("实体列表");
  for (let data of arr) {
    form.button(`${data[1]} | ${data[0]}`);
  }
  // 清除
  form.show(player).then((response) => {
      if (response.canceled || response.selection === undefined) return;
      const selectionIndex = response.selection;

      const form2 = Gui.simpleForm("处理方式");
      form2.button(`remove`);
      form2.button(`kill`);
      form2.button("tp")
      form2.show(player).then((response2) => {
        player.sendMessage(`${response2.selection}`);
        if (response2.canceled || response2.selection === undefined) return;
        switch (response2.selection) {
          case 0: {
            let entities = player.dimension.getEntities({ "type": arr[selectionIndex][0] });
            for (let en of entities) {
              en.remove();
            }
          }; break;
          case 1: player.runCommand(`kill @e[type=${arr[selectionIndex][0]}]`); break;
          case 2: player.runCommand(`tp @s @e[c=1,type=${arr[selectionIndex][0]}]`); break;
        }
      });
    });
}

/**
 * @param player
 */
export function temp(player: Player) {
  let ens = player.dimension.getEntities({ "type": "dogelake:grid_blue" });
  for (let en of ens) {
    let res = `${en.typeId} (${en.location.x}, ${en.location.y}, ${en.location.z})\n`
    res += `doge:depth | ${en.getProperty("doge:depth")}\n`;
    res += `doge:direction | ${en.getProperty("doge:direction")}\n`;
    res += `doge:alpha | ${en.getProperty("doge:alpha")}\n`;
    player.sendMessage(res);
  }


  ens = player.dimension.getEntities({ "type": "dogelake:grid_red" });
  for (let en of ens) {
    let res = `${en.typeId} (${en.location.x}, ${en.location.y}, ${en.location.z})\n`
    res += `doge:depth | ${en.getProperty("doge:depth")}\n`;
    res += `doge:direction | ${en.getProperty("doge:direction")}\n`;
    res += `doge:alpha | ${en.getProperty("doge:alpha")}\n`;
    player.sendMessage(res);
  }

  ens = player.dimension.getEntities({ "type": "dogelake:moon_blue" });
  for (let en of ens) {
    let res = `${en.typeId} (${en.location.x}, ${en.location.y}, ${en.location.z})\n`
    res += `doge:depth | ${en.getProperty("doge:depth")}\n`;
    res += `doge:direction | ${en.getProperty("doge:direction")}\n`;
    res += `doge:alpha | ${en.getProperty("doge:alpha")}\n`;
    res += `doge:x | ${en.getProperty("doge:x")}\n`;
    res += `doge:z | ${en.getProperty("doge:z")}\n`;
    res += `doge:scale | ${en.getProperty("doge:scale")}\n`;
    player.sendMessage(res);
  }

  ens = player.dimension.getEntities({ "type": "dogelake:galaxy_blue" });
  for (let en of ens) {
    let res = `${en.typeId} (${en.location.x}, ${en.location.y}, ${en.location.z})\n`
    res += `doge:depth | ${en.getProperty("doge:depth")}\n`;
    res += `doge:direction | ${en.getProperty("doge:direction")}\n`;
    res += `doge:alpha | ${en.getProperty("doge:alpha")}\n`;
    player.sendMessage(res);
  }
}
function registerCommand() {
  Permission.register('entity_control.clear', Permission.OP);
  Command.register("en", 'entity_control.clear', (player: Player | undefined) => entityClean(player!), "清理实体");
}

registerCommand();

/**
 * 处死统计 铁傀儡 */

var iron_start: number = 0;
var iron_amount = 0;
var ironSubscription: (() => void) | undefined;
function killStatistics() {
  Permission.register('entity_control.inspect', Permission.OP);
  Command.register("en_i", 'entity_control.inspect',
    (player: Player | undefined) => {
      iron_start = new Date().getTime();
      iron_amount = 0;

      // 取消旧订阅，避免重复订阅导致内存泄漏
      if (ironSubscription) {
        ironSubscription();
        ironSubscription = undefined;
      }

      const callback = (ev: any) => {
        iron_amount++;
      };
      world.afterEvents.entityDie.subscribe(callback, { "entityTypes": ["minecraft:iron_golem"] as any });
      ironSubscription = () => world.afterEvents.entityDie.unsubscribe(callback as any);

      // 每分钟计算速度
      system.runInterval(() => {

        let time = ((new Date().getTime() - iron_start) / 60000);
        if (player) player.sendMessage(`Total: ${iron_amount} | Time: ${time.toFixed(1)}(min) | Avg: ${(iron_amount / time).toFixed(1)}`);
      }, 200);
    },
    "铁傀儡生成统计");
}
killStatistics();
