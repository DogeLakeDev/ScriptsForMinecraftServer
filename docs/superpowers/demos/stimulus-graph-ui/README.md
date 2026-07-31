# 刺激剧本 UI 示例（非扩展本体）

技术栈示意：React + [@xyflow/react](https://reactflow.dev/) + Radix Dropdown + 自绘 VS Code 皮。

> 仓库路径含 `#`（`#WorkPlace`）时 Vite 会把 URL 截断导致白屏。请先拷到无 `#` 目录再跑，或直接用下面命令。

```powershell
$dest = "$env:TEMP\sfmc-stimulus-graph-ui"
Copy-Item -Recurse -Force "docs/superpowers/demos/stimulus-graph-ui" $dest
Set-Location $dest
npm install
npm run dev -- --host 127.0.0.1
```

浏览器打开 `http://127.0.0.1:5179/`。

可试：拖节点 / 连线、左侧加节点、顶栏 **运行 ▾**（整图 / 从选中 / 仅选中）看高亮。此页不接 `playground-host`。
