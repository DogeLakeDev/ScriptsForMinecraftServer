/** 内嵌时由 desktop 外壳提供标题栏与外观控制。 */
export const embedded = new URLSearchParams(window.location.search).get("embedded") === "1";
