export type ServiceState = "ok" | "error";

export interface DatabaseStatus {
  status: ServiceState;
  latencyMs: number;
  version?: string;
  error?: string;
}

/** Response body of the API's `GET /status`. */
export interface StatusResponse {
  api: {
    status: ServiceState;
    version: string;
    uptimeSeconds: number;
  };
  database: DatabaseStatus;
}
