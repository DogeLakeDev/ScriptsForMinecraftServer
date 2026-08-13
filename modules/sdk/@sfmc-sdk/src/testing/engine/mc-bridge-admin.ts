/** @minecraft/server-admin 薄 stub（含 AllowList / kick 供模块单测）。 */

export class SecretString {
  constructor(private value: string) {}
  toString() {
    return this.value;
  }
}

export const secrets = {
  get(_name: string): SecretString | undefined {
    return undefined;
  },
};

export const variables = {
  get(_name: string): string | undefined {
    return undefined;
  },
};

const allowListStore = new Set<string>();

function entryName(player: string | { name?: string }): string {
  if (typeof player === "string") return player;
  return String(player.name ?? "");
}

export class AllowList {
  get enabled(): boolean {
    return true;
  }
  get entries(): Array<{ name: string }> {
    return [...allowListStore].map((name) => ({ name }));
  }
  add(player: string | { name?: string }): void {
    const name = entryName(player);
    if (name) allowListStore.add(name);
  }
  remove(player: string | { name?: string }): void {
    const name = entryName(player);
    if (name) allowListStore.delete(name);
  }
  contains(player: string | { name?: string }): boolean {
    const name = entryName(player);
    return name ? allowListStore.has(name) : false;
  }
  reloadFile(): void {
    /* no-op in stub */
  }
  clear(): void {
    allowListStore.clear();
  }
}

export const dedicatedServer: { allowList: AllowList } | undefined = {
  allowList: new AllowList(),
};

export function kickPlayer(_player: unknown, _reason?: string): void {
  /* stub */
}

export function opPlayer(_player: unknown): void {
  /* stub */
}

export function deopPlayer(_player: unknown): void {
  /* stub */
}

export function transferPlayer(_player: unknown, _opts: unknown): void {
  /* stub */
}

export const beforeEvents = {
  asyncPlayerJoin: {
    subscribe(_cb: unknown): void {
      /* stub */
    },
    unsubscribe(_cb: unknown): void {
      /* stub */
    },
  },
};
