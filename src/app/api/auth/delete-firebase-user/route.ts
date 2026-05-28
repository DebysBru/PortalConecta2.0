/**
 * POST /api/auth/delete-firebase-user
 *
 * Deleta o usuário Firebase (Admin SDK) após a conta ser deletada do banco.
 * O cliente chama este endpoint e depois faz signOut.
 *
 * Body: { firebaseIdToken: string }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const { firebaseIdToken } = await req.json() as { firebaseIdToken?: string };

    if (!firebaseIdToken) {
      return NextResponse.json({ error: 'Token ausente.' }, { status: 400 });
    }

    const adminAuth = getAdminAuth();

    // Verificar token e obter UID
    const decoded = await adminAuth.verifyIdToken(firebaseIdToken);

    // Deletar usuário do Firebase Authentication
    await adminAuth.deleteUser(decoded.uid);

    return NextResponse.json({ ok: true });
  } catch (err) {
    // Não crítico — o usuário já foi deletado do banco
    console.warn('[delete-firebase-user] Aviso:', err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: true, warning: 'Conta Firebase não removida (já pode ter sido removida).' });
  }
}
