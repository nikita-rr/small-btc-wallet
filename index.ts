import { Command } from 'commander';
import fs from 'fs';
import { init, balance, defaultCommand } from './src/commands';

const program = new Command();

program
  .name('crypto-wallet')
  .description('Консольное приложение для работы с биткоин-кошельком')
  .version('1.0.0');

program
  .option('--init', 'Сгенерировать приватный/публичный ключ и сохранить публичный ключ в файл')
  .option('--balance', 'Показать баланс по адресу, используя сохранённый публичный ключ');

program.parse(process.argv);
const options = program.opts();

async function main() {
  if (options.init) {
    await init();
  } else if (options.balance) {
    await balance();
  } else {
    await defaultCommand();
  }
}

main(); 