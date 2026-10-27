/**
 * Perfil de demonstração de ALUNO no Portal Conecta.
 *
 * Complementa `prisma/professor-demo.ts`: para apresentar o portal do ponto de
 * vista do estudante é preciso uma conta que consiga ENTRAR e que tenha algo
 * para mostrar na área do aluno (`/meus-dados`).
 *
 * Regras que valem para aluno (bem mais simples que as de professor):
 *  - qualquer e-mail que não esteja em `ADMIN_EMAILS` e não coordene projeto é
 *    ESTUDANTE por padrão (`resolveUserRole`, em `src/lib/permissions.ts`) —
 *    não precisa de nenhum vínculo para o papel funcionar;
 *  - o login é por e-mail/senha do Firebase (o usuário do banco sozinho não
 *    autentica — ver `src/contexts/AuthContext.tsx`);
 *  - a área do aluno é `/meus-dados` (é para onde o painel manda quem não é
 *    ADMIN nem PROFESSOR — ver `admin/(protected)/layout.tsx`).
 *
 * Usa `aluno.teste@ifpr.edu.br`, que já existe no banco e no Firebase
 * (provider "password", sem senha definida — por isso não conseguia entrar).
 *
 * O que este script garante:
 *  - `PerfilAluno` preenchido (curso do catálogo, ano de ingresso, semestre,
 *    áreas de interesse e habilidades), para o formulário não abrir vazio;
 *  - 2 inscrições nos projetos de demonstração do professor de teste (uma
 *    "recebida" e uma "em_analise"), para "Minhas inscrições" ter conteúdo.
 *
 * Nada aqui toca projeto real: as inscrições são só nos projetos de demo, que
 * nascem em RASCUNHO e não aparecem em `/projetos`.
 *
 * Comandos:
 *   npm run db:aluno-demo              # cria/recria perfil e inscrições de demo
 *   npm run db:aluno-demo remover      # apaga o perfil e as inscrições de demo
 *   npm run db:aluno-demo -- --dry-run # valida tudo e reverte (não grava)
 *
 * A senha do Firebase não é tratada aqui — ver o cabeçalho de professor-demo.ts.
 */
import './_env';
import { PrismaClient, type Prisma } from '@prisma/client';

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');
const REMOVER = process.argv.includes('remover');

const EMAIL_ALUNO = 'aluno.teste@ifpr.edu.br';
const NOME_ALUNO = 'Aluno Teste';
const ANO = new Date().getFullYear();

/** Projetos criados por `prisma/professor-demo.ts` (as inscrições de demo vivem neles). */
const HORTA = 'horta-pedagogica-e-compostagem-no-campus';
const ROBOTICA = 'programacao-e-robotica-para-iniciantes';

const dias = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

type Cliente = PrismaClient | Prisma.TransactionClient;

/**
 * Curso tirado do catálogo de `src/lib/perfil-academico.ts` de propósito: o
 * formulário é um `<select>` dessas opções e a action rejeita valor fora do
 * catálogo (`ehCursoConhecido`). "Técnico em Informática", que estava no campo
 * legado `User.curso`, não existe no catálogo e por isso não pré-preenchia nada.
 */
const PERFIL = {
  curso: 'Informática Integrado',
  anoIngresso: 2024,
  semestreAtual: 3,
  telefone: '(43) 99999-1111',
  areasInteresse: ['Tecnologia', 'Robótica', 'Extensão'],
  habilidades: ['Programação em Python', 'Arduino', 'Inglês intermediário'],
  experienciasPrevias:
    'Participação na Feira de Inovação Tecnológica do campus e em oficinas de robótica do projeto de extensão.',
};

const INSCRICOES = [
  {
    projetoSlug: HORTA,
    status: 'recebida',
    tipoInteresse: 'BOLSISTA' as const,
    justificativa: 'Quero aprender compostagem para aplicar na horta da minha casa.',
  },
  {
    projetoSlug: ROBOTICA,
    status: 'em_analise',
    tipoInteresse: 'VOLUNTARIO' as const,
    justificativa: 'Tenho interesse em robótica e já mexi com Arduino em projetos pessoais.',
  },
];

async function remover(db: Cliente) {
  const usuario = await db.user.findUnique({ where: { email: EMAIL_ALUNO }, select: { id: true } });
  if (!usuario) {
    console.log(`Usuário ${EMAIL_ALUNO} não existe neste banco.`);
    return;
  }

  const projetos = await db.projeto.findMany({
    where: { slug: { in: [HORTA, ROBOTICA] } },
    select: { id: true },
  });
  const idsProjetos = projetos.map((p) => p.id);

  const inscricoes = await db.inscricao.deleteMany({
    where: { user_id: usuario.id, projeto_id: { in: idsProjetos } },
  });
  const perfil = await db.perfilAluno.deleteMany({ where: { userId: usuario.id } });

  console.log(
    `Removidos: ${perfil.count} perfil(is) acadêmico(s), ${inscricoes.count} inscrição(ões) de demonstração.`,
  );
  console.log(`Usuário ${EMAIL_ALUNO} mantido (continua ESTUDANTE; a conta do Firebase não é tocada).`);
}

