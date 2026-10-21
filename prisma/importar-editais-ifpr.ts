/**
 * Importa para o portal os editais extraídos do site do IFPR.
 *
 * Fluxo completo:
 *   1. `npm run editais:ifpr -- editais-ivaipora`  → extrai do site (JSON/CSV/MD);
 *   2. `npm run editais:portal -- editais-ivaipora.json` → grava no portal.
 *
 * Idempotência: a chave é `Edital.origemRef` (a URL do documento original). Rodar
 * de novo **atualiza** os mesmos editais em vez de duplicar — o texto da IFizinha e
 * o link sempre ficam iguais ao último documento publicado pelo IFPR.
 *
 * Uso:
 *     npm run editais:portal -- editais-ivaipora.json
 *     npm run editais:portal -- editais-ivaipora.json --seco
 *     npm run editais:portal -- editais-ivaipora.json --ano-desde=2024 --sem-servidores
 *
 * Opções:
 *   --seco               mostra o que faria, sem gravar
 *   --ano-desde=AAAA     ignora documentos anteriores (padrão: 2024)
 *   --areas=A,B          só estas áreas (padrão: todas menos SERVIDORES e OUTRO)
 *   --tipos=EDITAL,...   só estes tipos (padrão: todos menos PORTARIA e OUTRO)
 *   --incluir-servidores mantém os processos seletivos de servidores (PSS)
 *   --destaque           marca os do ano corrente como destaque na home
 */

import { readFileSync } from 'node:fs';
import { PrismaClient, type CategoriaEdital, type StatusEdital } from '@prisma/client';
import type { AreaEdital, EditalExtraido, TipoDocumento } from '../src/lib/ifpr-editais';
import { mapearEditalParaPortal, type EditalDoPortal } from '../src/lib/editais-ifpr';

const prisma = new PrismaClient();

interface Opcoes {
  arquivo: string;
  seco: boolean;
  anoDesde: number;
  areas: AreaEdital[] | null;
  tipos: TipoDocumento[] | null;
  incluirServidores: boolean;
  destaque: boolean;
}

function lerArgumentos(): Opcoes {
  const argv = process.argv.slice(2);
  const valor = (nome: string) => argv.find((a) => a.startsWith(`--${nome}=`))?.split('=')[1];
  return {
    arquivo: argv.find((a) => !a.startsWith('--')) ?? 'editais-ivaipora.json',
    seco: argv.includes('--seco'),
    anoDesde: Number(valor('ano-desde') ?? 2024),
    areas: valor('areas') ? (valor('areas')!.split(',').map((a) => a.trim().toUpperCase()) as AreaEdital[]) : null,
    tipos: valor('tipos') ? (valor('tipos')!.split(',').map((t) => t.trim().toUpperCase()) as TipoDocumento[]) : null,
    incluirServidores: argv.includes('--incluir-servidores'),
    destaque: argv.includes('--destaque'),
  };
}

function selecionar(itens: EditalExtraido[], opcoes: Opcoes) {
  const tiposPadrao: TipoDocumento[] = ['EDITAL', 'RESULTADO', 'RETIFICACAO', 'PRORROGACAO'];
  const tipos = opcoes.tipos ?? tiposPadrao;

  return itens.filter((item) => {
    if (!tipos.includes(item.tipo)) return false;
    if (opcoes.areas) {
      if (!opcoes.areas.includes(item.area)) return false;
    } else {
      if (item.area === 'OUTRO') return false;
      if (item.area === 'SERVIDORES' && !opcoes.incluirServidores) return false;
    }
    if (item.ano !== null && item.ano < opcoes.anoDesde) return false;
    return true;
  });
}

