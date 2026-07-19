import { IncomingMessage, ServerResponse } from "node:http";
export type Req = IncomingMessage;
export type Res = ServerResponse;
export type RouteHandler = (req: Req, res: Res, params: Record<string, string>) => Promise<void> | void;
export interface Route {
    method: "GET" | "POST" | "PUT" | "DELETE";
    path: string;
    handler: RouteHandler;
}
