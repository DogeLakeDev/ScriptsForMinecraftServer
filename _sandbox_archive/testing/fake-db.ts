/**
 * Fake db：tx.call stub（从原 testing/index 拆出）。
 */

export interface FakeDbStub {
  provides?: Record<string, (input: unknown) => unknown>;
}

export interface FakeDbTx {
  calls: Array<{ name: string; input: unknown; result?: unknown; error?: string | undefined }>;
  call<T = unknown>(name: string, input?: unknown): Promise<T>;
}

export interface FakeDb {
  reset(): void;
  tx<T>(cb: (tx: FakeDbTx) => Promise<T> | T): Promise<T>;
  stubServices(opts: FakeDbStub): void;
  /** 便于断言：最近一次 tx 内全部 call。 */
  readonly calls: FakeDbTx["calls"];
}

export function createFakeDb(initial?: FakeDbStub): FakeDb {
  const txLog: FakeDbTx["calls"] = [];
  let stubs = initial?.provides ?? {};

  return {
    get calls() {
      return txLog;
    },
    reset() {
      txLog.length = 0;
    },
    stubServices(opts) {
      stubs = opts.provides ?? {};
    },
    async tx<T>(cb: (tx: FakeDbTx) => Promise<T> | T): Promise<T> {
      const tx: FakeDbTx = {
        calls: txLog,
        async call<T = unknown>(name: string, input?: unknown): Promise<T> {
          const stub = stubs[name];
          let result: unknown;
          let error: string | undefined;
          try {
            if (!stub) throw new Error(`fake-db: no stub for service "${name}"`);
            result = stub(input);
          } catch (e) {
            error = (e as Error).message;
          }
          txLog.push({ name, input, result, error });
          if (error) throw new Error(error);
          return result as T;
        },
      };
      return cb(tx);
    },
  };
}
