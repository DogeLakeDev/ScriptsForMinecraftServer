/**
 * upload.ts — 从聊天记录选择世界包并上传到实例收件箱
 *
 * 使用场景：世界包页的「导入」。小程序只能从微信聊天中选文件（wx.chooseMessageFile），
 * 选好后逐个以原始字节 PUT 到网关的 /packs/inbox，返回收件箱文件名，随后由页面提交 packs.import。
 */
import { uploadUrl } from "./profiles";
import { session } from "./session";

/** 可导入的世界包后缀（网关会再校验一次） */
const PACK_FILE = /\.(mcpack|mcaddon|zip)$/i;

/** 一次上传的结果 */
export interface UploadedPack {
  /** 收件箱中的文件名（packs.import 的参数） */
  filename: string;
  /** 原文件名，用于确认弹窗展示 */
  original: string;
  size: number;
}

/** 选择文件：返回被接受的文件与被跳过的文件名 */
export function choosePacks(): Promise<{ files: WechatMiniprogram.ChooseFile[]; rejected: string[] }> {
  return new Promise((resolve, reject) => {
    wx.chooseMessageFile({
      count: 9,
      type: "file",
      extension: ["mcpack", "mcaddon", "zip"],
      success: ({ tempFiles }) => {
        const files = tempFiles.filter((file) => PACK_FILE.test(file.name));
        resolve({ files, rejected: tempFiles.filter((file) => !PACK_FILE.test(file.name)).map((file) => file.name) });
      },
      fail: (error) => {
        if (/cancel/i.test(error.errMsg)) resolve({ files: [], rejected: [] });
        else reject(new Error(error.errMsg));
      },
    });
  });
}

/** 读取临时文件为 ArrayBuffer */
function readFile(path: string): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().readFile({
      filePath: path,
      success: ({ data }) => resolve(data as ArrayBuffer),
      fail: (error) => reject(new Error(error.errMsg)),
    });
  });
}

/** 上传单个文件到当前实例的收件箱 */
async function uploadOne(file: WechatMiniprogram.ChooseFile): Promise<UploadedPack> {
  const profile = session.state.profile;
  if (!profile) throw new Error("实例未连接");
  const data = await readFile(file.path);
  return new Promise((resolve, reject) => {
    wx.request({
      url: uploadUrl(profile.endpoint, file.name),
      method: "PUT",
      data,
      header: { Authorization: `Bearer ${profile.token}`, "Content-Type": "application/octet-stream" },
      timeout: 600_000,
      success: ({ statusCode, data: body }) => {
        const result = body as { filename?: string; size?: number; error?: string };
        if (statusCode === 200 && result?.filename) resolve({ filename: result.filename, original: file.name, size: result.size ?? file.size });
        else reject(new Error(result?.error ?? `上传失败（HTTP ${statusCode}）`));
      },
      fail: (error) => reject(new Error(/domain list|合法域名/.test(error.errMsg) ? "网关域名未加入 request 合法域名" : error.errMsg)),
    });
  });
}

/** 依次上传，显示进度；任一失败即停止并抛出（已上传的文件留在收件箱，不会被导入） */
export async function uploadPacks(files: WechatMiniprogram.ChooseFile[]): Promise<UploadedPack[]> {
  const uploaded: UploadedPack[] = [];
  try {
    for (const [index, file] of files.entries()) {
      wx.showLoading({ title: files.length > 1 ? `上传中 ${index + 1}/${files.length}` : "上传中", mask: true });
      uploaded.push(await uploadOne(file));
    }
  } finally {
    wx.hideLoading();
  }
  return uploaded;
}
