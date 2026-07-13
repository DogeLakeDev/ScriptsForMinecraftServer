import { Player } from "@minecraft/server";
import { MenuNavigator, ObservableString, ObservableNumber, obsStr, obsNum } from "../libs/MenuNavigator";
import { HoloCore } from "./HoloCore";
import { HoloEntity } from "./HoloEntity";
import { ProjectionData, COLOR_PRESETS } from "../data/HoloPrint";
import { Command } from "../libs/Command";
import { ListFormInfo } from "../libs/Tools";

export class HoloGUI {
  private nav: MenuNavigator;
  private player: Player;

  private constructor(player: Player) {
    this.player = player;
    this.nav = new MenuNavigator(player);
    this.registerSections();
  }

  static registerCommand() {
    Command.register(
      "holorint",
      "holorint.menu",
      (player: Player | undefined) => {
        if (player) new HoloGUI(player).nav.start("main");
      },
      "全息投影",
      "holoprint"
    );
    Command.register(
      "hpbe pos1",
      "holorint.pos1",
      (player: Player | undefined) => {
        if (player) HoloCore.setPos(player, 1);
      },
      "设置选区点1",
      "holoprint"
    );
    Command.register(
      "hpbe pos2",
      "holorint.pos2",
      (player: Player | undefined) => {
        if (player) HoloCore.setPos(player, 2);
      },
      "设置选区点2",
      "holoprint"
    );
  }

  // ── 外部调用入口 ──

  static async showProjectionList(
    player: Player,
    privateList: ProjectionData[],
    publicList: ProjectionData[]
  ): Promise<void> {
    const gui = new HoloGUI(player);
    gui.nav.state.privateList = privateList;
    gui.nav.state.publicList = publicList;
    await gui.nav.start("load");
  }

  static async showOperationMenu(player: Player, projection: ProjectionData): Promise<void> {
    const gui = new HoloGUI(player);
    gui.nav.state.projection = projection;
    await gui.nav.start("operation");
  }

  static async showMaterialList(player: Player, materials: { name: string; count: number }[]): Promise<void> {
    const gui = new HoloGUI(player);
    gui.nav.state.materials = materials;
    await gui.nav.start("materials");
  }

  static showVersionWarning(player: Player): void {
    const gui = new HoloGUI(player);
    gui.nav.state._title = "版本不匹配";
    gui.nav.confirm(
      "版本不匹配",
      "检测到插件版本与服务器端不匹配，部分投影可能无法正常显示。\n\n请重新加入游戏以获取更新后的投影。",
      () => {}
    );
  }

  // ── Sections ──

  private registerSections(): void {
    this.nav.section("main", "全息投影", (p) => this.buildMain(p));
    this.nav.section("upload", "上传投影", (p) => this.buildUpload(p));
    this.nav.section("load", "加载投影", (p) => this.buildLoad(p));
    this.nav.section("operation", "操作菜单", (p) => this.buildOperation(p));
    this.nav.section("materials", "物品清单", (p) => this.buildMaterials(p));
    this.nav.section("numInput", "数值", (p) => this.buildNumInput(p));
    this.nav.section("colorPicker", "颜色选择", (p) => this.buildColorPicker(p));
    this.nav.section("moveInput", "移动投影", (p) => this.buildMoveInput(p));
    this.nav.section("layerMode", "层模式", (p) => this.buildLayerMode(p));
  }

  private buildMain(page: any): void {
    page.label("选择一个操作：");
    page.button("📤 上传投影", () => {
      this.player.sendMessage(
        "§a[HPBE] 请使用 §e!hpbe pos1 §a和 §e!hpbe pos2 §a设置选区，然后使用 §e!hpbe§a 打开菜单选择上传"
      );
      this.nav.go("upload");
    });
    page.button("📥 加载投影", () => HoloCore.loadProjectionList(this.player));
  }

  private buildUpload(page: any): void {
    const name = obsStr("");
    const author = obsStr(this.player.name);
    const description = obsStr("");
    const visibilityIndex = obsNum(0);
    page.textField("§a投影名称", name, { description: "请输入投影名称…" });
    page.textField("§a作者", author, { description: "作者名" });
    page.textField("§7描述（可选）", description, { description: "请输入描述…" });
    page.dropdown("§a可见性", visibilityIndex, [
      { label: "公共", value: 0 },
      { label: "私人", value: 1 },
    ]);
    page.button("确认上传", () => {
      HoloCore.startUpload(this.player, {
        name: name.getData(),
        author: author.getData(),
        description: description.getData(),
        visibility: visibilityIndex.getData() === 0 ? "public" : "private",
      });
    });
  }

