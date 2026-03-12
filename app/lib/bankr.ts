/**
 * Bankr.bot AI assistant service.
 * Server-side only — uses BANKR_API_KEY env var.
 * Docs: https://api.bankr.bot
 */

const BANKR_BASE_URL = 'https://api.bankr.bot';

function getApiKey(): string {
  const key = process.env.BANKR_API_KEY;
  if (!key) throw new Error('BANKR_API_KEY not configured');
  return key;
}

/**
 * Send a prompt to bankr.bot and wait for the response.
 * Returns the completed response text.
 */
export async function promptBankr(prompt: string): Promise<string> {
  const apiKey = getApiKey();

  // 1. Submit the prompt
  const submitRes = await fetch(`${BANKR_BASE_URL}/agent/prompt`, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt }),
  });

  if (!submitRes.ok) {
    const text = await submitRes.text().catch(() => 'Unknown error');
    throw new Error(`Bankr prompt failed (${submitRes.status}): ${text}`);
  }

  const submitData = await submitRes.json();
  const jobId = submitData.jobId || submitData.id;

  if (!jobId) {
    // Some endpoints return the response directly
    return submitData.response || submitData.message || JSON.stringify(submitData);
  }

  // 2. Poll for job completion
  return pollJob(jobId);
}

/**
 * Poll a bankr job until it completes or times out.
 */
async function pollJob(jobId: string, timeoutMs = 30000): Promise<string> {
  const apiKey = getApiKey();
  const start = Date.now();
  const pollInterval = 2000; // 2 seconds

  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${BANKR_BASE_URL}/agent/job/${jobId}`, {
      headers: { 'X-API-Key': apiKey },
    });

    if (!res.ok) {
      throw new Error(`Bankr poll failed (${res.status})`);
    }

    const data = await res.json();

    if (data.status === 'completed' || data.status === 'done') {
      return data.response || data.result || data.message || JSON.stringify(data);
    }

    if (data.status === 'failed' || data.status === 'error') {
      throw new Error(data.error || data.message || 'Bankr job failed');
    }

    // Wait before next poll
    await new Promise((r) => setTimeout(r, pollInterval));
  }

  throw new Error('Bankr job timed out after 30s');
}

/**
 * Check if bankr.bot is configured.
 */
export function isBankrConfigured(): boolean {
  return !!process.env.BANKR_API_KEY;
}
