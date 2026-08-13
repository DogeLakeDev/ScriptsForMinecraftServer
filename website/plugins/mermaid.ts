import path from "node:path";
import { fileURLToPath } from "node:url";
import type { RspressPlugin } from "@rspress/core";
import { RemarkCodeBlockToGlobalComponentPluginFactory } from "rspress-plugin-devkit";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * 用站点自研 MermaidDiagram 替换 rspress-plugin-mermaid 默认渲染，
 * 以支持浅/深色 base 主题与品牌色。
 */
export function pluginSfmcMermaid(): RspressPlugin {
  const factory = new RemarkCodeBlockToGlobalComponentPluginFactory({
    components: [
      {
        lang: "mermaid",
        componentPath: path.join(__dirname, "../components/MermaidDiagram.tsx"),
        childrenProvider() {
          return [];
        },
        propsProvider(code: string) {
          return { code };
        },
      },
    ],
  });

  return {
    name: "sfmc-mermaid",
    markdown: {
      remarkPlugins: [factory.remarkPlugin],
      globalComponents: factory.mdxComponents,
    },
    builderConfig: factory.builderConfig,
  };
}
