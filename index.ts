import readline from 'readline';
import { generatePrivateKey, getPublicKeyFromPrivate } from './src/wallet';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('Введите приватный ключ (hex) или нажмите Enter для генерации нового:');
rl.question('> ', (input: string) => {
  let privateKey: string;
  if (!input) {
    privateKey = generatePrivateKey();
    console.log('Сгенерирован приватный ключ:', privateKey);
  } else {
    privateKey = input.trim();
  }
  try {
    const publicKey = getPublicKeyFromPrivate(privateKey);
    console.log('Публичный ключ:', publicKey);
  } catch (e: any) {
    console.error('Ошибка:', e.message);
  }
  rl.close();
}); 