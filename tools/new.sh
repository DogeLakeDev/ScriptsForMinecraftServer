#!/usr/bin/env bash
# new.sh — 快速生成新模块骨架
#
# 用法:./tools/new.sh my-module-id
#       ./tools/new.sh my-module-id "我的模块"
#
# 产出:
#   packages/<id>/package.json
#   packages/<id>/sapi/manifest.json
#   packages/<id>/sapi/src/index.ts
#   packages/<id>/configs-default/config.json
#
# 自动添加到 index.json。

set -euo pipefail

ID="${1:-}"
NAME="${2:-My Module}"
if [ -z "$ID" ]; then
  echo "用法:$0 <module-id> [name]" >&2
  exit 1
fi

DIR="$(cd "$(dirname "$0")/.." && pwd)"
PKG_DIR="$DIR/packages/$ID"
if [ -e "$PKG_DIR" ]; then
  echo "ERR: $PKG_DIR 已存在" >&2
  exit 1
fi

mkdir -p "$PKG_DIR/sapi/src" "$PKG_DIR/configs-default"

# id 必须满足 /^feature-[a-z0-9-]+$/ 或 /^core-[a-z0-9-]+$/
TYPE="feature"
if [[ "$ID" == core-* ]]; then TYPE="core"; fi

CONFIG_KEY="$(echo "$ID" | sed -E 's/^(feature|core)-//; s/-/_/g')"

cat > "$PKG_DIR/package.json" <<EOF
{
  "name": "@sfmc/module-$ID",
  "version": "0.1.0",
  "type": "module",
  "main": "sapi/src/index.ts",
  "private": true,
  "description": "SAPI module: $NAME",
  "scripts": {
    "typecheck": "tsc --noEmit -p sapi/tsconfig.json"
  },
  "dependencies": {
    "@sfmc/sdk": "^0.1.0"
  },
  "peerDependencies": {
    "@minecraft/server": "2.10.0-beta.1.26.40-preview.30"
  }
}
EOF

cat > "$PKG_DIR/sapi/manifest.json" <<EOF
{
  "schemaVersion": 2,
  "id": "$ID",
  "name": "$NAME",
  "type": "$TYPE",
  "configKey": "$CONFIG_KEY",
  "requires": [],
  "permissions": [
    "config:read:$CONFIG_KEY",
    "config:write:$CONFIG_KEY"
  ],
  "services": {
    "provides": [],
    "requires": []
  },
  "notes": "新建模块骨架。"
}
EOF

cat > "$PKG_DIR/sapi/src/index.ts" <<EOF
import { ModuleRegistry } from "@sfmc/sdk/module-loader";
import { Permission } from "@sfmc/sdk/sapi/runtime";

const MODULE_ID = "$ID";

ModuleRegistry.register({
  id: MODULE_ID,
  afterWorldLoad: false,
  lifecycle: {
    registerPermissions() {
      Permission.register("${CONFIG_KEY}.use", Permission.Any);
    },
    async init() {
      // 在此调 db.defineTable / db.tx / service.get ...
    },
    cleanup() {},
  },
});
EOF

cat > "$PKG_DIR/sapi/tsconfig.json" <<EOF
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": ".",
    "outDir": "dist",
    "composite": false
  },
  "include": ["src/**/*.ts"]
}
EOF

cat > "$PKG_DIR/configs-default/config.json" <<EOF
{
  "schemaVersion": 1,
  "generatedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "config": {}
}
EOF

# 加进 index.json
node "$DIR/tools/sync-index.js" "$ID"

echo "✓ 已生成 packages/$ID"
echo "  - 编辑 sapi/manifest.json 声明 permissions / services"
echo "  - 编辑 sapi/src/index.ts 写实际业务"
echo "  - 运行 npm run typecheck 校验"