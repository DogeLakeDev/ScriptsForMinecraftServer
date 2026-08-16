#!/usr/bin/env node
// @ts-check
/** @deprecated 请用 verify.mjs */
import { runVerify } from "./verify.mjs";

console.warn("[deprecated] check-ootb.mjs → 请用: node packages/tools/verify.mjs");
const code = await runVerify();
process.exit(code);
