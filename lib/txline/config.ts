// lib/txline/config.ts
//
// Verified against https://txline-docs.txodds.com/documentation/quickstart
// and cross-checked against the txoracle IDL's `address` field and
// `TXLINE_MINT` constant (they match exactly).

import { PublicKey } from '@solana/web3.js';

export type TxLineNetwork = 'mainnet' | 'devnet';

interface TxLineNetworkConfig {
  rpcUrl: string;
  apiOrigin: string;
  programId: PublicKey;
  txlTokenMint: PublicKey;
}

export const TXLINE_CONFIG: Record<TxLineNetwork, TxLineNetworkConfig> = {
  mainnet: {
    rpcUrl: 'https://api.mainnet-beta.solana.com',
    apiOrigin: 'https://txline.txodds.com',
    programId: new PublicKey('9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA'),
    txlTokenMint: new PublicKey('Zhw9TVKp68a1QrftncMSd6ELXKDtpVMNuMGr1jNwdeL'),
  },
  devnet: {
    rpcUrl: 'https://api.devnet.solana.com',
    apiOrigin: 'https://txline-dev.txodds.com',
    programId: new PublicKey('6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J'),
    txlTokenMint: new PublicKey('4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG'),
  },
};

export const ACTIVE_NETWORK: TxLineNetwork =
  (process.env.TXLINE_NETWORK as TxLineNetwork) || 'devnet';

export const activeConfig = TXLINE_CONFIG[ACTIVE_NETWORK];
export const apiOrigin = process.env.TXLINE_API_ORIGIN || activeConfig.apiOrigin;
export const apiBaseUrl = `${apiOrigin}/api`;

// Confirmed: service level 1 is the World Cup / Intl Friendlies free tier.
export const WORLD_CUP_FREE_SERVICE_LEVEL = 1;
