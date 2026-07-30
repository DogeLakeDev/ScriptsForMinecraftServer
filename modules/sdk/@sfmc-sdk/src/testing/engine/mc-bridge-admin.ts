/** @minecraft/server-admin 薄 stub。 */
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
