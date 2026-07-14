#!/usr/bin/env node
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const PORT = 3191;
const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'sfmc-db-api-'));
const dbPath = path.join(workspace, 'sfmc_data.db');

function copy(source, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function request(method, pathname, payload) {
  return new Promise((resolve, reject) => {
    const data = payload === undefined ? null : JSON.stringify(payload);
    const req = http.request({
      hostname: '127.0.0.1',
      port: PORT,
      path: pathname,
      method,
      headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {},
    }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { text += chunk; });
      res.on('end', () => {
        let body = {};
        try { body = JSON.parse(text); } catch {}
        resolve({ status: res.statusCode, body });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function waitForServer() {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    try {
      const result = await request('GET', '/api/health');
      if (result.status === 200) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error('db-server 启动超时');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`[db-api] PASS: ${message}`);
}

async function main() {
  copy(path.join(ROOT, 'modules', 'catalog.json'), path.join(workspace, 'modules', 'catalog.json'));
  copy(path.join(ROOT, 'modules', 'module-lock.json'), path.join(workspace, 'modules', 'module-lock.json'));
  fs.mkdirSync(path.join(workspace, 'configs'), { recursive: true });
  fs.writeFileSync(path.join(workspace, 'configs', 'db_config.json'), JSON.stringify({ db_port: PORT }) + '\n');

  const child = spawn(process.execPath, [path.join(ROOT, 'db-server', 'index.js')], {
    cwd: ROOT,
    env: { ...process.env, SFMC_ROOT: workspace, SFMC_DB_PATH: dbPath, SFMC_MODULES_DIR: path.join(workspace, 'modules'), DB_PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  try {
    await waitForServer();
    const health = await request('GET', '/api/health');
    assert(health.body.status === 'ok', 'health 路由返回 ok');

    const catalog = await request('GET', '/api/sfmc/modules/catalog');
    assert(catalog.status === 200 && catalog.body.modules.length === 29, '模块 catalog 路由返回 29 个模块');
    const modules = await request('GET', '/api/sfmc/modules');
    assert(modules.status === 200 && modules.body.modules.length === catalog.body.modules.length, '模块列表与 catalog 数量一致');

    const state = await request('GET', '/api/sfmc/setup/state');
    assert(state.status === 200 && typeof state.body.initialized === 'boolean', 'setup state 路由返回 initialized');
    const checks = await request('POST', '/api/sfmc/setup/check', { db: { port: PORT } });
    assert(checks.status === 200 && Array.isArray(checks.body.checks), 'setup check 路由返回 checks');

    const setting = await request('PUT', '/api/sfmc/settings/integration_test', { value: 'ok' });
    assert(setting.status === 200 && setting.body.success === true, 'settings PUT 路由成功');
    const settingRead = await request('GET', '/api/sfmc/settings/integration_test');
    assert(settingRead.status === 200 && settingRead.body.value === 'ok', 'settings GET 路由返回写入值');
    const updated = await request('GET', '/api/sfmc/configs/updated-since/0');
    assert(updated.status === 200 && updated.body.updated.settings, 'configs updated-since 路由返回 settings');

    const invalidImport = await request('POST', '/api/sfmc/configs/import', { table: 'unknown', rows: [{ value: 1 }] });
    assert(invalidImport.status === 400 && invalidImport.body.error === 'unknown_table', 'configs import 拒绝未知表');
    const missing = await request('GET', '/api/does-not-exist');
    assert(missing.status === 404 && missing.body.error === 'not_found', '未知路由返回 404');

    const land = { ownerId: 'player-1', ownerName: 'PlayerOne', dimid: 0, posA: { x: 0, y: 60, z: 0 }, posB: { x: 4, y: 70, z: 4 } };
    const funded = await request('POST', '/api/sfmc/economy/account', { actorId: 'admin', targetPlayerId: 'player-1', targetPlayerName: 'PlayerOne', amount: 10000, type: 'grant', reason: 'test setup' });
    assert(funded.status === 200 && funded.body.target?.balance === 10000, `经济账户可以原子发放余额 (${funded.status} ${JSON.stringify(funded.body)})`);
    const account = await request('GET', '/api/sfmc/economy/account?playerId=player-1');
    assert(account.status === 200 && account.body.account.balance === 10000, '经济账户查询返回余额');
    const insufficient = await request('POST', '/api/sfmc/economy/transfer', { actorId: 'player-1', targetPlayerId: 'player-2', amount: 20000 });
    assert(insufficient.status === 409 && insufficient.body.error === 'insufficient_funds', '经济事务拒绝透支');
    const forgedSource = await request('POST', '/api/sfmc/economy/account', { actorId: 'player-2', sourcePlayerId: 'player-1', targetPlayerId: 'player-2', amount: 1, type: 'debit' });
    assert(forgedSource.status === 403 && forgedSource.body.error === 'forbidden_source', '经济事务拒绝伪造扣款账户');
    const redpacket = { id: 'RP-test-1', senderid: 'player-1', senderName: 'PlayerOne', totalAmount: 300, remainingAmount: 300, totalCount: 2, remainingCount: 2, receivers: [], targetType: 'group', targetId: 'test', createdAt: Date.now(), expiresAt: Date.now() + 60000 };
    const redpacketCreate = await request('POST', '/api/sfmc/redpacket', { actorId: 'player-1', redpacket });
    assert(redpacketCreate.status === 200 && redpacketCreate.body.success && redpacketCreate.body.transactionId, '红包创建扣款和保存同一事务');
    const redpacketClaim = await request('POST', '/api/sfmc/redpacket/RP-test-1/claim', { actorId: 'player-2', actorName: 'PlayerTwo' });
    assert(redpacketClaim.status === 200 && redpacketClaim.body.success && redpacketClaim.body.amount > 0, '红包领取原子更新状态并离线入账');
    const redpacketReplay = await request('POST', '/api/sfmc/redpacket/RP-test-1/claim', { actorId: 'player-2', actorName: 'PlayerTwo' });
    assert(redpacketReplay.status === 409 && redpacketReplay.body.error === 'already_claimed', '红包重复领取被拒绝');
    const beforeTransfer = await request('GET', '/api/sfmc/economy/account?playerId=player-1');
    const beforeTransferTarget = await request('GET', '/api/sfmc/economy/account?playerId=player-2');
    const transfer = await request('POST', '/api/sfmc/economy/transfer', { actorId: 'player-1', targetPlayerId: 'player-2', amount: 1000 });
    assert(transfer.status === 200 && transfer.body.source.balance === beforeTransfer.body.account.balance - 1000 && transfer.body.target.balance === beforeTransferTarget.body.account.balance + 1000, '经济转账原子更新双方余额');
    const idempotentPayload = { actorId: 'player-1', targetPlayerId: 'player-2', amount: 250, idempotencyKey: 'test-transfer-1' };
    const idempotentFirst = await request('POST', '/api/sfmc/economy/transfer', idempotentPayload);
    const idempotentReplay = await request('POST', '/api/sfmc/economy/transfer', idempotentPayload);
    assert(idempotentFirst.status === 200 && idempotentReplay.status === 200 && idempotentReplay.body.replayed && idempotentReplay.body.transactionId === idempotentFirst.body.transactionId && idempotentReplay.body.source.balance === idempotentFirst.body.source.balance, '经济交易重试幂等且不重复扣款');
    const beforeLandPurchase = idempotentFirst.body.source.balance;
    const beforePlayerTwo = idempotentFirst.body.target.balance;
    const created = await request('POST', '/api/sfmc/lands', land);
    assert(created.status === 200 && created.body.land?.ownerplid === 'player-1' && created.body.price > 0, '土地创建并持久化');
    const afterPurchase = await request('GET', '/api/sfmc/economy/account?playerId=player-1');
    assert(afterPurchase.body.account.balance === beforeLandPurchase - created.body.price, '土地购买在同一事务中扣款');
    const overlap = await request('POST', '/api/sfmc/lands', { ...land, ownerId: 'player-2', ownerName: 'PlayerTwo' });
    assert(overlap.status === 409 && overlap.body.error === 'overlap', '土地重叠检查拒绝冲突范围');
    const at = await request('GET', '/api/sfmc/lands/at/0/2/65/2');
    assert(at.status === 200 && at.body.land.id === created.body.land.id, '按坐标查询土地');
    const batch = await request('POST', '/api/sfmc/lands/at-batch', { points: [{ dimid: 0, x: 2, y: 65, z: 2 }, { dimid: 0, x: 99, y: 65, z: 99 }] });
    assert(batch.status === 200 && batch.body.lands[0]?.id === created.body.land.id && batch.body.lands[1] === null, '批量按坐标查询土地');
    const changed = await request('PATCH', `/api/sfmc/lands/${encodeURIComponent(created.body.land.id)}`, { nickname: 'Home' });
    assert(changed.status === 403, '土地更新拒绝缺少操作者身份');
    const changedOwner = await request('PATCH', `/api/sfmc/lands/${encodeURIComponent(created.body.land.id)}`, { actorId: 'player-1', nickname: 'Home' });
    assert(changedOwner.status === 200 && changedOwner.body.land.nickname === 'Home' && changedOwner.body.land.version > 1, '土地更新递增版本');
    const invite = await request('POST', `/api/sfmc/lands/${encodeURIComponent(created.body.land.id)}/members`, { actorId: 'player-1', playerId: 'player-2', role: 'builder' });
    assert(invite.status === 200 && invite.body.inviteId, '土地成员邀请创建');
    const pending = await request('GET', '/api/sfmc/lands/invites/player-2');
    assert(pending.status === 200 && pending.body.invites.length === 1, '玩家可以查询待处理邀请');
    const accepted = await request('POST', '/api/sfmc/lands/invites/player-2', { inviteId: invite.body.inviteId });
    assert(accepted.status === 200 && accepted.body.land.members.some((member) => member.player_id === 'player-2' && member.role === 'builder'), '玩家接受土地邀请');
    const adminInvite = await request('POST', `/api/sfmc/lands/${encodeURIComponent(created.body.land.id)}/members`, { actorId: 'player-2', playerId: 'player-3', role: 'admin' });
    assert(adminInvite.status === 403, '普通管理员不能邀请管理员');
    const memberRole = await request('PATCH', `/api/sfmc/lands/${encodeURIComponent(created.body.land.id)}/members/player-2`, { actorId: 'player-1', role: 'container' });
    assert(memberRole.status === 200 && memberRole.body.land.members.some((member) => member.player_id === 'player-2' && member.role === 'container'), '所有者可以调整普通成员角色');
    const renamedWithMember = await request('PATCH', `/api/sfmc/lands/${encodeURIComponent(created.body.land.id)}`, { actorId: 'player-1', nickname: 'Home 2' });
    assert(renamedWithMember.status === 200 && renamedWithMember.body.land.members.some((member) => member.player_id === 'player-2' && member.role === 'container'), '普通土地更新不会升级成员角色');
    const adminRole = await request('PATCH', `/api/sfmc/lands/${encodeURIComponent(created.body.land.id)}/members/player-2`, { actorId: 'player-2', role: 'admin' });
    assert(adminRole.status === 403, '普通管理员不能提升成员为管理员');
    const transferred = await request('POST', `/api/sfmc/lands/${encodeURIComponent(created.body.land.id)}/transfer`, { actorId: 'player-1', targetId: 'player-2', targetName: 'PlayerTwo' });
    assert(transferred.status === 200 && transferred.body.land.ownerplid === 'player-2', '土地转让更新所有者和角色');
    const audit = await request('GET', `/api/sfmc/lands/${encodeURIComponent(created.body.land.id)}/audit`);
    assert(audit.status === 200 && audit.body.logs.length >= 4, '土地审计日志记录关键操作');
    const deleted = await request('DELETE', `/api/sfmc/lands/${encodeURIComponent(created.body.land.id)}`, { actorId: 'player-1' });
    assert(deleted.status === 403, '转让后原所有者不能删除土地');
    const deletedOwner = await request('DELETE', `/api/sfmc/lands/${encodeURIComponent(created.body.land.id)}`, { actorId: 'player-2' });
    assert(deletedOwner.status === 200 && deletedOwner.body.refund > 0, '土地软删除并返回退款');
    const afterRefund = await request('GET', '/api/sfmc/economy/account?playerId=player-2');
    assert(afterRefund.body.account.balance === beforePlayerTwo + deletedOwner.body.refund, '土地删除退款写入所有者经济账户');
    const transactions = await request('GET', '/api/sfmc/economy/transactions?playerId=player-1');
    assert(transactions.status === 200 && transactions.body.transactions.some((tx) => tx.transaction_type === 'land.purchase'), '经济流水记录土地购买');
    const coopCreate = await request('POST', '/api/sfmc/coops/create', { cid: 'cooptest', name: 'Test Coop', actorId: 'player-1', actorName: 'PlayerOne' });
    if (coopCreate.status !== 200) console.log(`[db-api] coop create response: ${coopCreate.status} ${JSON.stringify(coopCreate.body)}`);
    assert(coopCreate.status === 200 && coopCreate.body.ok && coopCreate.body.coop.owner_player_id === 'player-1', '合作社创建事务成功');
    const coopLookup = await request('GET', '/api/sfmc/coops/by-player/player-1');
    assert(coopLookup.status === 200 && coopLookup.body.coop?.cid === 'cooptest', '按玩家 ID 查询合作社');
    const coopUnauthorized = await request('PATCH', '/api/sfmc/coops/cooptest', { actorId: 'player-2', notice: '越权' });
    assert(coopUnauthorized.status === 403 && coopUnauthorized.body.error === 'forbidden', '合作社服务端拒绝未授权更新');
    const coopFeeUnauthorized = await request('PATCH', '/api/sfmc/coops/cooptest/settings', { actorId: 'player-2', feeBps: 800 });
    assert(coopFeeUnauthorized.status === 403 && coopFeeUnauthorized.body.error === 'forbidden', '合作社手续费设置拒绝普通成员');
    const coopFee = await request('PATCH', '/api/sfmc/coops/cooptest/settings', { actorId: 'player-1', feeBps: 800 });
    assert(coopFee.status === 200 && coopFee.body.feeBps === 800 && coopFee.body.transactionId, '社长可以事务化修改手续费比例');
    const coopInvite = await request('POST', '/api/sfmc/coops/cooptest/invites', { actorId: 'player-1', playerId: 'offline-player', playerName: 'OfflinePlayer', role: 'member' });
    assert(coopInvite.status === 200 && coopInvite.body.invite.invitee_id === 'offline-player', '合作社可以创建离线成员邀请');
    const coopInviteAccept = await request('POST', '/api/sfmc/coops/cooptest/invites/accept', { actorId: 'offline-player', playerName: 'OfflinePlayer', inviteId: coopInvite.body.invite.id });
    if (coopInviteAccept.status !== 200) console.log(`[db-api] coop invite accept response: ${coopInviteAccept.status} ${JSON.stringify(coopInviteAccept.body)}`);
    assert(coopInviteAccept.status === 200 && coopInviteAccept.body.coop.members.some((member) => member.player_id === 'offline-player'), '离线成员可以通过 player_id 接受邀请');
    const coopDeposit = await request('POST', '/api/sfmc/coops/cooptest/treasury/deposit', { actorId: 'player-1', actorName: 'PlayerOne', amount: 500, note: '测试存款' });
    assert(coopDeposit.status === 200 && coopDeposit.body.ok && coopDeposit.body.coopBalance === 500, '合作社存款原子更新双方账户');
    const coopWithdraw = await request('POST', '/api/sfmc/coops/cooptest/treasury/withdraw', { actorId: 'player-1', actorName: 'PlayerOne', amount: 200, note: '测试取款' });
    assert(coopWithdraw.status === 200 && coopWithdraw.body.ok && coopWithdraw.body.coopBalance === 300, '合作社取款原子更新双方账户');
    const coopMembers = await request('GET', '/api/sfmc/coops/cooptest/members');
    assert(coopMembers.status === 200 && coopMembers.body.members.some((member) => member.player_id === 'player-1' && member.role === 'owner'), '合作社创建 Owner 成员');
    const coopDissolveBlocked = await request('DELETE', '/api/sfmc/coops/cooptest', { actorId: 'player-1' });
    assert(coopDissolveBlocked.status === 409 && coopDissolveBlocked.body.error === 'assets_not_empty', '合作社有资产时禁止解散');
    const coopFinalWithdraw = await request('POST', '/api/sfmc/coops/cooptest/treasury/withdraw', { actorId: 'player-1', actorName: 'PlayerOne', amount: 300, note: '清空测试资产' });
    assert(coopFinalWithdraw.status === 200 && coopFinalWithdraw.body.coopBalance === 0, '合作社解散前可以清空银行');
    const coopDissolved = await request('DELETE', '/api/sfmc/coops/cooptest', { actorId: 'player-1' });
    assert(coopDissolved.status === 200 && coopDissolved.body.transactionId, '合作社解散保留状态并写入事务');
    const coopAudit = await request('GET', '/api/sfmc/coops/cooptest/audit?actorId=player-1');
    assert(coopAudit.status === 200 && coopAudit.body.logs.some((log) => log.action === 'coop.dissolve' && log.transaction_id === coopDissolved.body.transactionId), '合作社解散写入审计日志');
    const legacyCoopWrite = await request('POST', '/api/sfmc/coops', { coop: { cid: 'legacy-test' } });
    assert(legacyCoopWrite.status === 410 && legacyCoopWrite.body.error === 'legacy_route_disabled', '旧合作社写入路由已禁用');
    console.log('[db-api] 全部通过');
  } finally {
    child.kill();
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 2000);
      child.once('close', () => { clearTimeout(timer); resolve(); });
    });
    try { fs.rmSync(workspace, { recursive: true, force: true }); } catch {}
    if (stderr && /启动失败/.test(stderr)) process.stderr.write(stderr);
  }
}

main().catch((error) => {
  console.error(`[db-api] ERROR: ${error.message}`);
  process.exitCode = 1;
});