async function main() {
  const opcoes = lerArgumentos();
  const bruto = JSON.parse(readFileSync(opcoes.arquivo, 'utf8')) as { itens?: EditalExtraido[] } | EditalExtraido[];
  const todos = Array.isArray(bruto) ? bruto : (bruto.itens ?? []);

  if (!todos.length) {
    console.error(`Nenhum item em ${opcoes.arquivo}. Rode antes: npm run editais:ifpr`);
    process.exit(1);
  }

  const selecionados = selecionar(todos, opcoes);
  const anoAtual = new Date().getFullYear();

  console.log(`arquivo: ${opcoes.arquivo}`);
  console.log(`documentos no arquivo: ${todos.length} | selecionados: ${selecionados.length}`);
  console.log(`critérios: ano >= ${opcoes.anoDesde}, tipos ${(opcoes.tipos ?? ['EDITAL', 'RESULTADO', 'RETIFICACAO', 'PRORROGACAO']).join('/')}` +
    `${opcoes.incluirServidores ? ', incluindo servidores' : ', sem servidores'}`);

  const porAno: Record<string, number> = {};
  const porCategoria: Record<string, number> = {};
  const mapeados: EditalDoPortal[] = [];

  for (const item of selecionados) {
    const edital = mapearEditalParaPortal(item, { anoAtual });
    mapeados.push(edital);
    porAno[edital.ano ?? '(sem ano)'] = (porAno[edital.ano ?? '(sem ano)'] ?? 0) + 1;
    porCategoria[edital.categoria] = (porCategoria[edital.categoria] ?? 0) + 1;
  }
  console.log('por ano:', porAno);
  console.log('por categoria:', porCategoria);

  if (opcoes.seco) {
    console.log('\n--seco: nada foi gravado. Amostra:');
    for (const edital of mapeados.slice(0, 3)) {
      console.log(`\n  ${edital.titulo}`);
      console.log(`  slug: ${edital.slug} | ${edital.categoria}/${edital.status} | área ${edital.areaEdital} | ano ${edital.ano}`);
      console.log(`  link: ${edital.linkOficial}`);
      console.log(`  IFizinha: ${edital.resumoSimples}`);
    }
    await prisma.$disconnect();
    return;
  }

  // Autor dos editais: mesmo critério do sync do SUAP — o admin mais antigo.
  const autor = await prisma.user.findFirst({ where: { role: 'ADMIN' }, orderBy: { createdAt: 'asc' }, select: { id: true, email: true } });
  if (!autor) {
    console.error('Nenhum usuário ADMIN encontrado para ser o autor dos editais.');
    process.exit(1);
  }
  console.log(`autor: ${autor.email}`);

  let criados = 0;
  let atualizados = 0;
  let erros = 0;
  const slugsUsados = new Set(
    (await prisma.edital.findMany({ select: { slug: true } })).map((e) => e.slug),
  );

  for (const edital of mapeados) {
    try {
      const existente = await prisma.edital.findUnique({ where: { origemRef: edital.origemRef }, select: { id: true, slug: true } });

      // Slug único: o do documento, ou com sufixo numérico se já estiver em uso
      // por outro edital (títulos repetidos entre anos/áreas são comuns).
      let slug = existente?.slug ?? edital.slug;
      if (!existente) {
        let contador = 1;
        while (slugsUsados.has(slug)) {
          contador += 1;
          slug = `${edital.slug}-${contador}`;
        }
        slugsUsados.add(slug);
      }

      const dados = {
        titulo: edital.titulo,
        numero: edital.numero,
        ano: edital.ano,
        categoria: edital.categoria as CategoriaEdital,
        status: edital.status as StatusEdital,
        areaEdital: edital.areaEdital,
        setorResponsavel: edital.setorResponsavel,
        publicoAlvo: edital.publicoAlvo,
        resumo: edital.resumo,
        resumoSimples: edital.resumoSimples,
        linkOficial: edital.linkOficial,
        arquivoPdfUrl: edital.arquivoPdfUrl,
        fonteOficial: edital.fonteOficial,
        source: edital.source,
        traducaoIFizinha: edital.traducaoIFizinha,
        review_status: 'PUBLICADO' as const,
        ...(opcoes.destaque && edital.ano === anoAtual ? { destaque: true } : {}),
      };

      if (existente) {
        await prisma.edital.update({ where: { origemRef: edital.origemRef }, data: dados });
        atualizados++;
      } else {
        await prisma.edital.create({
          data: { ...dados, slug, origemRef: edital.origemRef, authorId: autor.id },
        });
        criados++;
      }
    } catch (erro) {
      erros++;
      console.error(`  falhou: ${edital.titulo.slice(0, 60)} — ${(erro as Error).message.slice(0, 120)}`);
    }
  }

  console.log(`\ncriados: ${criados} | atualizados: ${atualizados} | erros: ${erros}`);
  console.log(`editais no portal agora: ${await prisma.edital.count()}`);
  await prisma.$disconnect();
}

main().catch(async (erro) => {
  console.error(erro);
  await prisma.$disconnect();
  process.exit(1);
});
