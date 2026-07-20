import { Player } from "@minecraft/server";
import { CreativeArea } from "@sfmc/module-creative";
import { Peace } from "@sfmc/module-peace";
import { HttpDB } from "@sfmc/sdk/sapi/runtime";
import { ConfigManager } from "@sfmc/sdk/module-loader";
import { MenuNavigator, obsBool } from "@sfmc/sdk/sapi/runtime";
import { ListFormInfo, Msg } from "@sfmc/sdk/sapi/runtime";

const MODULES = [
  "fly",
  "creative",
  "survival",
  "peace",
  "inventory_switcher",
  "afk",
  "clean",
  "qa",
  "chat",
  "coop",
  "land",
  "money",
  "tps",
  "online_time",
  "activity_log",
  "scoreboard_sync",
  "spawn_protect",
  "chat_sounds",
];

export class AdminGUI {
  private nav: MenuNavigator;
  private player: Player;

  private constructor(player: Player) {
    this.player = player;
    this.nav = new MenuNavigator(player);
    this.nav.section("main", "管理面板", (p: any) => this.buildMain(p));
  }

  static show(player: Player): void {
    new AdminGUI(player).nav.start("main");
  }

  private buildMain(page: any): void {
    page.label(ListFormInfo(["模块开关"]));
    for (const name of MODULES) {
      const toggle = obsBool(ConfigManager.isEnabled(name));
      toggle.subscribe((val: any) => {
        if (val !== ConfigManager.isEnabled(name)) this.onToggle(name, val);
      });
      page.toggle(name, toggle);
    }
  }

  private async onToggle(name: string, val: boolean): Promise<void> {
    const ok = val
      ? await HttpDB.post(`/api/sfmc/modules/${name}/enable`, {})
      : await HttpDB.post(`/api/sfmc/modules/${name}/disable`, {});
    if (!ok) {
      Msg.error(`${name} 修改失败`, this.player);
      return;
    }
    await ConfigManager.refreshModules();
    AdminGUI.applyRuntimeState(name, val);
    Msg.success(`${name} 已${val ? "启用" : "禁用"}`, this.player);
  }

  private static applyRuntimeState(name: string, enabled: boolean): void {
    if (name === "creative") CreativeArea.enable = enabled;
    if (name === "peace") Peace.getInstance().enable = enabled;
  }
}