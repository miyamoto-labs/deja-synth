/**
 * MoonPay Wallet Service
 * Interfaces with MoonPay CLI for wallet operations
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import crypto from 'crypto';

const execAsync = promisify(exec);

export interface WalletData {
  walletId: string;
  walletName: string;
  addresses: {
    solana: string;
    ethereum: string; // Same for all EVM chains
    bitcoin: string;
    tron: string;
  };
  encryptedPrivateKey: string; // For user download
}

export interface TokenBalance {
  chain: string;
  token: string;
  amount: number;
  usdValue: number;
}

/**
 * Create a new MoonPay wallet
 */
export async function createWallet(
  userId: string,
  agentName: string
): Promise<WalletData> {
  try {
    // 1. Generate unique wallet name
    const sanitizedName = agentName.toLowerCase().replace(/\s+/g, '-');
    const walletName = `easypoly-${userId}-${sanitizedName}-${Date.now()}`;

    // 2. Create wallet via MoonPay CLI
    console.log(`Creating wallet: ${walletName}`);
    await execAsync(`mp wallet create --name "${walletName}"`);

    // 3. Get wallet addresses
    const { stdout: walletsJson } = await execAsync('mp wallet list --json');
    const wallets = JSON.parse(walletsJson);
    const wallet = wallets.find((w: any) => w.name === walletName);

    if (!wallet) {
      throw new Error('Wallet created but not found in list');
    }

    // 4. Export private key (encrypted)
    const { stdout: privateKeyJson } = await execAsync(
      `mp wallet export --name "${walletName}" --format json`
    );
    const keyData = JSON.parse(privateKeyJson);

    // 5. Encrypt private key with user-specific key
    const encryptedKey = encryptPrivateKey(
      keyData.privateKey || keyData.mnemonic,
      userId
    );

    return {
      walletId: walletName, // Using wallet name as ID
      walletName,
      addresses: {
        solana: wallet.solana || '',
        ethereum: wallet.evm || '',
        bitcoin: wallet.bitcoin || '',
        tron: wallet.tron || '',
      },
      encryptedPrivateKey: encryptedKey,
    };
  } catch (error: any) {
    console.error('Error creating wallet:', error);
    throw new Error(`Failed to create wallet: ${error.message}`);
  }
}

/**
 * Export private key for user download (decrypted)
 */
export async function exportPrivateKey(
  walletName: string,
  userId: string,
  encryptedKey: string
): Promise<any> {
  try {
    // Decrypt the stored private key
    const privateKey = decryptPrivateKey(encryptedKey, userId);

    // Get wallet addresses
    const { stdout: walletsJson } = await execAsync('mp wallet list --json');
    const wallets = JSON.parse(walletsJson);
    const wallet = wallets.find((w: any) => w.name === walletName);

    if (!wallet) {
      throw new Error('Wallet not found');
    }

    return {
      walletName,
      privateKey,
      addresses: {
        solana: wallet.solana,
        ethereum: wallet.evm,
        bitcoin: wallet.bitcoin,
        tron: wallet.tron,
      },
      warning:
        'NEVER SHARE THIS FILE. Anyone with this key can access your funds.',
    };
  } catch (error: any) {
    console.error('Error exporting private key:', error);
    throw new Error(`Failed to export private key: ${error.message}`);
  }
}

/**
 * Get wallet balance
 */
export async function getBalance(
  walletName: string,
  chain: string = 'polygon'
): Promise<TokenBalance[]> {
  try {
    const { stdout: balancesJson } = await execAsync(
      `mp token balance list --wallet "${walletName}" --chain ${chain} --json`
    );

    const balances = JSON.parse(balancesJson);

    return balances.map((b: any) => ({
      chain: b.chain || chain,
      token: b.symbol || b.token,
      amount: parseFloat(b.amount || b.balance || '0'),
      usdValue: parseFloat(b.usdValue || b.value || '0'),
    }));
  } catch (error: any) {
    console.error('Error getting balance:', error);
    throw new Error(`Failed to get balance: ${error.message}`);
  }
}

/**
 * Get USDC balance specifically (Polygon chain for Polymarket)
 */
export async function getUSDCBalance(walletName: string): Promise<number> {
  try {
    const balances = await getBalance(walletName, 'polygon');
    const usdcBalance = balances.find(
      (b) => b.token.toUpperCase() === 'USDC'
    );
    return usdcBalance?.amount || 0;
  } catch (error: any) {
    console.error('Error getting USDC balance:', error);
    return 0;
  }
}

/**
 * Execute swap (for bridging/swapping tokens if needed)
 */
export async function swap(params: {
  walletName: string;
  fromChain: string;
  fromToken: string;
  toChain: string;
  toToken: string;
  amount: number;
}): Promise<string> {
  try {
    const { stdout } = await execAsync(
      `mp token swap --wallet "${params.walletName}" ` +
        `--from-chain ${params.fromChain} --from-token ${params.fromToken} ` +
        `--to-chain ${params.toChain} --to-token ${params.toToken} ` +
        `--amount ${params.amount} --json`
    );

    const result = JSON.parse(stdout);
    return result.transactionHash || result.txHash || 'unknown';
  } catch (error: any) {
    console.error('Error executing swap:', error);
    throw new Error(`Failed to execute swap: ${error.message}`);
  }
}

/**
 * Encrypt private key with user-specific key
 */
function encryptPrivateKey(privateKey: string, userId: string): string {
  const userSecret = deriveUserSecret(userId);
  const cipher = crypto.createCipher('aes-256-gcm', userSecret);

  let encrypted = cipher.update(privateKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return encrypted;
}

/**
 * Decrypt private key with user-specific key
 */
function decryptPrivateKey(encryptedKey: string, userId: string): string {
  const userSecret = deriveUserSecret(userId);
  const decipher = crypto.createDecipher('aes-256-gcm', userSecret);

  let decrypted = decipher.update(encryptedKey, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Derive user-specific encryption secret
 * In production, this should use a proper key derivation function
 */
function deriveUserSecret(userId: string): string {
  const masterSecret =
    process.env.WALLET_ENCRYPTION_SECRET || 'default-secret-change-me';
  return crypto
    .createHash('sha256')
    .update(`${masterSecret}-${userId}`)
    .digest('hex');
}
