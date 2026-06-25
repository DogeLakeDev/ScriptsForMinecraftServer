import { MenuButton } from "./main";

export interface AdMenuData {
    type: "button";
    op: "false";
    title: string;
    content: string;
    buttons: MenuButton[];
    exit: {
        type: string;
        run: string;
    };
}

export const ad1: AdMenuData = {
    "type": "button",
    "op": "false",
    "title": "/A textures/menu/ad_1.png",
    "content": "",
    "buttons": [
        {
            "title": "",
            "image": "",
            "onClick": {}
        }
    ],
    "exit": {
        "type": "",
        "run": ""
    }
};
