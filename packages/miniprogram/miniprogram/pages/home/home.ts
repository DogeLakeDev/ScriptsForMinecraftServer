/**
 * home — 玩家端首页（占位）
 *
 * 使用场景：小程序启动后的第一屏。服务器状态、加入方式、公告等玩家功能还在与服主讨论设计，
 * 本轮只放服务器名称与入口提示；账号相关功能在「我的」。
 */
import { HOME_SERVER, hasHomeServer } from "../../core/server";

Page({
  data: {
    serverName: HOME_SERVER.name,
    configured: hasHomeServer(),
  },
  openMe() {
    wx.switchTab({ url: "/pages/me/me" });
  },
});
