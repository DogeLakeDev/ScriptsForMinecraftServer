/** 测试用 @minecraft/server-net 薄 stub（仅满足 HttpDB / 客户端 import）。 */
export const HttpRequestMethod = {
  GET: "GET",
  POST: "POST",
  PUT: "PUT",
  DELETE: "DELETE",
  HEAD: "HEAD",
  Get: "Get",
  Post: "Post",
  Put: "Put",
  Delete: "Delete",
  Head: "Head",
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
