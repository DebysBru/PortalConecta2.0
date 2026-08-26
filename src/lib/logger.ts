/**
 * Logger estruturado — Etapa 10 do plano RAG. Substitui `console.warn`/
 * `console.error` com strings soltas por linhas JSON com campos consistentes
 * (timestamp, nível, módulo, mensagem, contexto), pra dar observabilidade
 * real ao pipeline (grep/parse por módulo, correlacionar por `documentoId`
 * etc.) sem depender de nenhum serviço externo — funciona com qualquer
 * coletor de logs que leia stdout/stderr (Vercel, Railway, etc.).
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogFields = Record<string, unknown>;

function emit(level: LogLevel, modulo: string, mensagem: string, fields?: LogFields) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    modulo,
    mensagem,
    ...fields,
  };

  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export interface Logger {
  debug: (mensagem: string, fields?: LogFields) => void;
  info: (mensagem: string, fields?: LogFields) => void;
  warn: (mensagem: string, fields?: LogFields) => void;
  error: (mensagem: string, fields?: LogFields) => void;
}

/** Cria um logger fixado num módulo (ex.: `createLogger('indexador')`). */
export function createLogger(modulo: string): Logger {
  return {
    debug: (mensagem, fields) => emit('debug', modulo, mensagem, fields),
    info: (mensagem, fields) => emit('info', modulo, mensagem, fields),
    warn: (mensagem, fields) => emit('warn', modulo, mensagem, fields),
    error: (mensagem, fields) => emit('error', modulo, mensagem, fields),
  };
}
