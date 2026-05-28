/**
 * POST /api/auth/suap-login
 *
 * Verifica credenciais SUAP.
 * - Se o usuário já tem Google vinculado → retorna Firebase Custom Token.
 * - Se é a primeira vez (sem vínculo) → retorna `needsGoogleLink: true` +
 *   token temporário de verificação + dados do perfil SUAP.
 *
 * Body: { username: string, password: string }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';
import { prisma } from '@/lib/prisma';
import { createPendingToken } from '@/lib/suap-pending';

const SUAP_BASE  = process.env.SUAP_BASE_URL ?? 'https://suap.ifpr.edu.br';
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

interface SuapTokenResponse { access: string; refresh: string }
interface SuapProfile {
  id?: number;
  nome_usual?: string;
  nome?: string;
  email?: string;
  email_institucional?: string;
  matricula?: string;
  foto?: string;
  url_foto_75x100?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json() as { username?: string; password?: string };

    if (!username || !password) {
      return NextResponse.json({ error: 'Informe matrícula e senha.' }, { status: 400 });
    }

    // ── 1. Verificar credenciais no SUAP ────────────────────────────────────────
    const tokenRes = await fetch(`${SUAP_BASE}/api/token/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': BROWSER_UA },
      body: JSON.stringify({ username, password }),
      cache: 'no-store',
    });

    if (!tokenRes.ok) {
      if (tokenRes.status === 401) {
        return NextResponse.json(
          { error: 'Matrícula ou senha incorretos. Verifique suas credenciais SUAP.' },
          { status: 401 },
        );
      }
      return NextResponse.json(
        { error: `SUAP indisponível (${tokenRes.status}). Tente novamente.` },
        { status: 502 },
      );
    }

    const tokens = await tokenRes.json() as SuapTokenResponse;

    // ── 2. Buscar perfil do usuário no SUAP ─────────────────────────────────────
    let profile: SuapProfile = {};
    try {
      // Tenta /api/rh/meus-dados/ (servidores) e /api/eu/ (alunos)
      for (const path of ['/api/rh/meus-dados/', '/api/eu/']) {
        const r = await fetch(`${SUAP_BASE}${path}`, {
          headers: { Authorization: `Bearer ${tokens.access}`, Accept: 'application/json', 'User-Agent': BROWSER_UA },
          cache: 'no-store',
        });
        if (r.ok) { profile = await r.json() as SuapProfile; break; }
      }
    } catch { /* perfil não obrigatório */ }

    const displayName = profile.nome_usual ?? profile.nome ?? username;
    const suapEmail   = profile.email_institucional ?? profile.email ?? `${username}@alunos.ifpr.edu.br`;
    const fotoUrl     = profile.url_foto_75x100
      ? (profile.url_foto_75x100.startsWith('http') ? profile.url_foto_75x100 : `${SUAP_BASE}${profile.url_foto_75x100}`)
      : (profile.foto
        ? (profile.foto.startsWith('http') ? profile.foto : `${SUAP_BASE}${profile.foto}`)
        : null);

    // ── 3. Verificar se já existe usuário com Google vinculado ──────────────────
    const existingUser = await prisma.user.findFirst({
      where: { suapUsername: username },
      select: { id: true, email: true, googleLinked: true },
    });

    const firebaseUid = `suap_${username}`;

    // ── 4a. Usuário já vinculou Google → login direto ───────────────────────────
    if (existingUser?.googleLinked) {
      // Atualiza dados do SUAP
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { suapNome: displayName, suapEmail, suapFoto: fotoUrl },
      });

      try {
        const adminAuth = getAdminAuth();
        const customToken = await adminAuth.createCustomToken(firebaseUid, {
          suapUsername: username, email: existingUser.email, name: displayName,
        });
        return NextResponse.json({ customToken, user: { name: displayName, email: existingUser.email, username } });
      } catch (err) {
        console.warn('[SUAP Login] Firebase Admin não configurado:', err instanceof Error ? err.message : err);
        // Fallback sem Firebase Admin
        return NextResponse.json({
          fallback: true,
          user: { name: displayName, email: existingUser.email, username },
        });
      }
    }

    // ── 4b. Primeira vez ou sem vínculo → pedir Google ──────────────────────────
    const pendingToken = createPendingToken({ username, name: displayName, email: suapEmail, fotoUrl });

    return NextResponse.json({
      needsGoogleLink: true,
      pendingToken,
      suapProfile: { name: displayName, email: suapEmail, username, fotoUrl },
    });

  } catch (err) {
    console.error('[SUAP Login] Erro:', err);
    return NextResponse.json({ error: 'Erro interno ao processar o login.' }, { status: 500 });
  }
}
