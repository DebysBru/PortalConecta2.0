/**
 * Perfil de demonstração de PROFESSOR no Portal Conecta.
 *
 * POR QUE EXISTE: o Administrador Geral (ADMIN_EMAILS) sempre cai no painel
 * /admin — `src/lib/permissions.ts` nem deixa ele abrir /professor. Para
 * apresentar o portal mostrando o que um professor "normal" vê, é preciso uma
 * conta separada que:
 *
 *   1. seja de um e-mail @ifpr.edu.br que NÃO esteja em ADMIN_EMAILS (senão
 *      vira admin de novo);
 *   2. coordene ao menos um projeto — é a regra de `resolveUserRole`: dentro do
 *      domínio institucional, só é PROFESSOR quem coordena/vice-coordena (ou
 *      foi autorizado em) algum projeto;
 *   3. exista no Firebase, senão o formulário de e-mail/senha do painel não
 *      autentica (o usuário do banco sozinho não faz login).
 *
 * Usa `professor.teste@ifpr.edu.br`, que já existe no banco de produção e no
 * Firebase (provider "password").
 *
 * Os dois projetos criados aqui ficam em `review_status = RASCUNHO` de
 * propósito: eles aparecem no painel do professor, mas NÃO entram na listagem
 * pública `/projetos` (que exige PUBLICADO — ver `PROJETO_PUBLICO_WHERE`).
 * A página direta `/projetos/<slug>` abre, então dá para mostrar ao vivo.
 *
 * Comandos:
 *   npm run db:professor-demo            # cria/recria os dados de demonstração
 *   npm run db:professor-demo remover    # apaga projetos, vagas, inscrições e posts
 *   npm run db:professor-demo -- --dry-run  # valida tudo e reverte (não grava)
 *
 * ORDEM: este script apaga TODAS as inscrições dos projetos de demonstração
 * (inclusive as do aluno de teste). Se estiver usando os dois perfis, rode
 * `npm run db:aluno-demo` DEPOIS deste.
 *
 * A senha do Firebase NÃO é tratada aqui (o Admin SDK recusa alterar senha
 * quando roda com credenciais de servidor em alguns ambientes por política de
 * senha do projeto); ela é definida uma vez no console do Firebase, em
 * Authentication → Users → professor.teste@ifpr.edu.br.
 */
import './_env';
import { PrismaClient, type Prisma } from '@prisma/client';

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');
const REMOVER = process.argv.includes('remover');

const EMAIL_PROFESSOR = 'professor.teste@ifpr.edu.br';
const NOME_PROFESSOR = 'Professor Teste';
const ANO = new Date().getFullYear();

const HORTA = 'horta-pedagogica-e-compostagem-no-campus';
const ROBOTICA = 'programacao-e-robotica-para-iniciantes';
const SLUGS = [HORTA, ROBOTICA];

const dias = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

type Cliente = PrismaClient | Prisma.TransactionClient;

