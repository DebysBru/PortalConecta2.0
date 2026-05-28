/**
 * Armazenamento em memória de tokens temporários de verificação SUAP.
 * Válidos por 10 minutos — usados para completar o vínculo Google após SUAP verificado.
 */

interface PendingSuapVerification {
  username: string;
  name: string;
  email: string;
  fotoUrl: string | null;
  expiresAt: number;
}

const pendingMap = new Map<string, PendingSuapVerification>();

function cleanup() {
  const now = Date.now();
  pendingMap.forEach((value, key) => {
    if (value.expiresAt < now) pendingMap.delete(key);
  });
}

export function createPendingToken(data: Omit<PendingSuapVerification, 'expiresAt'>): string {
  cleanup();
  const token = crypto.randomUUID();
  pendingMap.set(token, { ...data, expiresAt: Date.now() + 10 * 60 * 1000 }); // 10 min
  return token;
}

export function consumePendingToken(token: string): PendingSuapVerification | null {
  cleanup();
  const data = pendingMap.get(token);
  if (!data) return null;
  if (data.expiresAt < Date.now()) {
    pendingMap.delete(token);
    return null;
  }
  pendingMap.delete(token); // consume once
  return data;
}
