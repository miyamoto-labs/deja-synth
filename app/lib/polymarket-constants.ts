'use client';

import {
  getCreate2Address,
  keccak256,
  encodeAbiParameters,
} from 'viem';

/* ── Contract addresses (Polygon mainnet, chain 137) ── */
export const USDC_TOKEN    = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' as const;
export const CTF_TOKEN     = '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045' as const;
export const EXCHANGE      = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E' as const;
export const NEG_RISK_EXCH = '0xC5d563A36AE78145C45a50134d48A1215220f80a' as const;
export const NEG_RISK_ADPT = '0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296' as const;

export const SAFE_FACTORY = '0xaacFeEa03eb1561C4e67d661e40682Bd20E3541b' as const;
export const SAFE_INIT_CODE_HASH = '0x2bce2127ff07fb632d16c8347c4ebf501f4841168bed00d9e6ef715ddb6fcecf' as const;

export const CLOB_API_URL = 'https://clob.polymarket.com';
export const RELAYER_URL  = 'https://relayer-v2.polymarket.com/';

export const MAX_UINT256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');

/* ── ABI fragments ── */
export const ERC1155_IS_APPROVED_ABI = [{
  name: 'isApprovedForAll',
  type: 'function',
  inputs: [
    { name: 'account', type: 'address' },
    { name: 'operator', type: 'address' },
  ],
  outputs: [{ name: '', type: 'bool' }],
  stateMutability: 'view',
}] as const;

/* ── Safe address derivation ── */
export function deriveSafeAddress(eoaAddress: `0x${string}`): `0x${string}` {
  return getCreate2Address({
    bytecodeHash: SAFE_INIT_CODE_HASH,
    from: SAFE_FACTORY,
    salt: keccak256(
      encodeAbiParameters(
        [{ name: 'address', type: 'address' }],
        [eoaAddress]
      )
    ),
  });
}

/* ── EIP-1193 signer for ClobClient ── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CompatSigner = any;

function buildTypedDataPayload(domain: any, types: any, value: any) {
  const domainTypes: { name: string; type: string }[] = [];
  if (domain.name !== undefined) domainTypes.push({ name: 'name', type: 'string' });
  if (domain.version !== undefined) domainTypes.push({ name: 'version', type: 'string' });
  if (domain.chainId !== undefined) domainTypes.push({ name: 'chainId', type: 'uint256' });
  if (domain.verifyingContract !== undefined) domainTypes.push({ name: 'verifyingContract', type: 'address' });
  if (domain.salt !== undefined) domainTypes.push({ name: 'salt', type: 'bytes32' });

  const serializedDomain = { ...domain };
  if (serializedDomain.chainId !== undefined) {
    serializedDomain.chainId = Number(serializedDomain.chainId);
  }

  const serializedValue: Record<string, any> = {};
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === 'bigint') {
      serializedValue[k] = v.toString();
    } else if (typeof v === 'number') {
      serializedValue[k] = v;
    } else {
      serializedValue[k] = v;
    }
  }

  return {
    types: { EIP712Domain: domainTypes, ...types },
    primaryType: Object.keys(types)[0],
    domain: serializedDomain,
    message: serializedValue,
  };
}

export function makeEip1193Signer(address: string, provider: any): CompatSigner {
  const signTypedDataFn = async (domain: any, types: any, value: any) => {
    const typedData = buildTypedDataPayload(domain, types, value);
    console.log('[Signer] signTypedData called for', typedData.primaryType);

    const sig = await provider.request({
      method: 'eth_signTypedData_v4',
      params: [address, JSON.stringify(typedData)],
    });

    console.log('[Signer] Signature received:', sig?.substring(0, 20) + '...');
    return sig;
  };

  return {
    getAddress: async () => address,
    _signTypedData: signTypedDataFn,
    signTypedData: signTypedDataFn,
    provider,
  };
}