const PROJETOS = [
  {
    nome: 'Horta Pedagógica e Compostagem no Campus',
    slug: HORTA,
    area: 'Agroecologia e Sustentabilidade',
    corPrimaria: '#2E7D32',
    resumoCurto:
      'Horta educativa e composteira comunitária no campus, com oficinas abertas à comunidade escolar.',
    descricao:
      '<p>O projeto mantém uma horta pedagógica e uma composteira comunitária na área externa do campus, usadas como laboratório vivo para aulas de biologia, química e geografia. Estudantes participam do plantio, do manejo e da colheita, e a produção é destinada ao refeitório e a doações para famílias da região.</p><p>As oficinas abertas à comunidade acontecem uma vez por mês, aos sábados, e não exigem conhecimento prévio.</p>',
    objetivo:
      'Aproximar estudantes e comunidade das práticas de agricultura urbana, compostagem e educação ambiental, usando a horta como laboratório vivo.',
    metodologia:
      'Encontros semanais de 2h no contraturno: manejo dos canteiros, registro de crescimento das culturas, produção de composto e oficinas temáticas abertas ao público.',
    resultadoEsperado:
      'Horta produtiva com ao menos 12 espécies cultivadas, composteira operando durante todo o ano e 10 oficinas abertas realizadas.',
    publicoAlvo: 'Estudantes do ensino médio integrado e comunidade externa',
    cargaHorariaSemanal: 8,
    localRealizacao: 'IFPR Campus Ivaiporã — área externa do bloco C',
    vagasBolsista: 2,
    vagasVoluntario: 3,
    inscricoes_abertas: true,
    inscricao_inicio: dias(-12),
    inscricao_fim: dias(18),
    instagram: '@hortapedagogica.ifpr' as string | null,
  },
  {
    nome: 'Programação e Robótica para Iniciantes',
    slug: ROBOTICA,
    area: 'Tecnologia e Robótica',
    corPrimaria: '#1565C0',
    resumoCurto:
      'Introdução à lógica de programação e à robótica com Arduino para estudantes e comunidade, sem exigir experiência prévia.',
    descricao:
      '<p>Curso introdutório de lógica de programação com atividades práticas em Arduino. Os participantes montam circuitos simples, programam sensores e desenvolvem um protótipo final em equipe, apresentado na Mostra de Projetos do campus.</p>',
    objetivo:
      'Desenvolver pensamento computacional e autonomia técnica em estudantes iniciantes, com projetos práticos de automação de baixo custo.',
    metodologia:
      'Aulas expositivas curtas seguidas de prática em duplas nos laboratórios de informática e de eletrônica, com acompanhamento semanal.',
    resultadoEsperado:
      'Ao menos 20 participantes concluindo o curso e 5 protótipos apresentados na Mostra de Projetos.',
    publicoAlvo: 'Estudantes do campus e comunidade externa a partir de 14 anos',
    cargaHorariaSemanal: 6,
    localRealizacao: 'Laboratório de Informática 2 — IFPR Campus Ivaiporã',
    vagasBolsista: 1,
    vagasVoluntario: 2,
    inscricoes_abertas: false,
    instagram: null as string | null,
  },
];

const VAGAS = [
  {
    projetoSlug: HORTA,
    tipo: 'BOLSISTA' as const,
    titulo: 'Bolsista de apoio à horta pedagógica',
    descricao:
      'Apoio no manejo diário dos canteiros, no registro das atividades e no suporte às oficinas abertas à comunidade.',
    requisitos:
      'Estar matriculado no campus, disponibilidade de 8h semanais no contraturno e interesse por agroecologia.',
    quantidade: 2,
    valorBolsa: 400,
    cargaHorariaSemanal: 8,
    vigenciaMeses: 12,
    fontePagadora: 'PROEX / IFPR',
    status: 'ABERTA' as const,
  },
  {
    projetoSlug: HORTA,
    tipo: 'VOLUNTARIO' as const,
    titulo: 'Voluntário de compostagem e oficinas',
    descricao: 'Apoio na composteira comunitária e na organização das oficinas mensais abertas ao público.',
    requisitos: 'Interesse por educação ambiental; não é necessário conhecimento prévio.',
    quantidade: 3,
    cargaHorariaSemanal: 6,
    status: 'ABERTA' as const,
  },
  {
    projetoSlug: ROBOTICA,
    tipo: 'BOLSISTA' as const,
    titulo: 'Bolsista de robótica — Arduino',
    descricao:
      'Monitoria nas aulas práticas, manutenção dos kits de Arduino e apoio na orientação dos protótipos finais.',
    requisitos:
      'Ter concluído a edição anterior do curso ou demonstrar conhecimento equivalente em Arduino.',
    quantidade: 1,
    valorBolsa: 400,
    cargaHorariaSemanal: 6,
    vigenciaMeses: 12,
    fontePagadora: 'PROEX / IFPR',
    status: 'EM_SELECAO' as const,
  },
];

