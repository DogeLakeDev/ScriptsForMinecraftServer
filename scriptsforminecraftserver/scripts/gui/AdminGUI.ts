import { Player } from "@minecraft/server";
import { MenuNavigator, obsBool } from "../libs/MenuNavigator";
import { ConfigManager } from "../libs/ConfigManager";
import { HttpDB } from "../libs/HttpDB";
import { ListFormInfo } from "../libs/Tools";
import { CreativeArea } from "../area/CreativeArea";
import { Peace } from "../area/Peace";

const MODULES = [
  "fly", "creative", "survival", "peace", "inventory_switcher",
  "afk", "clean", "qa", "chat", "coop", "shop",
  "land", "holoprint", "money", "tps", "online_time",
  "activity_log", "scoreboard_sync", "spawn_protect", "chat_sounds",
];

export class AdminGUI {
  private nav: MenuNavigator;
  private player: Player;

  private constructor(player: Player) {
    this.player = player;
    this.nav = new MenuNavigator(player);
    this.nav.section("main", "管理面板", (p) => this.buildMain(p));
  }

  static show(player: Player): void {
    new AdminGUI(player).nav.start("main");
  }

  private buildMain(page: any): void {
    page.label(ListFormInfo(["模块开关"]));
    for (const name of MODULES) {
      const toggle = obsBool(ConfigManager.isEnabled(name));
      toggle.subscribe((val) => {
        if (val !== ConfigManager.isEnabled(name)) this.onToggle(name, val);
      });
      page.toggle(name, toggle);
    }
  }

  private async onToggle(name: string, val: boolean): Promise<void> {
    const ok = await HttpDB.patch(`/api/sfmc/modules/${name}`, { enabled: val });
    if (!ok) {
      this.nav.message("失败", `§c✘ ${name} 修改失败`);
      return;
    }
    await ConfigManager.reloadAll();
    AdminGUI.applyRuntimeState(name, val);
    this.nav.message("成功", `§a✔ ${name} 已${val ? "启用" : "禁用"}`);
  }

  private static applyRuntimeState(name: string, enabled: boolean): void {
    if (name === "creative") CreativeArea.enable = enabled;
    if (name === "peace") Peace.getInstance().enable = enabled;
  }
}
