type RemoteConfig = {
    enabled?: boolean;
    controller_url?: string;
    agent_id?: string;
    agent_secret?: string;
};
/** Start one outbound-only remote-management connection for this supervisor process. */
export declare function startRemoteAgent(): void;
export declare function enrollRemoteAgent(controllerUrl: string, enrollmentToken: string, name: string): Promise<string>;
export declare function remoteStatus(): Omit<RemoteConfig, "agent_secret">;
export {};
//# sourceMappingURL=remote-agent.d.ts.map