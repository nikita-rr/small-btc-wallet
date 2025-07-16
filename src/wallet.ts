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

  // Получаем актуальную комиссию (sat/vByte)
  const feeResp = await fetch('https://blockstream.info/api/fee-estimates');
  if (!feeResp.ok) throw new Error('Ошибка получения комиссии');
  const feeData = await feeResp.json();
  // Берём комиссию для подтверждения в 1 блок (можно изменить на 3 или 6 для экономии)
  const feeRate = Math.ceil(feeData["1"] || 10); // sat/vByte

  // Считаем сумму и выбираем UTXO
  let total = 0;
  const selectedUtxos = [];
  const satoshiAmount = Math.round(amountBtc * 1e8);
  // Оценка размера транзакции: 180 байт на вход, 34 байта на выход, 10 байт на структуру
  // Для простоты: 1 вход = 180, 2 выхода = 2*34, +10
  // Позже пересчитаем точнее
  let inputCount = 0;
  for (const utxo of utxos) {
    selectedUtxos.push(utxo);
    total += utxo.value;
    inputCount++;
    // Оценка размера транзакции
    const outputCount = 2; // получатель + сдача
    const txSize = inputCount * 180 + outputCount * 34 + 10;
    const fee = feeRate * txSize;
    if (total >= satoshiAmount + fee) break;
  }
  // Финальный расчёт размера и комиссии
  const outputCount = 2;
  const txSize = inputCount * 180 + outputCount * 34 + 10;
  const fee = feeRate * txSize;
  if (total < satoshiAmount + fee) throw new Error('Недостаточно средств (с учётом комиссии)');

  // Формируем транзакцию
  const { TransactionBuilder, networks } = require('bitcoinjs-lib');
  const network = networks.bitcoin;
  const txb = new TransactionBuilder(network);
  for (const utxo of selectedUtxos) {
    txb.addInput(utxo.txid, utxo.vout);
  }
  txb.addOutput(toAddress, satoshiAmount);
  const change = total - satoshiAmount - fee;
  if (change > 0) {
    txb.addOutput(fromAddress, change);
  }
  selectedUtxos.forEach((_, i) => {
    txb.sign({ prevOutScriptType: 'p2pkh', vin: i, keyPair });
  });
  const tx = txb.build();
  return tx.toHex();
} 