  private buildLoad(page: any): void {
    const privateList = this.nav.state.privateList as ProjectionData[] | undefined;
    const publicList = this.nav.state.publicList as ProjectionData[] | undefined;
    page.label(ListFormInfo([`我的投影: ${privateList?.length ?? 0} | 公共投影: ${publicList?.length ?? 0}`]));
    for (const p of privateList ?? []) {
      page.button(`${p.name}`, () => {
        this.nav.confirm(
          "放置投影",
          "是否将投影放置在当前位置？",
          () => HoloEntity.spawnProjection(this.player, p.id, this.player.location),
          () => this.nav.rebuild("load")
        );
      });
    }
    for (const p of publicList ?? []) {
      page.button(`${p.name}`, () => {
        this.nav.confirm(
          "放置投影",
          "是否将投影放置在当前位置？",
          () => HoloEntity.spawnProjection(this.player, p.id, this.player.location),
          () => this.nav.rebuild("load")
        );
      });
    }
  }

  private buildOperation(page: any): void {
    const p = this.nav.state.projection as ProjectionData;
    if (!p) {
      page.label("投影数据丢失。");
      return;
    }
    const s = p.settings;

    page.label(`操作 - ${p.name}`);
    page.button("🧱 物品清单", () => HoloCore.executeOperation(this.player, p.id, "materials"));
    page.button(`👁 显示/隐藏 (当前: ${s.visible ? "显示" : "隐藏"})`, () =>
      HoloCore.executeOperation(this.player, p.id, "toggle_visibility")
    );

    page.button(`📐 比例 (当前: ${s.scale})`, () => {
      this.nav.state.op = "set_scale";
      this.nav.state.defaultValue = s.scale;
      this.nav.state.min = 0.1;
      this.nav.state.max = 10;
      this.nav.go("numInput");
    });
    page.button(`🎨 纹理轮廓宽度 (当前: ${s.textureOutlineWidth})`, () => {
      this.nav.state.op = "set_texture_outline_width";
      this.nav.state.defaultValue = s.textureOutlineWidth;
      this.nav.state.min = 0;
      this.nav.state.max = 10;
      this.nav.go("numInput");
    });
    page.button(`🎨 纹理轮廓透明度 (当前: ${s.textureOutlineOpacity})`, () => {
      this.nav.state.op = "set_texture_outline_opacity";
      this.nav.state.defaultValue = s.textureOutlineOpacity;
      this.nav.state.min = 0;
      this.nav.state.max = 1;
      this.nav.go("numInput");
    });
    page.button("🎨 纹理轮廓颜色", () => {
      this.nav.state.op = "set_texture_outline_color";
      this.nav.go("colorPicker");
    });
    page.button(`🌈 叠加染色透明度 (当前: ${s.overlayTintOpacity})`, () => {
      this.nav.state.op = "set_overlay_tint_opacity";
      this.nav.state.defaultValue = s.overlayTintOpacity;
      this.nav.state.min = 0;
      this.nav.state.max = 1;
      this.nav.go("numInput");
    });
    page.button("🌈 叠加染色", () => {
      this.nav.state.op = "set_overlay_tint";
      this.nav.go("colorPicker");
    });
    page.button(`▶ 生成动画 (当前: ${s.spawnAnimation ? "开" : "关"})`, () =>
      HoloCore.executeOperation(this.player, p.id, "toggle_spawn_animation")
    );
    page.button(`🔆 透明度 (当前: ${s.opacity})`, () => {
      this.nav.state.op = "set_opacity";
      this.nav.state.defaultValue = s.opacity;
      this.nav.state.min = 0;
      this.nav.state.max = 1;
      this.nav.go("numInput");
    });
    page.button(`📊 层级 (当前: ${s.layer})`, () => {
      this.nav.state.op = "set_layer";
      this.nav.state.defaultValue = s.layer;
      this.nav.state.min = -64;
      this.nav.state.max = 320;
      this.nav.go("numInput");
    });
    page.button(`📏 移动`, () => this.nav.go("moveInput"));
    page.button(`🔄 旋转 (当前: ${s.rotation}°)`, () => {
      this.nav.state.op = "set_rotation";
      this.nav.state.defaultValue = s.rotation;
      this.nav.state.min = 0;
      this.nav.state.max = 360;
      this.nav.go("numInput");
    });
    page.button(`🔍 方块检查 (当前: ${s.blockInspect ? "开" : "关"})`, () =>
      HoloCore.executeOperation(this.player, p.id, "toggle_block_inspect")
    );
    page.button(`🎨 叠加染色开关 (当前: ${s.overlayTint ? "开" : "关"})`, () =>
      HoloCore.executeOperation(this.player, p.id, "toggle_overlay_tint")
    );
    page.button(
      `📋 层模式 (当前: ${s.layerMode === "all" ? "全部" : s.layerMode === "single" ? "单层" : "范围"})`,
      () => this.nav.go("layerMode")
    );
    page.button("❌ 删除投影", () => {
      this.nav.confirm(
        "删除投影",
        "确定要删除此投影吗？此操作不可撤销。",
        () => HoloCore.executeOperation(this.player, p.id, "delete"),
        () => this.nav.rebuild("main")
      );
    });
    page.button("🔄 更换投影", () => HoloCore.loadProjectionList(this.player));
  }

