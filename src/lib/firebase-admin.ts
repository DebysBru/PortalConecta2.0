/**
 * Firebase Admin SDK — usado server-side para criar custom tokens (login SUAP)
 * Credenciais: baixe a service account em Firebase Console →
 * Configurações do projeto → Contas de serviço → Gerar nova chave privada
 */
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

function getAdminApp(): App {
  if (getApps().length > 0) return getApps()[0]!;

  const projectId   = process.env.FIREBASE_ADMIN_PROJECT_ID   ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey  = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!clientEmail || !privateKey || !projectId) {
    throw new Error(
      'Firebase Admin não configurado. Adicione ao .env.local:\n' +
      '  FIREBASE_ADMIN_PROJECT_ID\n' +
      '  FIREBASE_ADMIN_CLIENT_EMAIL\n' +
      '  FIREBASE_ADMIN_PRIVATE_KEY\n' +
      'Obtenha em: Firebase Console → Configurações → Contas de serviço → Gerar chave privada'
    );
  }

  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}
