"use strict";
/**
 * fsx.ts — 异步/流式文件操作 (避免大文件加载进内存)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashFileAsync = hashFileAsync;
exports.hashFileSync = hashFileSync;
exports.copyFileAsync = copyFileAsync;
exports.copyDirSync = copyDirSync;
exports.copyDirAsync = copyDirAsync;
exports.getDirSize = getDirSize;
exports.emptyDirSync = emptyDirSync;
exports.rmSafe = rmSafe;
exports.writeFileSafe = writeFileSafe;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const node_crypto_1 = __importDefault(require("node:crypto"));
const promises_1 = require("node:stream/promises");
/**
 * 流式计算文件哈希 (sha1 / sha256)，
 * 用于大文件 (例如 bedrock_server.exe ~80MB)，不会 OOM。
 */
async function hashFileAsync(filePath, algo = "sha256") {
    return new Promise((resolve, reject) => {
        const h = node_crypto_1.default.createHash(algo);
        const stream = node_fs_1.default.createReadStream(filePath);
        stream.on("data", (chunk) => {
            h.update(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
        });
        stream.on("end", () => resolve(h.digest("hex").toLowerCase()));
        stream.on("error", reject);
    });
}
/** 同步版本（用于小文件） */
function hashFileSync(filePath, algo = "sha256") {
    try {
        const h = node_crypto_1.default.createHash(algo);
        h.update(node_fs_1.default.readFileSync(filePath));
        return h.digest("hex").toLowerCase();
    }
    catch {
        return "";
    }
}
/** 同步流式拷贝单文件 (复制中) */
async function copyFileAsync(src, dest) {
    await (0, promises_1.pipeline)(node_fs_1.default.createReadStream(src), node_fs_1.default.createWriteStream(dest));
}
/** 同步目录复制 (递归) */
function copyDirSync(src, dest) {
    node_fs_1.default.mkdirSync(dest, { recursive: true });
    for (const entry of node_fs_1.default.readdirSync(src)) {
        const srcPath = node_path_1.default.join(src, entry);
        const destPath = node_path_1.default.join(dest, entry);
        if (node_fs_1.default.statSync(srcPath).isDirectory()) {
            copyDirSync(srcPath, destPath);
        }
        else {
            node_fs_1.default.copyFileSync(srcPath, destPath);
        }
    }
}
/** 异步目录复制 (基于流) */
async function copyDirAsync(src, dest) {
    node_fs_1.default.mkdirSync(dest, { recursive: true });
    await Promise.all(node_fs_1.default.readdirSync(src).map(async (entry) => {
        const srcPath = node_path_1.default.join(src, entry);
        const destPath = node_path_1.default.join(dest, entry);
        const stat = node_fs_1.default.statSync(srcPath);
        if (stat.isDirectory()) {
            await copyDirAsync(srcPath, destPath);
        }
        else {
            await copyFileAsync(srcPath, destPath);
        }
    }));
}
/** 计算目录大小 (字节) */
function getDirSize(dir) {
    let total = 0;
    try {
        for (const entry of node_fs_1.default.readdirSync(dir, { withFileTypes: true })) {
            const full = node_path_1.default.join(dir, entry.name);
            if (entry.isDirectory())
                total += getDirSize(full);
            else if (entry.isFile())
                total += node_fs_1.default.statSync(full).size;
        }
    }
    catch { }
    return total;
}
/** 强制清空目录内容 (但保留目录本身) */
function emptyDirSync(dir) {
    if (!node_fs_1.default.existsSync(dir))
        return;
    for (const entry of node_fs_1.default.readdirSync(dir)) {
        const full = node_path_1.default.join(dir, entry);
        try {
            const stat = node_fs_1.default.statSync(full);
            if (stat.isDirectory())
                node_fs_1.default.rmSync(full, { recursive: true, force: true });
            else
                node_fs_1.default.unlinkSync(full);
        }
        catch (e) {
            // 忽略: 顶层仍保留目录，即使部分子项无法删除
        }
    }
}
/** 安全删除整个目录 */
function rmSafe(path) {
    try {
        node_fs_1.default.rmSync(path, { recursive: true, force: true });
    }
    catch {
        /* ignore */
    }
}
/** 安全写文件 (原子: 写临时文件 → rename) */
function writeFileSafe(filePath, data) {
    const dir = node_path_1.default.dirname(filePath);
    node_fs_1.default.mkdirSync(dir, { recursive: true });
    const tmp = `${filePath}.${process.pid}.tmp`;
    node_fs_1.default.writeFileSync(tmp, data);
    node_fs_1.default.renameSync(tmp, filePath);
}
//# sourceMappingURL=fsx.js.map