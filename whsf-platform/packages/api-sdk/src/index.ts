import { serviceHealthSchema, type ServiceHealth } from "@whsf/shared";

export interface WhsfApiClientOptions {
  baseUrl: string;
  fetcher?: typeof fetch;
}

export class WhsfApiClient {
  readonly #baseUrl: string;
  readonly #fetcher: typeof fetch;

  constructor({ baseUrl, fetcher = fetch }: WhsfApiClientOptions) {
    this.#baseUrl = baseUrl.replace(/\/$/, "");
    this.#fetcher = fetcher;
  }

  async health(signal?: AbortSignal): Promise<ServiceHealth> {
    const response = await this.#fetcher(
      `${this.#baseUrl}/health`,
      signal ? { signal } : undefined,
    );
    if (!response.ok) throw new Error(`WHSF API returned ${response.status}`);
    return serviceHealthSchema.parse(await response.json());
  }
}
