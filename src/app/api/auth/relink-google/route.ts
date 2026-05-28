/**
 * POST /api/auth/relink-google
 *
 * Troca o e-mail Google vinculado à conta SUAP do usuário logado.
 * Recebe o ID token do novo Google autenticado.
 *
 * Body: { currentEmail: string, firebaseIdToken: string }
 * Returns: { customToken } — novo token para o UID SUAP (sessão continua)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const { currentEmail, firebaseIdToken } = await req.json() as {
      currentEmail?: string;
      firebaseIdToken?: string;
    };

    if (!currentEmail || !firebaseIdToken) {
      return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 });
    }

    const adminAuth = getAdminAuth();

    // ── 1. Verificar ID token do novo Google ───────────────────────────────────
    let newEmail: string;
    let newName: string | undefined;
    let newPhoto: string | undefined;

    try {
      const decoded = await adminAuth.verifyIdToken(firebaseIdToken);
      newEmail = decoded.email ?? '';
      newName  = decoded.name;
      newPhoto = decoded.picture;
      if (!newEmail) throw new Error('Token sem e-mail.');
    } catch (err) {
      console.error('[relink-google] Token inválido:', err);
      return NextResponse.json({ error: 'Token Google inválido. Tente novamente.' }, { status: 401 });
    }

    // ── 2. Buscar usuário atual pelo e-mail antigo ──────────────────────────────
    const user = await prisma.user.findUnique({
      where: { email: currentEmail },
      select: { id: true, suapUsername: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
    }

    // ── 3. Verificar se o novo e-mail já está em uso por outra conta ───────────
    if (newEmail !== currentEmail) {
      const conflict = await prisma.user.findUnique({ where: { email: newEmail }, select: { id: true } });
      if (conflict && conflict.id !== user.id) {
        return NextResponse.json(
          { error: 'Este e-mail Google já está vinculado a outra conta.' },
          { status: 409 },
        );
      }
    }

    // ── 4. Atualizar e-mail (e nome/foto se disponíveis) ───────────────────────
    await prisma.user.update({
      where: { id: user.id },
      data: {
        email: newEmail,
        ...(newName  ? { name: newName }   : {}),
        ...(newPhoto ? { image: newPhoto }  : {}),
        googleLinked: true,
      },
    });

    // ── 5. Re-emitir custom token para o UID SUAP (sessão continua) ────────────
    if (user.suapUsername) {
      const customToken = await adminAuth.createCustomToken(`suap_${user.suapUsername}`, {
        suapUsername: user.suapUsername,
        email: newEmail,
      });
      return NextResponse.json({ customToken, newEmail });
    }

    // Usuário sem SUAP (só Google) — apenas retorna ok
    return NextResponse.json({ newEmail });

  } catch (err) {
    console.error('[relink-google] Erro:', err);
    return NextResponse.json({ error: 'Erro interno. Tente novamente.' }, { status: 500 });
  }
}
