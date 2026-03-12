/**
 * Browser-safe BuilderConfig replacement.
 *
 * The @polymarket/builder-signing-sdk's BuilderConfig uses axios for remote
 * signing calls. In Next.js client bundles this can silently fail due to
 * module-resolution or bundling issues with axios + Node.js `crypto`.
 *
 * This drop-in uses the browser's native `fetch` API instead and provides
 * clear error logging so failures are never silent.
 *
 * Duck-types the interface that RelayClient / ClobClient expect:
 *   - isValid(): boolean
 *   - generateBuilderHeaders(method, path, body, timestamp?): Promise<headers | undefined>
 */

const SIGN_URL = () =>
  typeof window !== 'undefined'
    ? `${window.location.origin}/api/polymarket/sign`
    : '/api/polymarket/sign';

export class BrowserBuilderConfig {
  private url: string;

  constructor(url?: string) {
    this.url = url || SIGN_URL();
  }

  isValid(): boolean {
    return true;
  }

  async generateBuilderHeaders(
    method: string,
    path: string,
    body?: string,
    _timestamp?: number,
  ): Promise<Record<string, string> | undefined> {
    try {
      const resp = await fetch(this.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method, path, body }),
      });

      if (!resp.ok) {
        const text = await resp.text();
        console.error(
          '[BrowserBuilderConfig] Sign endpoint returned error:',
          resp.status,
          text,
        );
        return undefined;
      }

      const headers = await resp.json();

      return headers;
    } catch (err) {
      console.error('[BrowserBuilderConfig] Failed to call sign endpoint:', err);
      return undefined;
    }
  }
}
