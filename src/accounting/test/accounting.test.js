const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DataProgram,
  Operations,
  formatAmount,
  parseAmount,
  run,
} = require('../index');

function createOutput() {
  return {
    text: '',
    write(value) {
      this.text += value;
    },
  };
}

function createInput(...values) {
  return {
    question: async () => values.shift(),
  };
}

async function executeOperation(operationType, amount, initialBalanceCents = 100000) {
  const output = createOutput();
  const operations = new Operations(
    new DataProgram(initialBalanceCents),
    createInput(amount),
    output,
  );
  await operations.execute(operationType);
  return { balanceCents: operations.dataProgram.read(), output: output.text };
}

async function runMenu(...choices) {
  const output = createOutput();
  const input = {
    question: async () => choices.shift(),
    close() {},
  };
  await run(input, output);
  return output.text;
}

test('TC-001: starts with the account menu and initial balance', async () => {
  const output = await runMenu('4');
  assert.match(output, /Account Management System/);
  assert.match(output, /1\. View Balance/);
  assert.match(output, /2\. Credit Account/);
  assert.match(output, /3\. Debit Account/);
  assert.match(output, /4\. Exit/);
});

test('TC-002: views the initial balance', async () => {
  const output = await runMenu('1', '4');
  assert.match(output, /Current balance: 1000\.00/);
});

test('TC-003: credits the account and reports the new balance', async () => {
  const result = await executeOperation('CREDIT', '250.00');
  assert.equal(result.balanceCents, 125000);
  assert.match(result.output, /Amount credited\. New balance: 1250\.00/);
});

test('TC-004: debits the account and reports the new balance', async () => {
  const result = await executeOperation('DEBIT ', '250.00');
  assert.equal(result.balanceCents, 75000);
  assert.match(result.output, /Amount debited\. New balance: 750\.00/);
});

test('TC-005: accepts a zero credit without changing the balance', async () => {
  const result = await executeOperation('CREDIT', '0.00');
  assert.equal(result.balanceCents, 100000);
  assert.match(result.output, /Amount credited\. New balance: 1000\.00/);
});

test('TC-006: preserves cents on a credit', async () => {
  const result = await executeOperation('CREDIT', '10.25');
  assert.equal(result.balanceCents, 101025);
  assert.equal(formatAmount(result.balanceCents), '1010.25');
});

test('TC-007: permits a debit equal to the available balance', async () => {
  const result = await executeOperation('DEBIT ', '1000.00');
  assert.equal(result.balanceCents, 0);
  assert.match(result.output, /New balance: 0\.00/);
});

test('TC-008: permits a debit that leaves one cent', async () => {
  const result = await executeOperation('DEBIT ', '999.99');
  assert.equal(result.balanceCents, 1);
  assert.match(result.output, /New balance: 0\.01/);
});

test('TC-009: rejects a debit greater than the available balance', async () => {
  const result = await executeOperation('DEBIT ', '1000.01');
  assert.equal(result.balanceCents, 100000);
  assert.equal(result.output, 'Insufficient funds for this debit.\n');
});

test('TC-010: rejects a debit from a zero balance', async () => {
  const result = await executeOperation('DEBIT ', '0.01', 0);
  assert.equal(result.balanceCents, 0);
  assert.match(result.output, /Insufficient funds/);
});

test('TC-011: accepts a zero debit without changing the balance', async () => {
  const result = await executeOperation('DEBIT ', '0.00');
  assert.equal(result.balanceCents, 100000);
  assert.match(result.output, /Amount debited\. New balance: 1000\.00/);
});

test('TC-012: represents the COBOL numeric balance limit in cents', () => {
  assert.equal(parseAmount('999999.99'), 99999999);
  assert.equal(formatAmount(99999999), '999999.99');
});

test('TC-013 and TC-014: reject menu choices outside 1 through 4', async () => {
  const output = await runMenu('0', '5', '4');
  assert.equal((output.match(/Invalid choice, please select 1-4\./g) || []).length, 2);
});

test('TC-015: exits with the goodbye message', async () => {
  const output = await runMenu('4');
  assert.match(output, /Exiting the program\. Goodbye!/);
});

test('TC-016: uses the latest balance across multiple transactions', async () => {
  const dataProgram = new DataProgram();
  const output = createOutput();
  const operations = new Operations(
    dataProgram,
    createInput('100.00', '40.00'),
    output,
  );
  await operations.execute('CREDIT');
  await operations.execute('DEBIT ');
  await operations.execute('TOTAL ');
  assert.equal(dataProgram.read(), 106000);
  assert.match(output.text, /Current balance: 1060\.00/);
});

test('TC-017: leaves the balance unchanged after a rejected debit', async () => {
  const dataProgram = new DataProgram();
  const output = createOutput();
  const operations = new Operations(
    dataProgram,
    createInput('1000.01', '50.00'),
    output,
  );
  await operations.execute('DEBIT ');
  await operations.execute('CREDIT');
  assert.equal(dataProgram.read(), 105000);
});

test('TC-018: balance inquiry does not change the balance', async () => {
  const dataProgram = new DataProgram();
  const output = createOutput();
  const operations = new Operations(dataProgram, createInput('25.00'), output);
  await operations.execute('TOTAL ');
  await operations.execute('CREDIT');
  await operations.execute('TOTAL ');
  assert.equal(dataProgram.read(), 102500);
  assert.match(output.text, /Current balance: 1000\.00[\s\S]*Current balance: 1025\.00/);
});

test('TC-019: initializes a new data store at 1000.00', () => {
  const firstRun = new DataProgram();
  firstRun.write(125000);
  const restartedRun = new DataProgram();
  assert.equal(restartedRun.read(), 100000);
});

test('TC-020: reads the stored balance', () => {
  const dataProgram = new DataProgram();
  assert.equal(dataProgram.read(), 100000);
});

test('TC-021: writes and then reads a new balance', () => {
  const dataProgram = new DataProgram();
  dataProgram.write(123456);
  assert.equal(dataProgram.read(), 123456);
});

test('TC-022: ignores an unsupported operation without changing storage', async () => {
  const dataProgram = new DataProgram();
  const output = createOutput();
  const operations = new Operations(dataProgram, createInput(), output);
  await operations.execute('UNKNOWN');
  assert.equal(dataProgram.read(), 100000);
  assert.equal(output.text, '');
});

test('TC-023: rejects a nonnumeric menu value and continues', async () => {
  const output = await runMenu('X', '4');
  assert.match(output, /Invalid choice, please select 1-4\./);
  assert.match(output, /Exiting the program\. Goodbye!/);
});

test('TC-024: rejects a nonnumeric transaction amount without changing storage', async () => {
  const result = await executeOperation('CREDIT', 'ABC');
  assert.equal(result.balanceCents, 100000);
  assert.match(result.output, /Invalid amount/);
});

test('TC-025: rejects a negative transaction amount without changing storage', async () => {
  const result = await executeOperation('DEBIT ', '-1.00');
  assert.equal(result.balanceCents, 100000);
  assert.match(result.output, /Invalid amount/);
});
