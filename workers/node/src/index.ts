/**
 * SAAC Node.js Worker — Entry Point
 * ===================================
 *
 * Orquestador JSON Lines: lee WorkerRequest de stdin,
 * despacha al parser/extractor correspondiente, y escribe
 * WorkerResponse a stdout.
 *
 * Protocolo (§6.3):
 *   - Una línea JSON por mensaje (JSON Lines)
 *   - stdin:  WorkerRequest
 *   - stdout: WorkerResponse
 *   - stderr: logs de debug (no se parsean)
 */

import * as readline from 'node:readline';
import * as process from 'node:process';
import { parseTypeScriptFile } from './parsers/typescript.js';

// ── Tipos del protocolo (inline para evitar problemas de path aliases en runtime) ──

interface ParsePayload {
  filePath: string;
  language?: string;
  fileHash?: string;
  content?: string;
}

interface AnalyzePayload {
  files: ParsePayload[];
  projectConfig?: Record<string, unknown>;
}

interface WorkerRequest {
  requestId: string;
  command: 'parse' | 'analyze' | 'extract-metrics' | 'detect-patterns' | 'shutdown';
  payload: ParsePayload | AnalyzePayload;
}

interface WorkerResponse {
  requestId: string;
  status: 'success' | 'error' | 'partial';
  data?: unknown;
  error?: string;
  progress?: { processed: number; total: number; currentFile: string };
}

// ── Helpers ──

/** Escribe una línea JSON a stdout (protocolo JSON Lines) */
function respond(response: WorkerResponse): void {
  process.stdout.write(JSON.stringify(response) + '\n');
}

/** Log a stderr (no interfiere con el protocolo stdout) */
function log(message: string): void {
  process.stderr.write(`[saac-worker] ${message}\n`);
}

// ── Handlers por comando ──

async function handleParse(requestId: string, payload: ParsePayload): Promise<void> {
  try {
    const result = await parseTypeScriptFile(payload.filePath, payload.content);
    respond({ requestId, status: 'success', data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`Error parsing ${payload.filePath}: ${message}`);
    respond({ requestId, status: 'error', error: message });
  }
}

async function handleAnalyzeBatch(requestId: string, payload: AnalyzePayload): Promise<void> {
  const files = payload.files;
  const results: Array<{
    filePath: string;
    status: 'success' | 'parse_error';
    result?: unknown;
    errorMessage?: string;
  }> = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      // Reportar progreso
      respond({
        requestId,
        status: 'partial',
        progress: { processed: i, total: files.length, currentFile: file.filePath },
      });

      const result = await parseTypeScriptFile(file.filePath, file.content);
      results.push({ filePath: file.filePath, status: 'success', result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log(`Error analyzing ${file.filePath}: ${message}`);
      results.push({ filePath: file.filePath, status: 'parse_error', errorMessage: message });
    }
  }

  respond({ requestId, status: 'success', data: { results } });
}

// ── Main loop ──

async function processRequest(line: string): Promise<void> {
  let request: WorkerRequest;

  try {
    request = JSON.parse(line) as WorkerRequest;
  } catch {
    respond({ requestId: 'unknown', status: 'error', error: 'Invalid JSON input' });
    return;
  }

  const { requestId, command, payload } = request;

  switch (command) {
    case 'parse':
      await handleParse(requestId, payload as ParsePayload);
      break;

    case 'analyze':
      await handleAnalyzeBatch(requestId, payload as AnalyzePayload);
      break;

    case 'shutdown':
      log('Shutdown command received. Exiting.');
      respond({ requestId, status: 'success', data: { message: 'Worker shutting down' } });
      process.exit(0);
      break;

    default:
      respond({ requestId, status: 'error', error: `Unknown command: ${command}` });
  }
}

// ── Inicialización ──

log('Worker started. Waiting for commands on stdin...');

const rl = readline.createInterface({
  input: process.stdin,
  terminal: false,
});

rl.on('line', (line: string) => {
  // Ignorar líneas vacías
  if (line.trim().length === 0) return;
  processRequest(line).catch((err) => {
    log(`Unhandled error: ${err}`);
  });
});

rl.on('close', () => {
  log('stdin closed. Exiting.');
  process.exit(0);
});
