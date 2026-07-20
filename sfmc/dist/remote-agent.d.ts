type RemoteStatus = {
    enabled?: boolean;
    controller_url?: string;
    agent_id?: string;
    connected: boolean;
    last_error?: string;
    retry_in_ms?: number;
};
/** Close the active socket (if any) and stop reconnecting. Idempotent. */
export declare function stopRemoteAgent(): void;
/** Start one outbound-only remote-management connection for this supervisor process. */
export declare function startRemoteAgent(): void;
export declare function enrollRemoteAgent(controllerUrl: string, enrollmentToken: string, name: string): Promise<string>;
/** Disable the remote agent: clear enabled flag and close the connection. */
export declare function disableRemoteAgent(): void;
export declare function remoteStatus(): RemoteStatus;
export {};
//# sourceMappingURL=remote-agent.d.ts.map