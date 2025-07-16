import crypto from 'crypto';
import { ECPairFactory, ECPairAPI, ECPairInterface } from 'ecpair';
import * as tinysecp from 'tiny-secp256k1';

const ECPair: ECPairAPI = ECPairFactory(tinysecp);

export function generatePrivateKey(): string {
  let privateKey: Buffer;
  do {
    privateKey = crypto.randomBytes(32);
  } while (!tinysecp.isPrivate(privateKey));
  return privateKey.toString('hex');
}

export function getPublicKeyFromPrivate(privateKeyHex: string): string {
  try {
    const keyPair: ECPairInterface = ECPair.fromPrivateKey(Buffer.from(privateKeyHex, 'hex'), {});
    return Buffer.from(keyPair.publicKey).toString('hex');
  } catch (e) {
    throw new Error('Некорректный приватный ключ');
  }
} 