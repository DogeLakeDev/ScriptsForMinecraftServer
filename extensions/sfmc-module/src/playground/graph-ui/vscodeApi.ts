export type VsCodeApi = {
  postMessage(msg: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

declare function acquireVsCodeApi(): VsCodeApi;

let api: VsCodeApi | undefined;

export function vscodeApi(): VsCodeApi {
  if (!api) {
    try {
      api = acquireVsCodeApi();
    } catch {
      api = {
        postMessage: (m) => console.log("[demo-post]", m),
        getState: () => undefined,
        setState: () => undefined,
      };
    }
  }
  return api;
}
