'use client';

import { useCallback } from 'react';
import { BrowserProvider } from 'ethers';
import { ClobClient } from '@polymarket/clob-client';
import { useUserStore } from '@/app/lib/stores/user-store';

/**
 * Hook that handles the full wallet connection flow:
 * 1. MetaMask connect
 * 2. Derive Polymarket CLOB API credentials (client-side signing)
 * 3. Send encrypted credentials to our API
 * 4. Update zustand store
 */
export function useWalletConnect() {
  const { setConnecting, setConnected, disconnect, isConnecting } = useUserStore();

  const connect = useCallback(async () => {
    try {
      setConnecting(true);

      // 1. Check for injected wallet
      if (!window.ethereum) {
        throw new Error('No wallet detected. Please install MetaMask.');
      }

      // 2. Request account access
      const provider = new BrowserProvider(window.ethereum);
      await provider.send('eth_requestAccounts', []);

      // 2b. Switch to Polygon network (required for Polymarket CLOB)
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x89' }], // 137 in hex
        });
      } catch (switchError: any) {
        // Chain not added to wallet — add it
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x89',
              chainName: 'Polygon',
              nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
              rpcUrls: ['https://polygon-rpc.com'],
              blockExplorerUrls: ['https://polygonscan.com'],
            }],
          });
        } else {
          throw new Error('Please switch to Polygon network to continue.');
        }
      }

      // Re-create provider after chain switch
      const polygonProvider = new BrowserProvider(window.ethereum);
      const signer = await polygonProvider.getSigner();
      const address = await signer.getAddress();

      // 3. Derive Polymarket CLOB API credentials
      // This prompts the user to sign a message in MetaMask
      // The private key NEVER leaves the wallet

      // Shim: Polymarket CLOB client expects ethers v5 signer with _signTypedData,
      // but ethers v6 uses signTypedData (no underscore). Proxy it through.
      const signerShim = new Proxy(signer, {
        get(target, prop, receiver) {
          if (prop === '_signTypedData') {
            return target.signTypedData.bind(target);
          }
          return Reflect.get(target, prop, receiver);
        },
      });

      const clobClient = new ClobClient(
        'https://clob.polymarket.com',
        137, // Polygon chain ID
        signerShim as any
      );

      const credentials = await clobClient.deriveApiKey();

      if (!credentials.key || !credentials.secret || !credentials.passphrase) {
        throw new Error('Failed to derive API credentials');
      }

      // 4. Send credentials to our API for encrypted storage
      const res = await fetch('/api/wallet/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: address.toLowerCase(),
          apiKey: credentials.key,
          apiSecret: credentials.secret,
          apiPassphrase: credentials.passphrase,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to store credentials');
      }

      // 4b. If coming from Telegram bot (?userId=), send creds to bot
      const urlParams = new URLSearchParams(window.location.search);
      const telegramUserId = urlParams.get('userId');
      if (telegramUserId) {
        try {
          const botUrl = process.env.NEXT_PUBLIC_BOT_URL || 'https://easypoly-bot-production.up.railway.app';
          await fetch(`${botUrl}/callback/wallet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              telegramUserId,
              walletAddress: address.toLowerCase(),
              apiKey: credentials.key,
              apiSecret: credentials.secret,
              apiPassphrase: credentials.passphrase,
            }),
          });
          console.log('[WalletConnect] Sent credentials to Telegram bot');
        } catch (err) {
          console.error('[WalletConnect] Failed to notify bot:', err);
          // Non-critical — wallet is still connected on web
        }
      }

      // 5. Update store
      setConnected(address, true);

      // 6. Track referral or award signup points
      try {
        const refCode = typeof window !== 'undefined'
          ? localStorage.getItem('ep-ref-code')
          : null;

        if (refCode) {
          // Referred user — track referral (awards points to both)
          await fetch('/api/referrals/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              walletAddress: address.toLowerCase(),
              referralCode: refCode,
            }),
          });
          localStorage.removeItem('ep-ref-code');
        } else {
          // Award signup bonus (award endpoint handles deduplication)
          await fetch('/api/points/award', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              wallet: address.toLowerCase(),
              points: 100,
              reason: 'signup',
            }),
          });
        }
      } catch {
        // Non-critical — never block wallet connect
      }

      return address;
    } catch (err: any) {
      setConnecting(false);
      throw err;
    }
  }, [setConnecting, setConnected]);

  return { connect, disconnect, isConnecting };
}
