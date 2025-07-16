import crypto from 'crypto';
import { ECPairFactory, ECPairAPI, ECPairInterface } from 'ecpair';
import * as tinysecp from 'tiny-secp256k1';
import { payments } from 'bitcoinjs-lib';
import fetch from 'node-fetch';

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

export async function createAndSignTransaction(privateKeyHex: string, toAddress: string, amountBtc: number): Promise<string> {
  // Получаем публичный ключ и адрес отправителя
  const keyPair: ECPairInterface = ECPair.fromPrivateKey(Buffer.from(privateKeyHex, 'hex'), {});
  const publicKeyBuffer = Buffer.from(keyPair.publicKey);
  const { address: fromAddress } = payments.p2pkh({ pubkey: publicKeyBuffer });
  if (!fromAddress) throw new Error('Не удалось получить адрес отправителя');

  // Получаем UTXO через blockstream.info
  const utxoResp = await fetch(`https://blockstream.info/api/address/${fromAddress}/utxo`);
  if (!utxoResp.ok) throw new Error('Ошибка получения UTXO');
  const utxos = await utxoResp.json();
  if (!Array.isArray(utxos) || utxos.length === 0) throw new Error('Нет средств для отправки');

  // Считаем сумму и выбираем UTXO
  let total = 0;
  const selectedUtxos = [];
  const satoshiAmount = Math.round(amountBtc * 1e8);
  for (const utxo of utxos) {
    selectedUtxos.push(utxo);
    total += utxo.value;
    if (total >= satoshiAmount + 1000) break; // 1000 сатоши на комиссию
  }
  if (total < satoshiAmount + 1000) throw new Error('Недостаточно средств (с учётом комиссии)');

  // Формируем транзакцию
  const { TransactionBuilder, networks } = require('bitcoinjs-lib');
  const network = networks.bitcoin;
  const txb = new TransactionBuilder(network);
  for (const utxo of selectedUtxos) {
    txb.addInput(utxo.txid, utxo.vout);
  }
  txb.addOutput(toAddress, satoshiAmount);
  const change = total - satoshiAmount - 1000;
  if (change > 0) {
    txb.addOutput(fromAddress, change);
  }
  selectedUtxos.forEach((_, i) => {
    txb.sign({ prevOutScriptType: 'p2pkh', vin: i, keyPair });
  });
  const tx = txb.build();
  return tx.toHex();
} 