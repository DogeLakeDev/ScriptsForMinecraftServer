# area 服务（manifest.id: feature-area）

安装 id：`area` · npm：`@sfmc-bds/module-area`

区域功能（和平 / 飞行 / 生存 / 创造 / 清理等）合一模块；区域定义读 `configs/area.json`。

## Service 名

| 名称 | 输入 | 输出 |
|------|------|------|
| `area.byName` | `name` | 区域对象 |
| `area.byPoint` | `dimension,x,z`；可选 `feature` | 区域对象 |

```ts
const area = await service.get("area.byPoint", {
  dimension: "overworld",
  x: 0,
  z: 0,
  feature: "peace",
});
```