const INSCRICOES = [
  { aluno: 'aluno.teste@ifpr.edu.br', projeto: HORTA, vaga: 0, tipoInteresse: 'BOLSISTA' as const, status: 'recebida', curso: 'Técnico em Agropecuária', semestre: '2º', idade: 17, justificativa: 'Quero aprender compostagem para aplicar na horta da minha casa.' },
  { aluno: 'ana.souza@estudante.ifpr.edu.br', projeto: HORTA, vaga: 0, tipoInteresse: 'BOLSISTA' as const, status: 'em_analise', curso: 'Técnico em Agropecuária', semestre: '3º', idade: 17, justificativa: 'Tenho interesse em agricultura urbana e já participo do grupo de estudos do solo.' },
  { aluno: 'bruno.lima@estudante.ifpr.edu.br', projeto: HORTA, vaga: 1, tipoInteresse: 'VOLUNTARIO' as const, status: 'selecionado', curso: 'Técnico em Meio Ambiente', semestre: '4º', idade: 18, justificativa: 'Quero contribuir com as oficinas abertas à comunidade.' },
  { aluno: 'carla.oliveira@estudante.ifpr.edu.br', projeto: HORTA, vaga: 0, tipoInteresse: 'BOLSISTA' as const, status: 'selecionado', curso: 'Técnico em Agropecuária', semestre: '3º', idade: 17, justificativa: 'Já ajudo na horta comunitária do meu bairro.' },
  { aluno: 'diego.ferreira@estudante.ifpr.edu.br', projeto: HORTA, vaga: 1, tipoInteresse: 'VOLUNTARIO' as const, status: 'lista_espera', curso: 'Técnico em Agropecuária', semestre: '1º', idade: 16, justificativa: 'Sou calouro e queria começar a me envolver em projetos do campus.' },
  { aluno: 'eduarda.prado@estudante.ifpr.edu.br', projeto: HORTA, vaga: 0, tipoInteresse: 'BOLSISTA' as const, status: 'recebida', curso: 'Técnico em Alimentos', semestre: '2º', idade: 16, justificativa: 'Interesse em produção de alimentos e aproveitamento integral.' },
  { aluno: 'felipe.rocha@estudante.ifpr.edu.br', projeto: HORTA, vaga: 1, tipoInteresse: 'VOLUNTARIO' as const, status: 'nao_selecionado', curso: 'Técnico em Informática', semestre: '4º', idade: 18, justificativa: 'Queria fazer as oficinas de compostagem no contraturno.' },
  { aluno: 'gabriela.alves@estudante.ifpr.edu.br', projeto: HORTA, vaga: 0, tipoInteresse: 'BOLSISTA' as const, status: 'recebida', curso: 'Técnico em Agropecuária', semestre: '2º', idade: 17, justificativa: 'Tenho experiência com cultivo de hortaliças em casa.' },
  { aluno: 'henrique.moraes@estudante.ifpr.edu.br', projeto: ROBOTICA, vaga: 2, tipoInteresse: 'BOLSISTA' as const, status: 'selecionado', curso: 'Técnico em Informática', semestre: '3º', idade: 17, justificativa: 'Já mexi com Arduino em projetos pessoais.' },
  { aluno: 'ana.souza@estudante.ifpr.edu.br', projeto: ROBOTICA, vaga: 2, tipoInteresse: 'BOLSISTA' as const, status: 'em_analise', curso: 'Técnico em Agropecuária', semestre: '3º', idade: 17, justificativa: 'Quero aprender automação para aplicar na agricultura.' },
  { aluno: 'lucas.martins@estudante.ifpr.edu.br', projeto: ROBOTICA, vaga: null, tipoInteresse: 'VOLUNTARIO' as const, status: 'recebida', curso: 'Técnico em Informática', semestre: '2º', idade: 16, justificativa: 'Tenho interesse em robótica e programação.' },
  { aluno: 'diego.ferreira@estudante.ifpr.edu.br', projeto: ROBOTICA, vaga: null, tipoInteresse: 'VOLUNTARIO' as const, status: 'recebida', curso: 'Técnico em Agropecuária', semestre: '1º', idade: 16, justificativa: 'Quero aprender a programar do zero.' },
  { aluno: 'felipe.rocha@estudante.ifpr.edu.br', projeto: ROBOTICA, vaga: 2, tipoInteresse: 'BOLSISTA' as const, status: 'lista_espera', curso: 'Técnico em Informática', semestre: '4º', idade: 18, justificativa: 'Já programo em Python e queria aprender a parte de hardware.' },
];

