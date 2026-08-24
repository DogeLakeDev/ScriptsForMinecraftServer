/** @minecraft/server-net 薄 stub（真 HTTP 留给 smoke-modules）。 */
export const HttpRequestMethod = {
  Get: "Get",
  Post: "Post",
  Put: "Put",
  Delete: "Delete",
  Head: "Head",
};

export class HttpHeader {
  constructor(
    public key: string,
    public value: string
  ) {}
}

export class HttpRequest {
  method = HttpRequestMethod.Get;
  headers: HttpHeader[] = [];
  body = "";
  constructor(public uri: string) {}
  setMethod(m: string) {
    this.method = m;
    return this;
  }
  setBody(b: string) {
    this.body = b;
    return this;
  }
  setHeaders(h: HttpHeader[]) {
    this.headers = h;
    return this;
  }
}

export const http = {
  async request(_req: HttpRequest) {
    return { status: 200, body: "{}" };
  },
};
