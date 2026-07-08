/* ---------------------------------------- *\
 *  合作社数据存储层
 *  使用 Storage 缓存 + HttpDB 持久化
\* ---------------------------------------- */
export class Database {
    static readJSON(key, fallback) {
        if (this.memoryStore.has(key))
            return this.memoryStore.get(key);
        this.memoryStore.set(key, fallback);
        return fallback;
    }
    static writeJSON(key, value) {
        this.memoryStore.set(key, value);
    }
    // ==========================================
    //  配置
    // ==========================================
    static getConfig() {
        if (this._config)
            return this._config;
        this._config = this.readJSON(this.KEY_COOP_CONFIG, {
            main: { language: "zh_CN", compare_language: "zh" },
            shop_setting: {
                monetary_unit: "¥",
                nbtgoods_condition: {
                    type_enum: ["minecraft:writable_book", "minecraft:field_masoned_banner_pattern", "minecraft:filled_map"],
                    mode_enum: ["it.isEnchanted"],
                    type_reg_enum: ["[a-z].+_shulker_box"],
                },
            },
        });
        return this._config;
    }
    static saveConfig(cfg) {
        this._config = cfg;
        this.writeJSON(this.KEY_COOP_CONFIG, cfg);
    }
    // ==========================================
    //  合作社数据
    // ==========================================
    static getAllCoop() {
        return this.readJSON(this.KEY_COOP_DATA, []);
    }
    static getCoopByCid(cid) {
        return this.getAllCoop().find((e) => e.cid === cid);
    }
    static getPlayerCid(playerName) {
        for (const coop of this.getAllCoop()) {
            if (coop.members.some((m) => m.name === playerName))
                return coop.cid;
        }
        return null;
    }
    static saveCoop(data) {
        const all = this.getAllCoop();
        const idx = all.findIndex((e) => e.cid === data.cid);
        if (idx !== -1)
            all[idx] = data;
        else
            all.push(data);
        this.writeJSON(this.KEY_COOP_DATA, all);
    }
    static deleteCoop(cid) {
        this.writeJSON(this.KEY_COOP_DATA, this.getAllCoop().filter((e) => e.cid !== cid));
    }
    // ==========================================
    //  商店商品
    // ==========================================
    static getAllGoods() {
        return this.readJSON(this.KEY_SHOP_GOODS, []);
    }
    static getGoodById(id) {
        return this.getAllGoods().find((e) => e.id === id);
    }
    static saveGood(good) {
        const all = this.getAllGoods();
        const idx = all.findIndex((e) => e.id === good.id);
        if (idx !== -1)
            all[idx] = good;
        else {
            good.id = good.id || `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
            all.push(good);
        }
        this.writeJSON(this.KEY_SHOP_GOODS, all);
    }
    static deleteGood(id) {
        this.writeJSON(this.KEY_SHOP_GOODS, this.getAllGoods().filter((e) => e.id !== id));
    }
    static deleteGoodsByCid(cid) {
        this.writeJSON(this.KEY_SHOP_GOODS, this.getAllGoods().filter((e) => e.cid !== cid));
    }
    // ==========================================
    //  商店分组
    // ==========================================
    static getAllGroups() {
        return this.readJSON(this.KEY_SHOP_GROUPS, []);
    }
    static getGroupById(groupid) {
        return this.getAllGroups().find((e) => e.groupid === groupid);
    }
    static saveGroup(group) {
        const all = this.getAllGroups();
        const idx = all.findIndex((e) => e.groupid === group.groupid);
        if (idx !== -1)
            all[idx] = group;
        else
            all.push(group);
        this.writeJSON(this.KEY_SHOP_GROUPS, all);
    }
    // ==========================================
    //  初始化
    // ==========================================
    static initDefaultGroups() {
        if (this.getAllGroups().length > 0)
            return;
        const defaults = [
            {
                groupid: "default_block",
                displayname: "默认方块",
                displaydescribe: "方块类物品",
                icon: "/textures/ui/icon_recipe_construction",
                type_function: { mode_enum: ["default_block"] },
            },
            {
                groupid: "default_item",
                displayname: "默认物品",
                displaydescribe: "物品类",
                icon: "/textures/ui/icon_recipe_item",
                type_function: { mode_enum: ["default_item"] },
            },
            {
                groupid: "default_equip",
                displayname: "默认装备",
                displaydescribe: "装备武器类",
                icon: "/textures/ui/icon_recipe_equipment",
                type_function: {
                    type_enum: [
                        "minecraft:bow",
                        "minecraft:arrow",
                        "minecraft:crossbow",
                        "minecraft:trident",
                        "minecraft:shield",
                        "minecraft:mace",
                        "minecraft:elytra",
                        "minecraft:wolf_armor",
                        "minecraft:saddle",
                    ],
                    type_reg_enum: [
                        "[a-z].+_shovel",
                        "[a-z].+_axe",
                        "[a-z].+_sword",
                        "[a-z].+_hoe",
                        "[a-z].+_pickaxe",
                        "[a-z].+_horse_armor",
                    ],
                },
            },
            {
                groupid: "default_book",
                displayname: "书籍",
                displaydescribe: "与书相关",
                icon: "/textures/items/book_enchanted",
                type_function: {
                    type_enum: [
                        "minecraft:book",
                        "minecraft:bookshelf",
                        "minecraft:writable_book",
                        "minecraft:enchanted_book",
                        "minecraft:chiseled_bookshelf",
                    ],
                },
            },
            {
                groupid: "default_shulker_box",
                displayname: "潜影盒",
                displaydescribe: "各种潜影盒",
                icon: "/textures/items/shulker_shell",
                type_function: { type_reg_enum: ["[a-z].+_shulker_box"] },
            },
            {
                groupid: "default_potion",
                displayname: "药水",
                displaydescribe: "药水类",
                icon: "/textures/items/potion_bottle_heal",
                type_function: { type_enum: ["minecraft:splash_potion", "minecraft:potion", "minecraft:lingering_potion"] },
            },
        ];
        for (const g of defaults)
            this.saveGroup(g);
    }
}
// ==========================================
//  内部工具 — 内存 KV 存储（会话级持久化）
// ==========================================
Database.memoryStore = new Map();
Database.KEY_COOP_DATA = "coop:data";
Database.KEY_COOP_CONFIG = "coop:config";
Database.KEY_SHOP_GOODS = "coop:shopgoods";
Database.KEY_SHOP_GROUPS = "coop:shopgroups";
Database._config = null;
//# sourceMappingURL=Database.js.map