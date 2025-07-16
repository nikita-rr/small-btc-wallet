import crypto from 'crypto';
import { ECPairFactory, ECPairAPI, ECPairInterface } from 'ecpair';
import * as tinysecp from 'tiny-secp256k1';
import { payments } from 'bitcoinjs-lib';

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

export function getAddressFromPublicKey(publicKeyHex: string): string {
  const publicKeyBuffer = Buffer.from(publicKeyHex, 'hex');
  const { address } = payments.p2pkh({ pubkey: publicKeyBuffer });
  if (!address) throw new Error('Не удалось получить адрес');
  return address;
} 