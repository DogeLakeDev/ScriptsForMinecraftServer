export interface FlyArea {
    name: string;
    dimension: string;
    start: [number, number];
    end: [number, number];
}

export interface PeaceArea {
    dimension: string;
    start: [number, number];
    end: [number, number];
}

export const Config: {
    ITEMMAX: number;
    flyArea: FlyArea[];
    peaceArea: PeaceArea[];
    AFKTime: number;
    QAInterval: [number, number];
    QATimeout: number;
} = {
    ITEMMAX: 100,
    flyArea: [
        {
            "name": "",
            "dimension": "minecraft:overworld",
            "start": [951, -2715],
            "end": [4604, 5628]
        }
    ],
    peaceArea: [
        {
            "dimension": "minecraft:overworld",
            "start": [951, -2715],
            "end": [4604, 5628]
        }
    ],
    AFKTime: 120,
    QAInterval: [300, 360],
    QATimeout: 60
};
