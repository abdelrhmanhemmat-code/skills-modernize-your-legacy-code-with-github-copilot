const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');

const INITIAL_BALANCE_CENTS = 100000;

class DataProgram {
  constructor(initialBalanceCents = INITIAL_BALANCE_CENTS) {
    this.storageBalanceCents = initialBalanceCents;
  }

  read() {
    return this.storageBalanceCents;
  }

  write(balanceCents) {
    this.storageBalanceCents = balanceCents;
  }
}

class Operations {
  constructor(dataProgram, input, output) {
    this.dataProgram = dataProgram;
    this.input = input;
    this.output = output;
  }

  async execute(operationType) {
    switch (operationType) {
      case 'TOTAL ':
        this.output.write(`Current balance: ${formatAmount(this.dataProgram.read())}\n`);
        break;
      case 'CREDIT':
        await this.credit();
        break;
      case 'DEBIT ':
        await this.debit();
        break;
      default:
        break;
    }
  }

  async credit() {
    const amountCents = await this.readAmount('Enter credit amount: ');
    if (amountCents === null) return;

    const balanceCents = this.dataProgram.read() + amountCents;
    this.dataProgram.write(balanceCents);
    this.output.write(`Amount credited. New balance: ${formatAmount(balanceCents)}\n`);
  }

  async debit() {
    const amountCents = await this.readAmount('Enter debit amount: ');
    if (amountCents === null) return;

    const balanceCents = this.dataProgram.read();
    if (balanceCents >= amountCents) {
      const newBalanceCents = balanceCents - amountCents;
      this.dataProgram.write(newBalanceCents);
      this.output.write(`Amount debited. New balance: ${formatAmount(newBalanceCents)}\n`);
    } else {
      this.output.write('Insufficient funds for this debit.\n');
    }
  }

  async readAmount(prompt) {
    const input = await this.input.question(prompt);
    const amountCents = parseAmount(input);
    if (amountCents === null || amountCents < 0) {
      this.output.write('Invalid amount, please enter a non-negative amount with up to two decimal places.\n');
      return null;
    }
    return amountCents;
  }
}

function parseAmount(value) {
  const normalizedValue = value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(normalizedValue)) return null;

  const [whole, fraction = ''] = normalizedValue.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

function formatAmount(amountCents) {
  return (amountCents / 100).toFixed(2);
}

async function run(inputStream = stdin, output = stdout) {
  const input = typeof inputStream.question === 'function'
    ? inputStream
    : readline.createInterface({ input: inputStream, output });
  const dataProgram = new DataProgram();
  const operations = new Operations(dataProgram, input, output);

  try {
    let continueRunning = true;
    while (continueRunning) {
      output.write('--------------------------------\n');
      output.write('Account Management System\n');
      output.write('1. View Balance\n');
      output.write('2. Credit Account\n');
      output.write('3. Debit Account\n');
      output.write('4. Exit\n');
      output.write('--------------------------------\n');
      const choice = await input.question('Enter your choice (1-4): ');

      switch (choice.trim()) {
        case '1':
          await operations.execute('TOTAL ');
          break;
        case '2':
          await operations.execute('CREDIT');
          break;
        case '3':
          await operations.execute('DEBIT ');
          break;
        case '4':
          continueRunning = false;
          break;
        default:
              output.write('Invalid choice, please select 1-4.\n');
      }
    }
            output.write('Exiting the program. Goodbye!\n');
  } finally {
    if (typeof input.close === 'function') input.close();
  }
}

if (require.main === module) {
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  DataProgram,
  Operations,
  formatAmount,
  parseAmount,
  run,
};
