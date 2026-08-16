// @ts-check
/**
 * verify 阶段统一 PASS/FAIL 收集
 */

/**
 * @param {string} [tag]
 */
export function createReporter(tag = "verify") {
  /** @type {string[]} */
  const passed = [];
  /** @type {{ name: string; why: string }[]} */
  const errors = [];

  return {
    /** @param {string} name */
    pass(name) {
      passed.push(name);
      console.log(`[${tag}] PASS: ${name}`);
    },
    /** @param {string} name @param {string} why */
    fail(name, why) {
      errors.push({ name, why });
      console.error(`[${tag}] FAIL: ${name} — ${why}`);
    },
    /** @param {string} msg */
    warn(msg) {
      console.log(`[${tag}] WARN: ${msg}`);
    },
    get ok() {
      return errors.length === 0;
    },
    get passedCount() {
      return passed.length;
    },
    get failedCount() {
      return errors.length;
    },
    printSummary() {
      console.log(`\n[${tag}] 通过 ${passed.length} / 失败 ${errors.length}`);
      if (errors.length > 0) {
        console.error(`\n[${tag}] 失败项目:`);
        for (const e of errors) console.error(`  - ${e.name}: ${e.why}`);
      }
    },
    exit() {
      this.printSummary();
      process.exit(this.ok ? 0 : 1);
    },
  };
}
