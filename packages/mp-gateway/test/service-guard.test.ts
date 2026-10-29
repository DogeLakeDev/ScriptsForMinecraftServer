/**
 * service-guard.test.ts — 网关启动时拉起依赖服务
 *
 * 守卫逻辑用内存 ServiceControl 验证；openCliServiceControl 用一个按管理协议应答的假 CLI 验证子进程与帧往返。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { MANAGEMENT_PROTOCOL_VERSION, type ServiceStatusRow } from "@sfmc-bds/management";
import { parseStartServices } from "../src/config.js";
import { openCliServiceControl, startServiceGuard, type ServiceControl } from "../src/service-guard.js";

/** 测试里缩短的等待参数 */
const FAST = { retryBaseMs: 10, retryMaxMs: 40, startTimeoutMs: 500, pollMs: 5 };

/**
 * 内存服务表：start 后经过 delayPolls 次 list 才变为运行，模拟守护进程后台启动。
 * failOpens 次 open 直接失败，模拟守护进程未就绪。
 */
function memoryControl(initial: Record<string, boolean>, options: { delayPolls?: number; failOpens?: number } = {}) {
  const running = { ...initial };
  const countdown = new Map<string, number>();
  const calls = { opens: 0, starts: [] as string[], closes: 0 };
  let failOpens = options.failOpens ?? 0;
  const row = (name: string): ServiceStatusRow => ({ name: name as ServiceStatusRow["name"], title: name, running: running[name]!, pid: running[name] ? 1 : 0, uptime: "" });
  const open = async (): Promise<ServiceControl> => {
    calls.opens++;
    if (failOpens > 0) {
      failOpens--;
      throw new Error("守护进程未就绪");
    }
    return {
      list: async () => {
        for (const [name, left] of countdown) {
          if (left <= 0) {
            running[name] = true;
            countdown.delete(name);
          } else countdown.set(name, left - 1);
        }
        return Object.keys(running).map(row);
      },
      start: async (name) => {
        calls.starts.push(name);
        countdown.set(name, options.delayPolls ?? 0);
      },
      close: () => {
        calls.closes++;
      },
    };
  };
  return { open, calls, running };
}

test("parseStartServices：逗号分隔、去重、none 关闭", () => {
  assert.deepEqual(parseStartServices("db"), ["db"]);
  assert.deepEqual(parseStartServices(" db , qq,db,, "), ["db", "qq"]);
  assert.deepEqual(parseStartServices("none"), []);
  assert.deepEqual(parseStartServices("NONE"), []);
  assert.deepEqual(parseStartServices(""), []);
});

test("db 未运行时拉起并等到运行", async () => {
  const fake = memoryControl({ bds: false, db: false }, { delayPolls: 3 });
  const logs: string[] = [];
  await startServiceGuard({ names: ["db"], open: fake.open, log: (m) => logs.push(m), ...FAST }).done;
  assert.deepEqual(fake.calls.starts, ["db"]);
  assert.equal(fake.running.db, true);
  assert.equal(fake.running.bds, false, "只拉起配置的服务");
  assert.equal(fake.calls.closes, 1);
  assert.match(logs.at(-1)!, /已拉起依赖服务: db/);
});

test("服务已在运行时不提交启动", async () => {
  const fake = memoryControl({ db: true });
  const logs: string[] = [];
  await startServiceGuard({ names: ["db"], open: fake.open, log: (m) => logs.push(m), ...FAST }).done;
  assert.deepEqual(fake.calls.starts, []);
  assert.match(logs.at(-1)!, /依赖服务已在运行/);
});

test("不认识的服务名记日志后忽略，不无限重试", async () => {
  const fake = memoryControl({ db: false });
  const logs: string[] = [];
  await startServiceGuard({ names: ["dbx", "db"], open: fake.open, log: (m) => logs.push(m), ...FAST }).done;
  assert.deepEqual(fake.calls.starts, ["db"]);
  assert.ok(logs.some((m) => m.includes("没有名为 dbx 的服务")));
  assert.equal(fake.calls.opens, 1);
});

test("守护进程未就绪时退避重试直到成功", async () => {
  const fake = memoryControl({ db: false }, { failOpens: 2 });
  const logs: string[] = [];
  await startServiceGuard({ names: ["db"], open: fake.open, log: (m) => logs.push(m), ...FAST }).done;
  assert.equal(fake.calls.opens, 3);
  assert.equal(logs.filter((m) => m.includes("秒后重试")).length, 2);
  assert.equal(fake.running.db, true);
});

test("启动后一直不运行则超时并重试，stop 结束守卫", async () => {
  const fake = memoryControl({ db: false }, { delayPolls: Number.MAX_SAFE_INTEGER });
  const logs: string[] = [];
  const guard = startServiceGuard({ names: ["db"], open: fake.open, log: (m) => logs.push(m), ...FAST, startTimeoutMs: 20, retryBaseMs: 60_000 });
  while (!logs.some((m) => m.includes("等待超时"))) await new Promise((r) => setTimeout(r, 5));
  guard.stop();
  await guard.done;
  assert.equal(fake.calls.opens, 1, "停止后不再重试");
  assert.equal(fake.calls.closes, 1);
});

test("names 为空时不打开管理通道", async () => {
  const fake = memoryControl({ db: false });
  await startServiceGuard({ names: [], open: fake.open, log: () => {}, ...FAST }).done;
  assert.equal(fake.calls.opens, 0);
});

let workDir = "";
let fakeCli = "";

before(() => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-guard-test-"));
  fakeCli = path.join(workDir, "fake-manage.mjs");
  // 假 CLI：按管理协议应答 handshake / services.list / services.start，start 后服务立即运行
  fs.writeFileSync(
    fakeCli,
    [
      'import readline from "node:readline";',
      "const state = { bds: false, db: false };",
      "const rl = readline.createInterface({ input: process.stdin });",
      "rl.on('line', (line) => {",
      "  const req = JSON.parse(line);",
      "  let result;",
      `  if (req.method === 'handshake') result = { protocolVersion: ${MANAGEMENT_PROTOCOL_VERSION}, root: req.params.root, args: process.argv.slice(2) };`,
      "  else if (req.method === 'services.list') result = { rows: Object.entries(state).map(([name, running]) => ({ name, title: name, running, pid: running ? 1 : 0, uptime: '' })) };",
      "  else if (req.method === 'services.start') { state[req.params.name] = true; result = { operationId: 'op-1' }; }",
      "  process.stdout.write(JSON.stringify({ type: 'res', id: req.id, ok: true, result }) + '\\n');",
      "});",
    ].join("\n"),
  );
});

after(() => {
  fs.rmSync(workDir, { recursive: true, force: true });
});

test("openCliServiceControl 经 manage --stdio 子进程查询与启动服务", async () => {
  const control = await openCliServiceControl({ node: process.execPath, entry: fakeCli, root: workDir });
  try {
    assert.deepEqual((await control.list()).map((row) => [row.name, row.running]), [["bds", false], ["db", false]]);
    await control.start("db");
    assert.equal((await control.list()).find((row) => row.name === "db")?.running, true);
  } finally {
    control.close();
  }
});

test("openCliServiceControl 在 CLI 退出时报错而不是挂起", async () => {
  const broken = path.join(workDir, "exit.mjs");
  fs.writeFileSync(broken, "process.exit(3);\n");
  await assert.rejects(openCliServiceControl({ node: process.execPath, entry: broken, root: workDir }), /管理通道已退出|连接/);
});
