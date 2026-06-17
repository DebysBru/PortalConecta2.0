/**
 * POST /api/auth/complete-suap-link
 *
 * Completa o vínculo SUAP + Google após o usuário autenticar via Google popup.
 * Recebe o token temporário de verificação SUAP + o ID token Firebase do Google.
 *
 * Body: { pendingToken: string, firebaseIdToken: string }
 * Returns: { customToken } — Firebase custom token para o UID suap_<username>
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';
import { prisma } from '@/lib/prisma';
import { consumePendingToken } from '@/lib/suap-pending';

export async function POST(req: NextRequest) {
  try {
    const { pendingToken, firebaseIdToken } = await req.json() as {
      pendingToken?: string;
      firebaseIdToken?: string;
    };

    if (!pendingToken || !firebaseIdToken) {
      return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 });
    }

    // ── 1. Validar token temporário SUAP ────────────────────────────────────────
    const suapData = consumePendingToken(pendingToken);
    if (!suapData) {
      return NextResponse.json(
        { error: 'Token de verificação expirado ou inválido. Faça login SUAP novamente.' },
        { status: 401 },
      );
    }

    // ── 2. Verificar ID token do Google via Firebase Admin ──────────────────────
    let googleEmail: string;
    let googleName: string | undefined;
    let googlePhoto: string | undefined;
    let googleUid: string;

    try {
      const adminAuth = getAdminAuth();
      const decoded = await adminAuth.verifyIdToken(firebaseIdToken);
      googleEmail = decoded.email ?? '';
      googleName  = decoded.name;
      googlePhoto = decoded.picture;
      googleUid   = decoded.uid;

      if (!googleEmail) throw new Error('Google token sem e-mail.');
    } catch (err) {
      console.error('[complete-suap-link] Erro ao verificar ID token Google:', err);
      return NextResponse.json({ error: 'Token Google inválido. Tente novamente.' }, { status: 401 });
    }

    // ── 3. Criar/atualizar usuário no banco vinculando SUAP + Google ────────────
    const firebaseUid = `suap_${suapData.username}`;

    const user = await prisma.user.upsert({
      where: { email: googleEmail },
      create: {
        email: googleEmail,
        name: googleName ?? suapData.name,
        image: googlePhoto ?? suapData.fotoUrl ?? undefined,
        role: 'PROFESSOR',
        suapUsername: suapData.username,
        suapNome: suapData.name,
        suapEmail: suapData.email,
        suapFoto: suapData.fotoUrl ?? undefined,
        googleLinked: true,
      },
      update: {
        name: googleName ?? suapData.name,
        image: googlePhoto ?? suapData.fotoUrl ?? undefined,
        suapUsername: suapData.username,
        suapNome: suapData.name,
        suapEmail: suapData.email,
        suapFoto: suapData.fotoUrl ?? undefined,
        googleLinked: true,
      },
    });

    // ── 4. Gerar Firebase Custom Token para o UID SUAP ──────────────────────────
    const adminAuth = getAdminAuth();
    const customToken = await adminAuth.createCustomToken(firebaseUid, {
      suapUsername: suapData.username,
      email: user.email,
      name: user.name ?? suapData.name,
      googleUid,
    });

    return NextResponse.json({
      customToken,
      user: {
        name: user.name,
        email: user.email,
        username: suapData.username,
        image: user.image,
      },
    });

  } catch (err) {
    console.error('[complete-suap-link] Erro:', err);
    return NextResponse.json({ error: 'Erro interno. Tente novamente.' }, { status: 500 });
  }
}
