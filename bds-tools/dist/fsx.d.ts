/**
 * fsx.ts — 异步/流式文件操作 (避免大文件加载进内存)
 */
/**
 * 流式计算文件哈希 (sha1 / sha256)，
 * 用于大文件 (例如 bedrock_server.exe ~80MB)，不会 OOM。
 */
export declare function hashFileAsync(filePath: string, algo?: "sha1" | "sha256"): Promise<string>;
/** 同步版本（用于小文件） */
export declare function hashFileSync(filePath: string, algo?: "sha1" | "sha256"): string;
/** 同步流式拷贝单文件 (复制中) */
export declare function copyFileAsync(src: string, dest: string): Promise<void>;
/** 同步目录复制 (递归) */
export declare function copyDirSync(src: string, dest: string): void;
/** 异步目录复制 (基于流) */
export declare function copyDirAsync(src: string, dest: string): Promise<void>;
/** 计算目录大小 (字节) */
export declare function getDirSize(dir: string): number;
/** 强制清空目录内容 (但保留目录本身) */
export declare function emptyDirSync(dir: string): void;
/** 安全删除整个目录 */
export declare function rmSafe(path: string): void;
/** 安全写文件 (原子: 写临时文件 → rename) */
export declare function writeFileSafe(filePath: string, data: string | Buffer): void;
//# sourceMappingURL=fsx.d.ts.map