import readline from 'readline';
import fs from 'fs';
import fetch from 'node-fetch';
import { generatePrivateKey, getPublicKeyFromPrivate, getAddressFromPublicKey, createAndSignTransaction } from './wallet';

export async function askPrivateKey(): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    console.log('Введите приватный ключ (hex) или нажмите Enter для генерации нового:');
    rl.question('> ', (input: string) => {
      let privateKey: string;
      if (!input) {
        privateKey = generatePrivateKey();
      } else {
        privateKey = input.trim();
      }
      rl.close();
      resolve(privateKey);
    });
  });
}


export async function init(): Promise<{ privateKey: string; publicKey: string; address: string }> {
  try {
    const privateKey = await askPrivateKey();
    const publicKey = getPublicKeyFromPrivate(privateKey);
    const address = getAddressFromPublicKey(publicKey);
    fs.writeFileSync('.public_key', publicKey, 'utf-8');
    console.log('Приватный ключ:', privateKey);
    console.log('Публичный ключ:', publicKey);
    console.log('Адрес кошелька:', address);
    return { privateKey, publicKey, address };
  } catch (e: any) {
    console.error('Ошибка:', e.message);
    throw e;
  }
}

export async function balance() {
  const publicKey = await _getOrInitPublicKey()
  try {
    const address = getAddressFromPublicKey(publicKey);
    console.log('Адрес кошелька:', address);
    const resp = await fetch(`https://blockstream.info/api/address/${address}`);
    if (!resp.ok) throw new Error('Ошибка запроса к blockstream.info');
    const data = await resp.json();
    const btcBalance = (data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum) / 1e8;
    console.log('Баланс BTC:', btcBalance);
  } catch (e: any) {
    console.error('Ошибка:', e.message);
  }
}

export async function defaultCommand() {
  if (!fs.existsSync('.public_key')) {
    await init();
  } else {
    await balance();
  }
}

export async function _getOrInitPublicKey(): Promise<string> {
  if (fs.existsSync('.public_key')) {
    return fs.readFileSync('.public_key', 'utf-8').trim();
  } else {
    const { publicKey } = await init();
    return publicKey;
  }
}

export async function sendBtc(address: string, amount: string) {
  try {
    await _getOrInitPublicKey()
    // Получаем приватный ключ от пользователя
    const privateKey = await askPrivateKey();
    // Создаём и подписываем транзакцию
    const rawTx = await createAndSignTransaction(privateKey, address, parseFloat(amount));
    // Отправляем транзакцию через blockstream.info
    const resp = await fetch('https://blockstream.info/api/tx', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: rawTx
    });
    if (!resp.ok) throw new Error('Ошибка отправки транзакции');
    const txid = await resp.text();
    console.log('Транзакция отправлена! TXID:', txid);
  } catch (e: any) {
    console.error('Ошибка:', e.message);
  }
} 