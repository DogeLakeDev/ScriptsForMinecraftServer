/** 测试用 @minecraft/server-net 薄 stub（仅满足 HttpDB / 客户端 import）。 */
export const HttpRequestMethod = {
  Get: "Get",
  Post: "Post",
  Put: "Put",
  Delete: "Delete",
  Head: "Head",
  Patch: "Patch",
  GET: "Get",
  POST: "Post",
  PUT: "Put",
  DELETE: "Delete",
  HEAD: "Head",
  PATCH: "Patch",
};

export class HttpHeader {
  constructor(key, value) {
    this.key = key;
    this.value = value;
  }
}

export class HttpRequest {
  constructor(uri) {
    this.uri = uri;
    this.method = HttpRequestMethod.Get;
    this.headers = [];
    this.body = "";
    this.timeout = 0;
  }
  addHeader(key, value) {
    this.headers.push(new HttpHeader(key, value));
    return this;
  }
  setMethod(m) {
    this.method = m;
    return this;
  }
  setBody(b) {
    this.body = b;
    return this;
  }
}

export const http = {
  async get() {
    return { status: 200, body: "{}" };
  },
  async request() {
    return { status: 200, body: "{}" };
  },
};
