import { useMemo, useState } from "react";

declare global {
  interface ImportMeta {
    readonly env: {
      SSG_MD?: boolean;
      [key: string]: unknown;
    };
  }
}

export type TroubleshootStep = {
  text: string;
  code?: string;
  href?: string;
  hrefLabel?: string;
};

export type TroubleshootNode = {
  id: string;
  title: string;
  steps: TroubleshootStep[];
};

export type TroubleshootTree = {
  title?: string;
  nodes: TroubleshootNode[];
};

type Props = {
  tree: TroubleshootTree;
};

export default function TroubleshootWizard({ tree }: Props) {
  const nodes = tree.nodes ?? [];
  const [active, setActive] = useState(nodes[0]?.id ?? "");
  const current = useMemo(
    () => nodes.find((n) => n.id === active) ?? nodes[0],
    [nodes, active]
  );

  if (import.meta.env.SSG_MD) {
    const md = nodes
      .map((n) => {
        const steps = n.steps
          .map((s, i) => {
            const code = s.code ? `\n\n\`\`\`bash\n${s.code}\n\`\`\`\n` : "";
            return `${i + 1}. ${s.text}${code}`;
          })
          .join("\n");
        return `### ${n.title}\n\n${steps}`;
      })
      .join("\n\n");
    return <>{`\n\n${md}\n`}</>;
  }

  if (!current) return null;

  return (
    <div className="sfmc-troubleshoot">
      <div className="sfmc-troubleshoot__choices" role="listbox" aria-label="症状">
        {nodes.map((n) => (
          <button
            key={n.id}
            type="button"
            aria-pressed={n.id === current.id}
            onClick={() => setActive(n.id)}
          >
            {n.title}
          </button>
        ))}
      </div>
      <div className="sfmc-troubleshoot__panel">
        <h3>{current.title}</h3>
        <ol className="sfmc-troubleshoot__steps">
          {current.steps.map((s, i) => (
            <li key={i}>
              <span>{s.text}</span>
              {s.href ? (
                <>
                  {" "}
                  <a href={s.href}>{s.hrefLabel ?? s.href}</a>
                </>
              ) : null}
              {s.code ? (
                <pre>
                  <code>{s.code}</code>
                </pre>
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
