import { verifySessionToken } from '@/lib/auth-helpers';

export class ChatAuthError extends Error {}

/** A cota acompanha o UID validado pelo Firebase, nunca um ID afirmado no corpo. */
export async function identidadeAutenticadaChat(request: Request): Promise<string> {
  const authorization = request.headers.get('authorization');
  if (!authorization) throw new ChatAuthError('Entre na sua conta do portal para perguntar à IFizinha.');
  const token = authorization.match(/^Bearer\s+(\S+)$/i)?.[1];
  const session = await verifySessionToken(token);
  if (!session.ok) throw new ChatAuthError('Sua sessão expirou. Entre novamente para perguntar à IFizinha.');
  return `conta:${session.uid}`;
}
