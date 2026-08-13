import { useCallback, useEffect, useId, useState } from "react";
import mermaid from "mermaid";
import type { MermaidConfig } from "mermaid";

type Props = {
  code: string;
};

const lightTheme: MermaidConfig["themeVariables"] = {
  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif',
  fontSize: "14px",
  primaryColor: "#e8f0fe",
  primaryTextColor: "#0f172a",
  primaryBorderColor: "#2f6fed",
  secondaryColor: "#f8fafc",
  tertiaryColor: "#f1f5f9",
  lineColor: "#64748b",
  textColor: "#0f172a",
  mainBkg: "#e8f0fe",
  nodeBorder: "#2f6fed",
  clusterBkg: "#f8fafc",
  clusterBorder: "#cbd5e1",
  titleColor: "#0f172a",
  edgeLabelBackground: "#ffffff",
};

const darkTheme: MermaidConfig["themeVariables"] = {
  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif',
  fontSize: "14px",
  primaryColor: "#1e3a5f",
  primaryTextColor: "#e2e8f0",
  primaryBorderColor: "#60a5fa",
  secondaryColor: "#0f172a",
  tertiaryColor: "#1e293b",
  lineColor: "#94a3b8",
  textColor: "#e2e8f0",
  mainBkg: "#1e3a5f",
  nodeBorder: "#60a5fa",
  clusterBkg: "#0f172a",
  clusterBorder: "#334155",
  titleColor: "#e2e8f0",
  edgeLabelBackground: "#0f172a",
};

function isDarkMode() {
  return document.documentElement.classList.contains("dark");
}

export default function MermaidDiagram({ code }: Props) {
  const reactId = useId();
  const [svg, setSvg] = useState("");
  const [error, setError] = useState<string | null>(null);

  const render = useCallback(async () => {
    const dark = isDarkMode();
    const config: MermaidConfig = {
      securityLevel: "loose",
      startOnLoad: false,
      theme: "base",
      themeVariables: dark ? darkTheme : lightTheme,
      flowchart: {
        curve: "basis",
        padding: 14,
        nodeSpacing: 48,
        rankSpacing: 48,
        htmlLabels: true,
        useMaxWidth: true,
      },
      sequence: {
        actorMargin: 28,
        messageMargin: 36,
        mirrorActors: false,
      },
    };

    try {
      mermaid.initialize(config);
      const id = `sfmc-mermaid-${reactId.replace(/:/g, "")}`;
      const { svg: next } = await mermaid.render(id, code);
      setSvg(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mermaid render failed");
      setSvg("");
    }
  }, [code, reactId]);

  useEffect(() => {
    void render();
  }, [render]);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      void render();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, [render]);

  if (import.meta.env.SSG_MD) {
    return <>{`\n\`\`\`mermaid\n${code}\n\`\`\`\n`}</>;
  }

  if (error) {
    return (
      <div className="sfmc-mermaid sfmc-mermaid--error">
        <pre>
          <code>{code}</code>
        </pre>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div
      className="sfmc-mermaid"
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
    />
  );
}
