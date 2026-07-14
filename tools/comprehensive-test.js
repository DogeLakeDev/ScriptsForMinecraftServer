const http = require('http');
const BASE = 'http://127.0.0.1:3001';

function req(method, path, data) {
  return new Promise((resolve) => {
    const u = new URL(path, BASE);
    const body = data ? JSON.stringify(data) : null;
    const opts = { hostname: u.hostname, port: u.port, path: u.pathname + u.search, method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.headers['Content-Length'] = Buffer.byteLength(body);
    const r = http.request(opts, (res) => {
      let b = '';
      res.on('data', (c) => b += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(b);
          resolve({ status: res.statusCode, body: parsed, ok: res.statusCode === 200 && !parsed.error });
        } catch {
          resolve({ status: res.statusCode, body: b, ok: false });
        }
      });
    });
    r.on('error', (e) => resolve({ status: 0, body: `network_error: ${e.message}`, ok: false }));
    if (body) r.write(body);
    r.end();
  });
}

async function test() {
  const results = [];
  const pass = (name) => { console.log(`\x1b[32m[PASS]\x1b[0m ${name}`); results.push({ name, ok: true }); };
  const fail = (name, detail) => { console.log(`\x1b[31m[FAIL]\x1b[0m ${name}: ${detail}`); results.push({ name, ok: false, detail }); };

  // 0. Health check
  const health = await req('GET', '/api/health');
  if (health.ok && health.body.status === 'ok') pass('Health check');
  else fail('Health check', JSON.stringify(health.body));

  // 1. Economy - fund test players
  const players = ['land-owner', 'coop-founder', 'tax-owner', 'shop-buyer', 'market-seller', 'task-player'];
  for (const p of players) {
    const r = await req('POST', '/api/sfmc/economy/account', { actorId: p, targetPlayerId: p, targetPlayerName: p, amount: 50000, type: 'credit' });
    if (r.ok) pass(`Fund player ${p}`);
    else fail(`Fund player ${p}`, JSON.stringify(r.body));
  }

  // 2. Price index - add item
  const pi = await req('POST', '/api/sfmc/economy/price-index', { actorId: 'admin', item_type: 'minecraft:diamond', base_buy_price: 100, base_sell_price: 80, is_renewable: 0 });
  if (pi.ok) pass('Price index: add diamond');
  else fail('Price index: add diamond', JSON.stringify(pi.body));

  const pi2 = await req('GET', '/api/sfmc/economy/price-index');
  if (pi2.ok && pi2.body.items.length > 0) pass(`Price index: list (${pi2.body.items.length} items)`);
  else fail('Price index: list', JSON.stringify(pi2.body));

  // 3. Land - create
  const land = await req('POST', '/api/sfmc/lands', { ownerId: 'land-owner', ownerName: 'LandOwner', posA: { x: 50, y: 60, z: 50 }, posB: { x: 54, y: 70, z: 54 }, dimid: 0 });
  if (land.ok) pass(`Land create: ${land.body.land.id}`);
  else fail('Land create', JSON.stringify(land.body));
  const landId = land.ok ? land.body.land.id : null;

  // 4. Land - get by id
  if (landId) {
    const lg = await req('GET', `/api/sfmc/lands/${landId}`);
    if (lg.ok && lg.body.land) pass('Land get by id');
    else fail('Land get by id', JSON.stringify(lg.body));
  }

  // 5. Land - add member
  if (landId) {
    const lm = await req('POST', `/api/sfmc/lands/${landId}/members`, { actorId: 'land-owner', playerId: 'land-member-1', playerName: 'Member1', role: 'builder' });
    if (lm.ok) pass('Land add member invite');
    else fail('Land add member invite', JSON.stringify(lm.body));
  }

  // 6. Land - transfer
  if (landId) {
    const before = await req('GET', `/api/sfmc/lands/${landId}`);
    const v = before.ok ? before.body.land.version : 1;
    const lt = await req('POST', `/api/sfmc/lands/${landId}/transfer`, { actorId: 'land-owner', targetId: 'new-land-owner', targetName: 'NewOwner', expectedVersion: v });
    if (lt.ok) pass(`Land transfer (ver ${v})`);
    else fail('Land transfer', JSON.stringify(lt.body));
  }

  // 7. Land - delete (by new owner, with version check)
  if (landId) {
    const after = await req('GET', `/api/sfmc/lands/${landId}`);
    const v = after.ok ? after.body.land.version : 1;
    const ld = await req('DELETE', `/api/sfmc/lands/${landId}`, { actorId: 'new-land-owner', expectedVersion: v });
    if (ld.ok) pass(`Land delete (ver ${v}): refund=${ld.body.refund}`);
    else fail('Land delete', JSON.stringify(ld.body));
  }

  // 8. Land - audit log
  if (landId) {
    const la = await req('GET', `/api/sfmc/lands/${landId}/audit`);
    if (la.ok) pass(`Land audit: ${la.body.log ? la.body.log.length : 0} entries`);
    else fail('Land audit', JSON.stringify(la.body));
  }

  // 9. Coop - create
  const coop = await req('POST', '/api/sfmc/coops/create', { actorId: 'coop-founder', actorName: 'CoopFounder', cid: 'coop-test-1', name: 'TestCooperative' });
  if (coop.ok) pass(`Coop create: ${coop.body.coop.cid}`);
  else fail('Coop create', JSON.stringify(coop.body));

  // 10. Coop - query
  const cq = await req('GET', '/api/sfmc/coops/coop-test-1');
  if (cq.ok && cq.body.coop) pass('Coop query');
  else fail('Coop query', JSON.stringify(cq.body));

  // 11. Coop - add shop item (type 1 = sell)
  const si = await req('POST', '/api/sfmc/coops/coop-test-1/shop_items', { id: 'shop-item-1', cid: 'coop-test-1', name: 'Diamond', item_type: 'minecraft:diamond', type: 1, num: 64, sv: 0, money: 100, is_true: 1, created_at: Date.now() });
  if (si.ok) pass('Coop shop add item');
  else fail('Coop shop add item', JSON.stringify(si.body));

  // 12. Coop - atomic buy
  const sb = await req('POST', '/api/sfmc/coops/coop-test-1/shop/buy', { actorId: 'coop-founder', actorName: 'CoopFounder', listingId: 'shop-item-1', quantity: 5 });
  if (sb.ok) pass(`Coop shop buy 5 diamonds: tx=${sb.body.transactionId}, balance=${sb.body.balance}`);
  else fail('Coop shop buy', JSON.stringify(sb.body));

  // 13. Coop - treasury deposit
  const td = await req('POST', '/api/sfmc/coops/coop-test-1/treasury/deposit', { actorId: 'coop-founder', actorName: 'CoopFounder', amount: 1000 });
  if (td.ok) pass(`Coop treasury deposit: player=${td.body.playerBalance}, coop=${td.body.coopBalance}`);
  else fail('Coop treasury deposit', JSON.stringify(td.body));

  // 14. Coop - treasury withdraw
  const tw = await req('POST', '/api/sfmc/coops/coop-test-1/treasury/withdraw', { actorId: 'coop-founder', actorName: 'CoopFounder', amount: 500 });
  if (tw.ok) pass(`Coop treasury withdraw: player=${tw.body.playerBalance}, coop=${tw.body.coopBalance}`);
  else fail('Coop treasury withdraw', JSON.stringify(tw.body));

  // 15. Coop - fee update
  const cf = await req('PATCH', '/api/sfmc/coops/coop-test-1/settings', { actorId: 'coop-founder', feeBps: 250 });
  if (cf.ok) pass('Coop fee update');
  else fail('Coop fee update', JSON.stringify(cf.body));

  // 16. Coop - add type 2 shop item (buy request)
  const si2 = await req('POST', '/api/sfmc/coops/coop-test-1/shop_items', { id: 'shop-item-2', cid: 'coop-test-1', name: 'BuyDirt', item_type: 'minecraft:dirt', type: 2, num: 100, sv: 0, money: 5, is_true: 1, created_at: Date.now() });
  if (si2.ok) pass('Coop shop add buy-request item');
  else fail('Coop shop add buy-request item', JSON.stringify(si2.body));

  // 17. Coop - atomic sell
  const ss = await req('POST', '/api/sfmc/coops/coop-test-1/shop/sell', { actorId: 'coop-founder', actorName: 'CoopFounder', listingId: 'shop-item-2', quantity: 10 });
  if (ss.ok) pass(`Coop shop sell 10 dirt: tx=${ss.body.transactionId}, total=${ss.body.total}`);
  else fail('Coop shop sell', JSON.stringify(ss.body));

  // 18. Daily task - create
  const dt = await req('POST', '/api/sfmc/economy/daily-tasks', { actorId: 'admin', item_type: 'minecraft:iron_ingot', target_qty: 64, unit_reward: 10, expires_at: Date.now() + 86400000 });
  if (dt.ok) pass(`Daily task create: id=${dt.body.id}`);
  else fail('Daily task create', JSON.stringify(dt.body));

  // 19. Daily task - list
  const dtl = await req('GET', '/api/sfmc/economy/daily-tasks');
  if (dtl.ok && dtl.body.tasks.length > 0) pass(`Daily task list: ${dtl.body.tasks.length} tasks`);
  else fail('Daily task list', JSON.stringify(dtl.body));

  // 20. Daily task - submit
  const taskId = dt.ok ? dt.body.id : null;
  if (taskId) {
    const dts = await req('POST', `/api/sfmc/economy/daily-tasks/${taskId}/submit`, { actorId: 'task-player', actorName: 'TaskPlayer', quantity: 5 });
    if (dts.ok) pass(`Daily task submit: reward=${dts.body.reward}, balance=${dts.body.balance}`);
    else fail('Daily task submit', JSON.stringify(dts.body));
  }

  // 21. Coop - unauthorized access rejection
  const cu = await req('PATCH', '/api/sfmc/coops/coop-test-1', { actorId: 'random-player', notice: 'hacked' });
  if (!cu.ok && cu.body.error === 'legacy_route_disabled') pass('Coop unauthorized PATCH rejected (legacy route)');
  else if (!cu.ok) pass('Coop unauthorized PATCH rejected');
  else fail('Coop unauthorized PATCH', JSON.stringify(cu.body));

  // 22. Coop - non-member shop buy rejection
  const sb2 = await req('POST', '/api/sfmc/coops/coop-test-1/shop/buy', { actorId: 'random-player', listingId: 'shop-item-1', quantity: 1 });
  if (!sb2.ok) pass(`Coop shop buy by non-member rejected: ${sb2.body.error}`);
  else fail('Coop shop buy by non-member should be rejected', JSON.stringify(sb2.body));

  // 23. Tax - collect on land with tax_rate=0
  const land2 = await req('POST', '/api/sfmc/lands', { ownerId: 'tax-owner', ownerName: 'TaxOwner', posA: { x: 60, y: 60, z: 60 }, posB: { x: 64, y: 70, z: 64 }, dimid: 0 });
  if (land2.ok) {
    const l2id = land2.body.land.id;
    const tx = await req('POST', `/api/sfmc/lands/${l2id}/tax-collect`, { actorId: 'tax-owner' });
    if (tx.ok) pass(`Land tax collect (no_tax): ${tx.body.message || tx.body.taxCollected}`);
    else if (tx.body.error === 'no_tax') pass('Land tax: tax_rate=0 skipped');
    else fail('Land tax collect', JSON.stringify(tx.body));
  } else {
    fail('Land create for tax test', JSON.stringify(land2.body));
  }

  // 24. Economy - idempotency test
  const idem1 = await req('POST', '/api/sfmc/economy/account', { actorId: 'coop-founder', sourcePlayerId: 'coop-founder', amount: 100, type: 'debit', idempotencyKey: 'idem-test-key-1' });
  const idem2 = await req('POST', '/api/sfmc/economy/account', { actorId: 'coop-founder', sourcePlayerId: 'coop-founder', amount: 100, type: 'debit', idempotencyKey: 'idem-test-key-1' });
  if (idem1.ok && idem2.body.replayed) pass('Economy idempotency: replayed');
  else fail('Economy idempotency', JSON.stringify({ first: idem1.body, second: idem2.body }));

  // 25. Input validation tests
  // Coop - negative quantity shop buy
  const sb3 = await req('POST', '/api/sfmc/coops/coop-test-1/shop/buy', { actorId: 'coop-founder', listingId: 'shop-item-1', quantity: -1 });
  if (!sb3.ok) pass('Shop buy negative quantity rejected');
  else fail('Shop buy negative quantity NOT rejected', JSON.stringify(sb3.body));

  // Coop - zero quantity shop buy
  const sb4 = await req('POST', '/api/sfmc/coops/coop-test-1/shop/buy', { actorId: 'coop-founder', listingId: 'shop-item-1', quantity: 0 });
  if (!sb4.ok) pass('Shop buy zero quantity rejected');
  else fail('Shop buy zero quantity NOT rejected', JSON.stringify(sb4.body));

  // Economy - transfer to self
  const es = await req('POST', '/api/sfmc/economy/account', { actorId: 'coop-founder', sourcePlayerId: 'coop-founder', targetPlayerId: 'coop-founder', amount: 100, type: 'transfer' });
  if (!es.ok) pass('Economy self-transfer rejected');
  else fail('Economy self-transfer NOT rejected', JSON.stringify(es.body));

  // Summary
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n\x1b[36m===== RESULTS: ${passed} passed, ${failed} failed =====\x1b[0m`);
  if (failed > 0) {
    console.log('\n\x1b[33mFailures:\x1b[0m');
    results.filter(r => !r.ok).forEach(r => console.log(`  - ${r.name}: ${r.detail || '(no detail)'}`));
  }
  process.exit(failed > 0 ? 1 : 0);
}

test().catch(e => { console.error('Test error:', e); process.exit(1); });

