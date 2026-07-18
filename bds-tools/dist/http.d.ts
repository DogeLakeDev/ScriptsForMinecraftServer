/**
 * http.ts — 稳定 HTTP 工具 (分阶段超时 + 自动重定向 + 流式下载)
 *
 * 改进:
 *  - connect timeout vs total timeout 分开
 *  - 下载通过流管道，避免大文件加载到内存
 *  - 失败后已写入的临时文件可被清理
 */
interface HttpOptions {
    method?: "GET" | "HEAD" | "POST";
    headers?: Record<string, string>;
    body?: string;
    connectTimeoutMs?: number;
    totalTimeoutMs?: number;
    redirects?: number;
}
export declare function httpRequest(url: string, opts?: HttpOptions): Promise<{
    statusCode: number;
    body: Buffer;
    headers: Record<string, string | string[] | undefined>;
}>;
export declare function httpGetJson<T = unknown>(url: string, opts?: HttpOptions): Promise<T>;
export declare function httpGetText(url: string, opts?: HttpOptions): Promise<string>;
/** 多个源并发请求，谁先成功返回（每个源都用 JSON 解析，解析失败也失败） */
export declare function fetchJsonWithFallback<T = unknown>(sources: string[], timeoutMs?: number): Promise<T>;
/**
 * 流式下载到指定路径，返回字节数。
 * - 失败时自动清理 partial 文件
 * - 支持 progress 回调
 * - 支持 connect/total 阶段超时
 */
export interface DownloadOptions extends HttpOptions {
    onProgress?: (downloaded: number, total: number) => void;
}
export declare function httpDownload(url: string, destPath: string, opts?: DownloadOptions): Promise<number>;
export {};
//# sourceMappingURL=http.d.ts.map