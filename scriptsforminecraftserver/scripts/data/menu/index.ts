import { main, MenuData } from "./main";
import { ad1, AdMenuData } from "./ad1";
import { more, MoreMenuData } from "./more";
import { tp, TpMenuData } from "./tp";

export type FormDataMap = MenuData | AdMenuData | MoreMenuData | TpMenuData;

// 名称: 表单数据
export const forms: Record<string, FormDataMap> = {
    "main": main,
    "ad1": ad1,
    "more": more,
    "tp": tp
};

// 必须要是点击方块后有挥动动作的物品，建议使用额外添加的物品
export const menuItems: string[] = ["minecraft:brush"];
