/**
 * CTF (Conditional Token Framework) event decoder for Polymarket on-chain trades.
 *
 * Decodes ERC-1155 TransferSingle events emitted by the CTF contract
 * when trades settle through the Exchange or NegRisk Exchange.
 */

// ERC-1155 TransferSingle(address operator, address from, address to, uint256 id, uint256 value)
export const TRANSFER_SINGLE_TOPIC =
  '0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62';

// Polymarket CTF contract on Polygon
export const CTF_CONTRACT = '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045';

// Exchange contracts that act as operator for real trades
export const CTF_EXCHANGE = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E';
export const NEGRISK_EXCHANGE = '0xC5d563A36AE78145C45a50134d48A1215220f80a';

export const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000';

export interface DecodedTransferSingle {
  operator: string;
  from: string;
  to: string;
  tokenId: string;
  shares: number;
}

/**
 * Decode a TransferSingle event from raw log topics + data.
 *
 * Topics layout:
 *   [0] = event signature (TRANSFER_SINGLE_TOPIC)
 *   [1] = operator (address, left-padded to 32 bytes)
 *   [2] = from (address, left-padded to 32 bytes)
 *   [3] = to (address, left-padded to 32 bytes)
 *
 * Data layout:
 *   bytes 0-31  = uint256 tokenId
 *   bytes 32-63 = uint256 value (shares)
 */
export function decodeTransferSingle(
  topics: string[],
  data: string,
): DecodedTransferSingle {
  const extractAddress = (topic: string) =>
    '0x' + topic.slice(-40).toLowerCase();

  const operator = extractAddress(topics[1]);
  const from = extractAddress(topics[2]);
  const to = extractAddress(topics[3]);

  // data is 0x + 64 hex chars (tokenId) + 64 hex chars (value)
  const cleanData = data.startsWith('0x') ? data.slice(2) : data;
  const tokenId = BigInt('0x' + cleanData.slice(0, 64)).toString();
  const shares =
    Number(BigInt('0x' + cleanData.slice(64, 128))) / 1e6; // CTF uses 6 decimals (USDC-based)

  return { operator, from, to, tokenId, shares };
}

/**
 * Check if the operator is one of the known Polymarket exchange contracts.
 * Only trades routed through these exchanges are real market trades.
 */
export function isExchangeOperator(operator: string): boolean {
  const normalized = operator.toLowerCase();
  return (
    normalized === CTF_EXCHANGE.toLowerCase() ||
    normalized === NEGRISK_EXCHANGE.toLowerCase()
  );
}