const POSTS = [
  {
    projetoSlug: HORTA,
    titulo: 'Inscrições abertas para a Horta Pedagógica',
    slug: 'inscricoes-abertas-para-a-horta-pedagogica-demo',
    resumo:
      'Estão abertas as inscrições para bolsistas e voluntários da horta pedagógica e da composteira comunitária.',
    conteudo:
      '<p>Estão abertas as inscrições para o projeto <strong>Horta Pedagógica e Compostagem no Campus</strong>.</p><p>São 2 vagas de bolsista (R$ 400/mês, 8h semanais) e 3 vagas de voluntário (6h semanais). As atividades acontecem no contraturno, na área externa do bloco C.</p><p>Confira os requisitos na página do projeto e inscreva-se pelo formulário.</p>',
  },
  {
    projetoSlug: HORTA,
    titulo: 'Primeira colheita do ano na horta',
    slug: 'primeira-colheita-do-ano-na-horta-demo',
    resumo: 'A primeira colheita do ano rendeu 18 kg de hortaliças para o refeitório e para doações.',
    conteudo:
      '<p>A primeira colheita do ano rendeu <strong>18 kg de hortaliças</strong>, destinados ao refeitório do campus e a doações para três famílias da região.</p><p>Obrigado a todos os estudantes que participaram do manejo dos canteiros!</p>',
  },
  {
    projetoSlug: ROBOTICA,
    titulo: 'Protótipos da turma de robótica são apresentados na Mostra',
    slug: 'prototipos-da-turma-de-robotica-apresentados-na-mostra-demo',
    resumo:
      'Cinco protótipos construídos pelos participantes do curso foram apresentados na Mostra de Projetos.',
    conteudo:
      '<p>Cinco protótipos construídos pelos participantes do curso foram apresentados na Mostra de Projetos do campus, entre eles um sistema de irrigação automática e um sensor de umidade para a horta pedagógica.</p>',
  },
];

/** Apaga projetos de demonstração (e tudo que pende deles) + o usuário, se sobrar órfão. */
async function remover(db: Cliente) {
  const projetos = await db.projeto.findMany({ where: { slug: { in: SLUGS } }, select: { id: true, nome: true } });
  if (projetos.length === 0) {
    console.log('Nenhum projeto de demonstração encontrado.');
  }
  const ids = projetos.map((p) => p.id);

  if (ids.length > 0) {
    // Post é a única relação sem cascade — precisa sair antes do projeto.
    const posts = await db.post.deleteMany({ where: { projetoId: { in: ids } } });
    const vagas = await db.vaga.deleteMany({ where: { projetoId: { in: ids } } });
    const inscricoes = await db.inscricao.deleteMany({ where: { projeto_id: { in: ids } } });
    const removidos = await db.projeto.deleteMany({ where: { id: { in: ids } } });
    console.log(
      `Projetos removidos: ${removidos.count} | posts: ${posts.count} | vagas: ${vagas.count} | inscrições: ${inscricoes.count}`,
    );
    for (const p of projetos) console.log(`  - ${p.nome}`);
  }

  const usuario = await db.user.findUnique({
    where: { email: EMAIL_PROFESSOR },
    select: { id: true, _count: { select: { posts: true, editais: true, inscricoes: true } } },
  });
  if (usuario && usuario._count.posts === 0 && usuario._count.editais === 0) {
    await db.user.delete({ where: { id: usuario.id } });
    console.log(`Usuário removido do banco: ${EMAIL_PROFESSOR} (a conta do Firebase continua existindo).`);
  } else if (usuario) {
    console.log(`Usuário ${EMAIL_PROFESSOR} mantido (ainda tem ${usuario._count.posts} post(s) / ${usuario._count.editais} edital(is)).`);
  }
}

