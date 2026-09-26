/**
 * account-format.ts — QQ「我的账号」正文。
 *
 * 已绑定时用 Markdown 表格列出余额和在线时长；纯文本保留同样的字段，供 Markdown 发送失败时降级。
 */

export type AccountProfileView = {
  unit?: string;
  balance?: number | null;
  today_text?: string;
  month_text?: string;
  total_text?: string;
};

function cell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim() || "—";
}

function balanceText(profile: AccountProfileView): string {
  if (profile.balance == null) return "暂时读不到";
  const unit = profile.unit?.trim() || "节操";
  return `${profile.balance} ${unit}`;
}

/** 账号页的纯文本和 Markdown。未绑定或旧接口没有 profile 时不编造数字。 */
export function formatAccountCard(opts: {
  bound: boolean;
  playerName?: string;
  profile?: AccountProfileView | null;
}): { text: string; markdown: string } {
  if (!opts.bound) {
    const text = ["我的账号", "", "绑定状态：未绑定"].join("\n");
    return { text, markdown: ["## 我的账号", "", "绑定状态：未绑定"].join("\n") };
  }
  const name = opts.playerName?.trim() || "未命名角色";
  const head = ["绑定状态：已绑定", `游戏角色：${name}`];
  if (!opts.profile) {
    const text = ["我的账号", "", ...head].join("\n");
    return { text, markdown: ["## 我的账号", "", ...head].join("\n") };
  }
  const rows = [
    ["余额", balanceText(opts.profile)],
    ["今日在线", opts.profile.today_text || "暂时读不到"],
    ["本月在线", opts.profile.month_text || "暂时读不到"],
    ["累计在线", opts.profile.total_text || "暂时读不到"],
  ];
  const text = ["我的账号", "", ...head, "", ...rows.map(([label, value]) => `${label}：${value}`)].join("\n");
  const markdown = [
    "## 我的账号",
    "",
    ...head,
    "",
    "| 项目 | 数值 |",
    "| --- | --- |",
    ...rows.map(([label, value]) => `| ${cell(label ?? "")} | ${cell(value ?? "")} |`),
  ].join("\n");
  return { text, markdown };
}
