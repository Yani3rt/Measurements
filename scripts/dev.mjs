import {spawn} from 'node:child_process';
import process from 'node:process';
import readline from 'node:readline';

const commands = [
  {
    args: ['run', 'dev:server'],
    color: '\x1b[33m',
    label: 'api',
  },
  {
    args: ['run', 'dev:client'],
    color: '\x1b[36m',
    label: 'web',
  },
];

const children = [];
let shuttingDown = false;

function pipeOutput(stream, label, color) {
  const reset = '\x1b[0m';
  const prefix = `${color}[${label}]${reset}`;
  const interfaceInstance = readline.createInterface({input: stream});

  interfaceInstance.on('line', (line) => {
    console.log(`${prefix} ${line}`);
  });

  return interfaceInstance;
}

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }

  process.exit(exitCode);
}

for (const command of commands) {
  const child = spawn('pnpm', command.args, {
    cwd: process.cwd(),
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  pipeOutput(child.stdout, command.label, command.color);
  pipeOutput(child.stderr, command.label, command.color);

  child.on('exit', (code) => {
    if (!shuttingDown) {
      shutdown(code ?? 0);
    }
  });

  children.push(child);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
