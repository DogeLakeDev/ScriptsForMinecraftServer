/* ---------------------------------------- *\
 *  Holoprint — GUI 界面
\* ---------------------------------------- */
import { CustomForm } from "@minecraft/server-ui";
import { Gui, ObservableString, ObservableNumber } from "../libs/Gui";
import { HoloCore } from "./HoloCore";
import { HoloEntity } from "./HoloEntity";
import { COLOR_PRESETS } from "../data/HoloPrint";
import { Command } from "../libs/Command";
export class HoloGUI {
    static registerCommand() {
        Command.register("holorint", "holorint.menu", (player) => {
            if (player)
                HoloGUI.showMainMenu(player);
        }, "全息投影");
        Command.register("hpbe pos1", "holorint.pos1", (player) => {
            if (player)
                HoloCore.setPos(player, 1);
        }, "设置选区点1");
        Command.register("hpbe pos2", "holorint.pos2", (player) => {
            if (player)
                HoloCore.setPos(player, 2);
        }, "设置选区点2");
    }
    // ══════════════════════════════════════
    //  1. 主菜单
    // ══════════════════════════════════════
    static showMainMenu(player) {
        const form = new CustomForm(player, "全息投影")
            .label("选择一个操作：")
            .button("📤 上传投影", () => {
            player.sendMessage("§a[HPBE] 请使用 §e!hpbe pos1 §a和 §e!hpbe pos2 §a设置选区，然后使用 §e!hpbe§a 打开菜单选择上传");
            HoloGUI.showUploadConfig(player);
        })
            .button("📥 加载投影", () => {
            HoloCore.loadProjectionList(player);
        })
            .closeButton();
        Gui.showForm(player, form, "全息投影");
    }
    // ══════════════════════════════════════
    //  2. 上传配置
    // ══════════════════════════════════════
    static async showUploadConfig(player) {
        const name = new ObservableString("");
        const author = new ObservableString(player.name);
        const description = new ObservableString("");
        const visibilityIndex = new ObservableNumber(0);
        const form = new CustomForm(player, "上传投影")
            .textField("§a投影名称", name, { description: "请输入投影名称…" })
            .textField("§a作者", author, { description: "作者名" })
            .textField("§7描述（可选）", description, { description: "请输入描述…" })
            .dropdown("§a可见性", visibilityIndex, [
            { label: "公共", value: 0 },
            { label: "私人", value: 1 },
        ])
            .button("确认上传", () => {
            HoloCore.startUpload(player, {
                name: name.getData(),
                author: author.getData(),
                description: description.getData(),
                visibility: visibilityIndex.getData() === 0 ? "public" : "private",
            });
        })
            .closeButton();
        await Gui.showForm(player, form, "上传投影");
    }
    // ══════════════════════════════════════
    //  3. 投影列表
    // ══════════════════════════════════════
    static async showProjectionList(player, privateList, publicList) {
        const form = new CustomForm(player, "加载投影")
            .button("§l=== 我的投影 ===", () => {
            this.showProjectionList(player, privateList, publicList);
        });
        for (const p of privateList) {
            form.button(`${p.name} - ${p.sizeX}x${p.sizeY}x${p.sizeZ} [${p.blockCount}方块]`, () => {
                Gui.confirm(player, "放置投影", "是否将投影放置在当前位置？", () => {
                    HoloEntity.spawnProjection(player, p.id, player.location);
                });
            });
        }
        form.button("§l=== 公共投影 ===", () => {
            this.showProjectionList(player, privateList, publicList);
        });
        for (const p of publicList) {
            form.button(`${p.name} - ${p.sizeX}x${p.sizeY}x${p.sizeZ} [${p.blockCount}方块]`, () => {
                Gui.confirm(player, "放置投影", "是否将投影放置在当前位置？", () => {
                    HoloEntity.spawnProjection(player, p.id, player.location);
                });
            });
        }
        form.closeButton();
        await Gui.showForm(player, form, "加载投影");
    }
    // ══════════════════════════════════════
    //  4. 操作菜单
    // ══════════════════════════════════════
    static async showOperationMenu(player, projection) {
        const s = projection.settings;
        const form = new CustomForm(player, `操作 - ${projection.name}`)
            .button("🧱 物品清单", () => {
            HoloCore.executeOperation(player, projection.id, "materials");
        })
            .button(`👁 显示/隐藏 (当前: ${s.visible ? "显示" : "隐藏"})`, () => {
            HoloCore.executeOperation(player, projection.id, "toggle_visibility");
        })
            .button(`📐 比例 (当前: ${s.scale})`, async () => {
            const val = await HoloGUI.showNumberInput(player, "设置比例", s.scale, 0.1, 10);
            if (val !== null)
                HoloCore.executeOperation(player, projection.id, "set_scale", val);
        })
            .button(`🎨 纹理轮廓宽度 (当前: ${s.textureOutlineWidth})`, async () => {
            const val = await HoloGUI.showNumberInput(player, "设置纹理轮廓宽度", s.textureOutlineWidth, 0, 10);
            if (val !== null)
                HoloCore.executeOperation(player, projection.id, "set_texture_outline_width", val);
        })
            .button("🎨 纹理轮廓颜色", async () => {
            const color = await HoloGUI.showColorPicker(player, "选择纹理轮廓颜色");
            if (color !== null)
                HoloCore.executeOperation(player, projection.id, "set_texture_outline_color", color);
        })
            .button(`🎨 纹理轮廓透明度 (当前: ${s.textureOutlineOpacity})`, async () => {
            const val = await HoloGUI.showNumberInput(player, "设置纹理轮廓透明度", s.textureOutlineOpacity, 0, 1);
            if (val !== null)
                HoloCore.executeOperation(player, projection.id, "set_texture_outline_opacity", val);
        })
            .button("🌈 叠加染色", async () => {
            const color = await HoloGUI.showColorPicker(player, "选择叠加染色颜色");
            if (color !== null)
                HoloCore.executeOperation(player, projection.id, "set_overlay_tint", color);
        })
            .button(`🌈 叠加染色透明度 (当前: ${s.overlayTintOpacity})`, async () => {
            const val = await HoloGUI.showNumberInput(player, "设置叠加染色透明度", s.overlayTintOpacity, 0, 1);
            if (val !== null)
                HoloCore.executeOperation(player, projection.id, "set_overlay_tint_opacity", val);
        })
            .button(`▶ 生成动画 (当前: ${s.spawnAnimation ? "开" : "关"})`, () => {
            HoloCore.executeOperation(player, projection.id, "toggle_spawn_animation");
        })
            .button(`🔆 透明度 (当前: ${s.opacity})`, async () => {
            const val = await HoloGUI.showNumberInput(player, "设置透明度", s.opacity, 0, 1);
            if (val !== null)
                HoloCore.executeOperation(player, projection.id, "set_opacity", val);
        })
            .button(`📊 层级 (当前: ${s.layer})`, async () => {
            const val = await HoloGUI.showNumberInput(player, "设置层级", s.layer, -64, 320);
            if (val !== null)
                HoloCore.executeOperation(player, projection.id, "set_layer", val);
        })
            .button("📏 移动", async () => {
            await HoloGUI.showMoveInput(player, projection);
        })
            .button(`🔄 旋转 (当前: ${s.rotation}°)`, async () => {
            const val = await HoloGUI.showNumberInput(player, "设置旋转角度", s.rotation, 0, 360);
            if (val !== null)
                HoloCore.executeOperation(player, projection.id, "set_rotation", val);
        })
            .button(`🔍 方块检查 (当前: ${s.blockInspect ? "开" : "关"})`, () => {
            HoloCore.executeOperation(player, projection.id, "toggle_block_inspect");
        })
            .button(`🎨 叠加染色开关 (当前: ${s.overlayTint ? "开" : "关"})`, () => {
            HoloCore.executeOperation(player, projection.id, "toggle_overlay_tint");
        })
            .button(`📋 层模式 (当前: ${s.layerMode === "all" ? "全部" : s.layerMode === "single" ? "单层" : "范围"})`, async () => {
            await HoloGUI.showLayerModePicker(player, projection);
        })
            .button("❌ 删除投影", () => {
            Gui.confirm(player, "删除投影", "确定要删除此投影吗？此操作不可撤销。", () => {
                HoloCore.executeOperation(player, projection.id, "delete");
            });
        })
            .button("🔄 更换投影", () => {
            HoloCore.loadProjectionList(player);
        })
            .closeButton();
        await Gui.showForm(player, form, "操作菜单");
    }
    // ══════════════════════════════════════
    //  5. 物品清单
    // ══════════════════════════════════════
    static async showMaterialList(player, materials) {
        const sorted = [...materials].sort((a, b) => b.count - a.count);
        const form = new CustomForm(player, "物品清单")
            .label(`共 §e${sorted.length}§r 种材料`);
        const maxDisplay = 50;
        const displayItems = sorted.slice(0, maxDisplay);
        for (const m of displayItems) {
            form.label(`§7${m.count}§r x ${m.name}`);
        }
        if (sorted.length > maxDisplay) {
            form.label(`§8... 还有 ${sorted.length - maxDisplay} 种材料`);
        }
        form.closeButton();
        await Gui.showForm(player, form, "物品清单");
    }
    // ══════════════════════════════════════
    //  6. 颜色选择器
    // ══════════════════════════════════════
    static async showColorPicker(player, title) {
        let result = null;
        const form = new CustomForm(player, title)
            .label("选择一个颜色预设：");
        for (const preset of COLOR_PRESETS) {
            form.button(`§l${preset.name}§r  ${preset.hex}`, () => {
                result = preset.value;
            });
        }
        form.closeButton();
        await Gui.showForm(player, form, title);
        return result;
    }
    // ══════════════════════════════════════
    //  7. 数字输入
    // ══════════════════════════════════════
    static async showNumberInput(player, title, defaultValue, min, max) {
        let result = null;
        const val = new ObservableNumber(defaultValue);
        const form = new CustomForm(player, title)
            .slider("数值", val, min ?? 0, max ?? 100, { step: 1 })
            .button("确认", () => { result = val.getData(); })
            .closeButton();
        await Gui.showForm(player, form, title);
        return result;
    }
    // ══════════════════════════════════════
    //  8. 版本警告
    // ══════════════════════════════════════
    static showVersionWarning(player) {
        Gui.confirm(player, "版本不匹配", "检测到插件版本与服务器端不匹配，部分投影可能无法正常显示。\n\n请重新加入游戏以获取更新后的投影。", () => {
            /* 确认关闭 */
        });
    }
    // ══════════════════════════════════════
    //  内部辅助 - 移动输入
    // ══════════════════════════════════════
    static async showMoveInput(player, projection) {
        const s = projection.settings;
        const offsetX = new ObservableNumber(s.offsetX);
        const offsetY = new ObservableNumber(s.offsetY);
        const offsetZ = new ObservableNumber(s.offsetZ);
        const form = new CustomForm(player, "移动投影")
            .slider("X 偏移", offsetX, -64, 64)
            .slider("Y 偏移", offsetY, -64, 64)
            .slider("Z 偏移", offsetZ, -64, 64)
            .button("确认", () => {
            const x = offsetX.getData();
            const y = offsetY.getData();
            const z = offsetZ.getData();
            if (x === s.offsetX && y === s.offsetY && z === s.offsetZ)
                return;
            HoloCore.executeOperation(player, projection.id, "move", { x, y, z });
        })
            .closeButton();
        await Gui.showForm(player, form, "移动投影");
    }
    // ══════════════════════════════════════
    //  内部辅助 - 层模式选择
    // ══════════════════════════════════════
    static async showLayerModePicker(player, projection) {
        const index = new ObservableNumber(0);
        const form = new CustomForm(player, "层模式")
            .dropdown("选择层模式", index, [
            { label: "全部", value: 0 },
            { label: "单层", value: 1 },
            { label: "范围", value: 2 },
        ])
            .button("确认", () => {
            const mode = index.getData() === 0 ? "all" : index.getData() === 1 ? "single" : "range";
            HoloCore.executeOperation(player, projection.id, "set_layer_mode", mode);
        })
            .closeButton();
        await Gui.showForm(player, form, "层模式");
    }
}
//# sourceMappingURL=HoloGUI.js.map