  private buildMaterials(page: any): void {
    const materials = this.nav.state.materials as { name: string; count: number }[] | undefined;
    if (!materials) {
      page.label("无数据");
      return;
    }
    const sorted = [...materials].sort((a, b) => b.count - a.count);
    const maxDisplay = 50;
    const displayItems = sorted.slice(0, maxDisplay);
    page.label(`共 §e${sorted.length}§r 种材料`);
    for (const m of displayItems) page.label(`§7${m.count}§r x ${m.name}`);
    if (sorted.length > maxDisplay) page.label(`§8... 还有 ${sorted.length - maxDisplay} 种材料`);
  }

  private buildNumInput(page: any): void {
    const val = obsNum((this.nav.state.defaultValue as number) ?? 0);
    page.slider("数值", val, (this.nav.state.min as number) ?? 0, (this.nav.state.max as number) ?? 100, { step: 1 });
    page.button("确认", () => {
      HoloCore.executeOperation(
        this.player,
        (this.nav.state.projection as ProjectionData)?.id,
        this.nav.state.op as string,
        val.getData()
      );
      this.nav.rebuild("operation");
    });
  }

  private buildColorPicker(page: any): void {
    page.label("选择一个颜色预设：");
    for (const preset of COLOR_PRESETS) {
      page.button(`§l${preset.name}§r  ${preset.hex}`, () => {
        HoloCore.executeOperation(
          this.player,
          (this.nav.state.projection as ProjectionData)?.id,
          this.nav.state.op as string,
          preset.value
        );
        this.nav.rebuild("operation");
      });
    }
  }

  private buildMoveInput(page: any): void {
    const p = this.nav.state.projection as ProjectionData;
    if (!p) {
      page.label("数据丢失");
      return;
    }
    const s = p.settings;
    const offsetX = obsNum(s.offsetX);
    const offsetY = obsNum(s.offsetY);
    const offsetZ = obsNum(s.offsetZ);
    page.slider("X 偏移", offsetX, -64, 64);
    page.slider("Y 偏移", offsetY, -64, 64);
    page.slider("Z 偏移", offsetZ, -64, 64);
    page.button("确认", () => {
      const x = offsetX.getData(),
        y = offsetY.getData(),
        z = offsetZ.getData();
      if (x !== s.offsetX || y !== s.offsetY || z !== s.offsetZ)
        HoloCore.executeOperation(this.player, p.id, "move", { x, y, z });
      this.nav.rebuild("operation");
    });
  }

  private buildLayerMode(page: any): void {
    const p = this.nav.state.projection as ProjectionData;
    const index = obsNum(0);
    page.dropdown("选择层模式", index, [
      { label: "全部", value: 0 },
      { label: "单层", value: 1 },
      { label: "范围", value: 2 },
    ]);
    page.button("确认", () => {
      const mode = index.getData() === 0 ? "all" : index.getData() === 1 ? "single" : "range";
      HoloCore.executeOperation(this.player, p?.id, "set_layer_mode", mode);
      this.nav.rebuild("operation");
    });
  }
}
