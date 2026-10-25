/**
 * instance-edit — 新增 / 编辑实例档案
 *
 * 使用场景：填写网关地址与访问令牌。保存后立即连接该实例并回到首页；
 * 「测试连接」只做一次握手（不改变当前会话）；令牌只保存在本机。
 */
import { ask } from "../../core/actions";
import { GatewayClient } from "../../core/client";
import { errorText } from "../../core/format";
import { findProfile, isInsecure, normalizeEndpoint, removeProfile, saveProfile, socketUrl } from "../../core/profiles";
import { session } from "../../core/session";

Page({
  data: {
    id: "",
    name: "",
    endpoint: "",
    token: "",
    showToken: false,
    error: "",
    insecure: false,
    testing: false,
    testResult: "",
    testOk: false,
  },
  onLoad(query: Record<string, string | undefined>) {
    const profile = query.id ? findProfile(decodeURIComponent(query.id)) : undefined;
    if (profile) {
      this.setData({ id: profile.id, name: profile.name, endpoint: profile.endpoint, token: profile.token, insecure: isInsecure(profile.endpoint) });
      wx.setNavigationBarTitle({ title: "编辑实例" });
    } else wx.setNavigationBarTitle({ title: "添加实例" });
  },
  onName(event: WechatMiniprogram.Input) {
    this.setData({ name: event.detail.value, error: "" });
  },
  onEndpoint(event: WechatMiniprogram.Input) {
    const value = event.detail.value;
    let insecure = false;
    try {
      insecure = isInsecure(normalizeEndpoint(value));
    } catch {
      insecure = false;
    }
    this.setData({ endpoint: value, insecure, error: "", testResult: "" });
  },
  onToken(event: WechatMiniprogram.Input) {
    this.setData({ token: event.detail.value, error: "", testResult: "" });
  },
  toggleToken() {
    this.setData({ showToken: !this.data.showToken });
  },
  /** 从剪贴板粘贴令牌（网关首次启动时会打印令牌） */
  pasteToken() {
    wx.getClipboardData({ success: ({ data }) => this.setData({ token: data.trim(), testResult: "" }) });
  },

  /** 校验输入，返回规整后的档案字段；失败时在页面显示原因 */
  validate(): { name: string; endpoint: string; token: string } | null {
    let endpoint: string;
    try {
      endpoint = normalizeEndpoint(this.data.endpoint);
    } catch (error) {
      this.setData({ error: errorText(error) });
      return null;
    }
    const token = this.data.token.trim();
    if (token.length < 24) {
      this.setData({ error: "访问令牌过短，请粘贴网关打印的完整令牌" });
      return null;
    }
    const name = this.data.name.trim() || endpoint.replace(/^https?:\/\//, "");
    return { name, endpoint, token };
  },

  /** 测试连接：握手成功即说明地址与令牌可用 */
  async test() {
    const values = this.validate();
    if (!values || this.data.testing) return;
    this.setData({ testing: true, testResult: "" });
    const client = new GatewayClient(socketUrl(values.endpoint), values.token);
    try {
      await client.open();
      const handshake = await client.call("handshake", {});
      this.setData({ testOk: true, testResult: `连接成功：SFMC ${handshake.platformVersion}，${handshake.root}` });
    } catch (error) {
      this.setData({ testOk: false, testResult: errorText(error) });
    } finally {
      client.close();
      this.setData({ testing: false });
    }
  },

  save() {
    const values = this.validate();
    if (!values) return;
    const profile = saveProfile({ ...values, id: this.data.id || undefined });
    void session.connect(profile);
    wx.switchTab({ url: "/pages/overview/overview" });
  },

  async remove() {
    if (!this.data.id) return;
    if (!(await ask("删除这个实例？", "只删除本机保存的地址和令牌，不影响服务器。", "删除", true))) return;
    if (session.state.profile?.id === this.data.id) session.forget();
    removeProfile(this.data.id);
    wx.navigateBack();
  },
});
