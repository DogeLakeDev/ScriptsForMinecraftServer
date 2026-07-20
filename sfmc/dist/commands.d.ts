import { type ServiceName } from "./services.js";
export declare function cmdStatus(): string;
export declare function cmdLogs(args: string[], onFollow?: (serviceName: ServiceName) => void): string;
export declare function cmdStart(raw: string): Promise<string>;
export declare function cmdStop(raw: string): Promise<string>;
export declare function cmdSend(raw: string, message: string): Promise<string>;
export declare function cmdRestart(raw: string): Promise<string>;
export declare function cmdStartAll(): Promise<string>;
export declare function cmdStopAll(): Promise<string>;
export declare function cmdUpdate(args?: string[]): Promise<string>;
//# sourceMappingURL=commands.d.ts.map