async function criar(db: Cliente) {
  // ── 1. Usuário ───────────────────────────────────────────────────────────
  const professor = await db.user.upsert({
    where: { email: EMAIL_PROFESSOR },
    update: { name: NOME_PROFESSOR, role: 'PROFESSOR' },
    create: { email: EMAIL_PROFESSOR, name: NOME_PROFESSOR, role: 'PROFESSOR' },
    select: { id: true, email: true, role: true },
  });
  console.log(`Usuário: ${professor.email} | ${professor.role}`);

  // ── 2. Projetos (RASCUNHO = fora da listagem pública) ────────────────────
  const projetos: Record<string, { id: string; nome: string; slug: string }> = {};
  for (const dados of PROJETOS) {
    const comum = {
      nome: dados.nome,
      area: dados.area,
      tipo: 'extensao',
      categoria: 'Extensão',
      resumoCurto: dados.resumoCurto,
      descricao: dados.descricao,
      objetivo: dados.objetivo,
      metodologia: dados.metodologia,
      resultadoEsperado: dados.resultadoEsperado,
      publicoAlvo: dados.publicoAlvo,
      coordenador: NOME_PROFESSOR,
      coordenadorEmail: EMAIL_PROFESSOR,
      cargaHorariaSemanal: dados.cargaHorariaSemanal,
      localRealizacao: dados.localRealizacao,
      vagasBolsista: dados.vagasBolsista,
      vagasVoluntario: dados.vagasVoluntario,
      inscricoes_abertas: dados.inscricoes_abertas,
      inscricao_inicio: dados.inscricao_inicio ?? null,
      inscricao_fim: dados.inscricao_fim ?? null,
      status: 'EM_EXECUCAO' as const,
      corPrimaria: dados.corPrimaria,
      email: EMAIL_PROFESSOR,
      instagram: dados.instagram,
      source: 'MANUAL' as const,
      review_status: 'RASCUNHO' as const,
      dataInicio: dias(-30),
    };
    const projeto = await db.projeto.upsert({
      where: { slug: dados.slug },
      update: comum,
      create: { ...comum, slug: dados.slug },
      select: { id: true, nome: true, slug: true },
    });
    projetos[dados.slug] = projeto;
    console.log(`Projeto: ${projeto.nome} (/${projeto.slug}) — RASCUNHO, fora da listagem pública`);
  }

  const idsProjetos = Object.values(projetos).map((p) => p.id);

  // ── 3. Limpa e recria o miolo (idempotente) ──────────────────────────────
  await db.inscricao.deleteMany({ where: { projeto_id: { in: idsProjetos } } });
  await db.vaga.deleteMany({ where: { projetoId: { in: idsProjetos } } });
  await db.post.deleteMany({ where: { projetoId: { in: idsProjetos } } });

  const vagasCriadas: { id: string }[] = [];
  for (const v of VAGAS) {
    const vaga = await db.vaga.create({
      data: {
        projetoId: projetos[v.projetoSlug].id,
        tipo: v.tipo,
        titulo: v.titulo,
        descricao: v.descricao ?? null,
        requisitos: v.requisitos ?? null,
        quantidade: v.quantidade,
        valorBolsa: v.valorBolsa ?? null,
        cargaHorariaSemanal: v.cargaHorariaSemanal ?? null,
        vigenciaMeses: v.vigenciaMeses ?? null,
        fontePagadora: v.fontePagadora ?? null,
        status: v.status,
        dataAbertura: dias(-12),
        dataEncerramento: dias(18),
      },
      select: { id: true },
    });
    vagasCriadas.push(vaga);
  }
  console.log(`Vagas: ${vagasCriadas.length}`);

  const alunos = await db.user.findMany({
    where: { email: { in: [...new Set(INSCRICOES.map((i) => i.aluno))] } },
    select: { id: true, email: true, name: true },
  });
  const alunoPorEmail = new Map(alunos.map((a) => [a.email, a]));

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
  for (const item of INSCRICOES) {
    const aluno = alunoPorEmail.get(item.aluno);
    const vaga = item.vaga === null ? null : vagasCriadas[item.vaga];
    seq += 1;
    await db.inscricao.create({
      data: {
        protocolo: `PRJ-${ANO}-${String(seq).padStart(6, '0')}`,
        projeto_id: projetos[item.projeto].id,
        vaga_id: vaga ? vaga.id : null,
        user_id: aluno ? aluno.id : null,
        nome_completo: aluno?.name ?? item.aluno,
        email: item.aluno,
        telefone: '(43) 99999-0000',
        curso: item.curso,
        semestre: item.semestre,
        idade: item.idade,
        tipo_interesse: item.tipoInteresse,
        disponibilidade: 'Tarde (contraturno)',
        experiencia_previa: 'Participação em atividades escolares e projetos de extensão.',
        justificativa: item.justificativa,
        ciencia_regras: true,
        consentimento_lgpd: true,
        campos_extra: {},
        status: item.status,
        created_at: dias(-(1 + (criadas % 9))),
      },
    });
    criadas += 1;
  }
  console.log(`Inscrições: ${criadas}`);

  for (const p of POSTS) {
    await db.post.create({
      data: {
        projetoId: projetos[p.projetoSlug].id,
        authorId: professor.id,
        titulo: p.titulo,
        slug: p.slug,
        resumo: p.resumo,
        conteudo: p.conteudo,
        status: 'PUBLICADO',
      },
    });
  }
  console.log(`Posts: ${POSTS.length}`);

  const resumo = await db.projeto.findMany({
    where: { id: { in: idsProjetos } },
    select: { nome: true, slug: true, _count: { select: { inscricoes: true, vagas: true, posts: true } } },
  });
  console.log('\n== RESUMO ==');
  for (const r of resumo) {
    console.log(
      `  ${r.nome}: ${r._count.inscricoes} inscrições, ${r._count.vagas} vagas, ${r._count.posts} posts (/projetos/${r.slug})`,
    );
  }
  console.log(`\nLogin: ${EMAIL_PROFESSOR} (senha no Firebase → Authentication → Users)`);
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