async function criar(db: Cliente) {
  // ── 1. Usuário ───────────────────────────────────────────────────────────
  const aluno = await db.user.upsert({
    where: { email: EMAIL_ALUNO },
    update: {
      name: NOME_ALUNO,
      role: 'ESTUDANTE',
      // Campo legado, mostrado em alguns lugares; alinhado ao catálogo.
      curso: PERFIL.curso,
    },
    create: {
      email: EMAIL_ALUNO,
      name: NOME_ALUNO,
      role: 'ESTUDANTE',
      curso: PERFIL.curso,
    },
    select: { id: true, email: true, role: true },
  });
  console.log(`Usuário: ${aluno.email} | ${aluno.role}`);

  // ── 2. Perfil acadêmico ──────────────────────────────────────────────────
  const dadosPerfil = {
    curso: PERFIL.curso,
    anoIngresso: PERFIL.anoIngresso,
    semestreAtual: PERFIL.semestreAtual,
    // Referência do cálculo automático de semestre: o portal avança o
    // semestre sozinho a partir desta data (`semestreAtual`, em
    // src/lib/perfil-academico.ts).
    semestreReferencia: new Date(),
    telefone: PERFIL.telefone,
    areasInteresse: PERFIL.areasInteresse,
    habilidades: PERFIL.habilidades,
    experienciasPrevias: PERFIL.experienciasPrevias,
  };
  await db.perfilAluno.upsert({
    where: { userId: aluno.id },
    update: dadosPerfil,
    create: { userId: aluno.id, ...dadosPerfil },
  });
  console.log(
    `Perfil: ${PERFIL.curso} | ingresso ${PERFIL.anoIngresso} | ${PERFIL.semestreAtual}º semestre | ${PERFIL.areasInteresse.length} áreas de interesse`,
  );

  // ── 3. Inscrições nos projetos de demonstração ───────────────────────────
  const projetos = await db.projeto.findMany({
    where: { slug: { in: [HORTA, ROBOTICA] } },
    select: { id: true, slug: true, nome: true },
  });
  const projetoPorSlug = new Map(projetos.map((p) => [p.slug, p]));

  if (projetos.length === 0) {
    console.log(
      '\n⚠️  Nenhum projeto de demonstração encontrado. Rode `npm run db:professor-demo` antes para criá-los.',
    );
  }

  // Recria só as inscrições DESTE aluno nos projetos de demo (idempotente).
  const idsProjetos = projetos.map((p) => p.id);
  await db.inscricao.deleteMany({ where: { user_id: aluno.id, projeto_id: { in: idsProjetos } } });

  const existentes = await db.inscricao.findMany({
    where: { protocolo: { startsWith: `PRJ-${ANO}-` } },
    select: { protocolo: true },
  });
  let seq = 0;
  for (const e of existentes) {
    const n = Number(e.protocolo.slice(`PRJ-${ANO}-`.length));
    if (Number.isFinite(n) && n > seq) seq = n;
  }

  let criadas = 0;
  let indice = 0;
  for (const item of INSCRICOES) {
    const projeto = projetoPorSlug.get(item.projetoSlug);
    if (!projeto) continue;
    seq += 1;
    indice += 1;
    await db.inscricao.create({
      data: {
        protocolo: `PRJ-${ANO}-${String(seq).padStart(6, '0')}`,
        projeto_id: projeto.id,
        user_id: aluno.id,
        nome_completo: NOME_ALUNO,
        email: EMAIL_ALUNO,
        telefone: PERFIL.telefone,
        curso: PERFIL.curso,
        // Formato histórico do campo: "<ano de ingresso>.<semestre do curso>"
        // (ver `formatarSemestreInscricao`, src/lib/perfil-academico.ts).
        semestre: `${PERFIL.anoIngresso}.${PERFIL.semestreAtual}`,
        idade: 17,
        tipo_interesse: item.tipoInteresse,
        disponibilidade: 'Tarde (contraturno)',
        experiencia_previa: PERFIL.experienciasPrevias,
        justificativa: item.justificativa,
        ciencia_regras: true,
        consentimento_lgpd: true,
        campos_extra: {},
        status: item.status,
        created_at: dias(-indice),
      },
    });
    criadas += 1;
    console.log(`Inscrição: ${projeto.nome} | ${item.status}`);
  }

  console.log(`\nInscrições de demonstração: ${criadas}`);
  console.log(`Login: ${EMAIL_ALUNO} (senha no Firebase → Authentication → Users)`);
  console.log('Área do aluno: /meus-dados');
}

async function main() {
  console.log('Alvo:', (process.env.DATABASE_URL ?? '(sem DATABASE_URL)').replace(/:\/\/[^@]*@/, '://***@'));
  console.log('Modo:', `${REMOVER ? 'REMOVER' : 'CRIAR'}${DRY_RUN ? ' (simulação — tudo é revertido)' : ''}`);

  const acao = async (db: Cliente) => (REMOVER ? remover(db) : criar(db));

  if (!DRY_RUN) {
    await acao(prisma);
    return;
  }

  const ROLLBACK = new Error('__dry_run__');
  try {
    await prisma.$transaction(
      async (tx) => {
        await acao(tx);
        throw ROLLBACK;
      },
      { timeout: 120_000, maxWait: 20_000 },
    );
  } catch (e) {
    if (e !== ROLLBACK) throw e;
  }
  console.log('\nSimulação concluída — nada foi gravado.');
}

main()
  .catch((e) => {
    console.error('ERRO:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
