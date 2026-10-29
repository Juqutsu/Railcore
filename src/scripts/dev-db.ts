// Local development database: a real PostgreSQL 18 from the embedded-postgres package, so no
// Docker is needed. It runs in the background like a normal server; data lives in .dev-db/.
// Usage: tsx src/scripts/dev-db.ts start | stop
import { spawn } from 'node:child_process';
import { closeSync, existsSync, openSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { arch, platform } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import pg from 'pg';

const ROOT = join(import.meta.dirname, '..', '..', '.dev-db');
const DATA = join(ROOT, 'data');
const LOG = join(ROOT, 'postgres.log');
const PORT = 5433;
const USER = 'postgres';
const PASSWORD = 'postgres';
const DATABASE = 'railcore';

// The same per-platform binary packages that embedded-postgres itself chooses from.
const os = ({ win32: 'windows', darwin: 'darwin', linux: 'linux' } as Record<string, string>)[
  platform()
];
const { initdb, pg_ctl, postgres } = (await import(`@embedded-postgres/${os}-${arch()}`)) as {
  initdb: string;
  pg_ctl: string;
  postgres: string;
};

/** Runs a binary to completion and resolves with its exit code. */
function run(file: string, args: string[], quiet = false): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { stdio: quiet ? 'ignore' : 'inherit', windowsHide: true });
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? 1));
  });
}

const connect = async (database = 'postgres') => {
  const client = new pg.Client({
    host: 'localhost',
    port: PORT,
    user: USER,
    password: PASSWORD,
    database,
  });
  await client.connect();
  return client;
};

async function start(): Promise<void> {
  if (!existsSync(DATA)) {
    await mkdir(ROOT, { recursive: true });
    const pwfile = join(ROOT, 'pwfile');
    await writeFile(pwfile, PASSWORD);
    try {
      const args = ['-D', DATA, '-U', USER, `--pwfile=${pwfile}`, '-A', 'scram-sha-256'];
      const code = await run(initdb, [...args, '-E', 'UTF8', '--locale=C']);
      if (code !== 0) throw new Error(`initdb failed with exit code ${code}`);
    } finally {
      await rm(pwfile, { force: true });
    }
  }

  // pg_ctl status exits with 0 only while the server is running.
  if ((await run(pg_ctl, ['status', '-D', DATA], true)) !== 0) {
    // Started directly instead of through pg_ctl: on Windows, pg_ctl ties the server to this
    // terminal, so it dies when the terminal closes.
    const serverArgs = ['-D', DATA, '-p', String(PORT), '-c', 'listen_addresses=localhost'];
    let exited = false;
    if (platform() === 'win32') {
      // A console-less postgres.exe makes Windows open a visible console window for every backend
      // it starts. Start-Process gives it one hidden console that all backends share, and
      // Postgres writes its own log file, because that console has nowhere to show output.
      const args = [
        ...serverArgs,
        '-c',
        'logging_collector=on',
        '-c',
        `log_directory=${ROOT}`,
        '-c',
        'log_filename=postgres.log',
      ];
      const argLine = args.map((arg) => `"${arg}"`).join(' ');
      const quote = (text: string) => `'${text.replaceAll("'", "''")}'`;
      const command = `Start-Process -FilePath ${quote(postgres)} -ArgumentList ${quote(argLine)} -WindowStyle Hidden`;
      await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], true);
    } else {
      const log = openSync(LOG, 'a');
      const server = spawn(postgres, serverArgs, { detached: true, stdio: ['ignore', log, log] });
      closeSync(log);
      server.once('exit', () => (exited = true));
      server.unref();
    }

    for (let attempt = 0; ; attempt++) {
      if (exited || attempt === 60) throw new Error(`Postgres didn't start, see ${LOG}`);
      const client = await connect().catch(() => null);
      if (client) {
        await client.end();
        break;
      }
      await sleep(500);
    }
  }

  const client = await connect();
  try {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      DATABASE,
    ]);
    if (!rowCount) await client.query(`CREATE DATABASE ${DATABASE}`);
  } finally {
    await client.end();
  }
  console.log(`Postgres is running: postgres://${USER}:${PASSWORD}@localhost:${PORT}/${DATABASE}`);
}

async function stop(): Promise<void> {
  if (existsSync(DATA) && (await run(pg_ctl, ['status', '-D', DATA], true)) === 0) {
    await run(pg_ctl, ['stop', '-D', DATA, '-m', 'fast']);
  }
  console.log('Postgres is stopped');
}

const command = process.argv[2] ?? 'start';
if (command === 'start') await start();
else if (command === 'stop') await stop();
else {
  console.error('Usage: dev-db.ts start | stop');
  process.exitCode = 1;
}
