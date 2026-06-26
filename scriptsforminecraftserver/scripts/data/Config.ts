import { Direction } from "@minecraft/server";

/**
 * 其他设置
 */
export const Config = {
  // 生存飞行区
  flyArea: [
    {
      "name": "",
      "dimension": "minecraft:overworld",
      "start": [951, -2715] as [number, number],
      "end": [4604, 5628] as [number, number]
    }
  ] as { name: string; dimension: string; start: [number, number]; end: [number, number] }[],
  // 和平区域
  peaceArea: [
    {
      "dimension": "minecraft:overworld",
      "start": [951, -2715] as [number, number],
      "end": [4604, 5628] as [number, number]
    }
  ] as { dimension: string; start: [number, number]; end: [number, number] }[],
  // AFK等待时间 秒
  AFKTime: 120,
  // 答题设置
  QAInterval: [600, 720] as [number, number], // 从一题结束到下一题开始的时间区间（秒）
  QATimeout: 60, // 答题限时
  // 掉落物清理设置
  clean: {
    itemMax: 192, // 掉落物清理阈值
    timeout: 60, // 扫描间隔时间(秒)
    recycleBin: {
      start: [-89, -59, -72] as [number, number, number], // 起点
      size: [5, 5] as [number, number], // 单元个数，因为是一面箱子，所以必须有一个方向为 1 或 -1，正负代指箱子的朝向。
      direction: -1, // 增长方向，1/-1为x轴正/负方向，2/-2为z轴正/负方向
      face: -1, // 箱子面朝的方向，direction为x/z时，[箱子面前的方块的x/z轴坐标] 等于 [箱子的x/z轴坐标]+[face的值]
      // 直接清除的物品种类
      killList: [
        'shitcraft:shit'
      ] as string[]
    }
  }
}
