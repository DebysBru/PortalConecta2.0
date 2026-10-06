/**
 * Extrai os editais do Campus Ivaiporã publicados no site do IFPR.
 *
 * Por que não vem do SUAP: a API do SUAP não tem endpoint de edital (ver
 * DOCUMENTACAO/SUAP_IMPORTACAO.md §2). Os editais do campus estão no site
 * institucional, em páginas que listam os PDFs.
 *
 * Uso (na raiz do projeto):
 *
 *     npm run editais:ifpr -- editais-ivaipora
 *     npm run editais:ifpr -- editais-2026 --ano=2026 --tipos=EDITAL,RETIFICACAO,RESULTADO
 *     npm run editais:ifpr -- tudo --incluir-portarias
 *
 * Opções:
 *   --ano=2026            só um ano (pode repetir: --ano=2026 --ano=2025)
 *   --tipos=EDITAL,...    filtra por tipo (padrão: todos menos PORTARIA)
 *   --areas=BOLSAS,...    filtra por área
 *   --incluir-portarias   mantém portarias/resoluções na saída
 *
 * Gera três arquivos: .json (para importar/processar), .csv (Excel) e .md (leitura).
 *
 * Observação sobre rede: o site do IFPR está atrás do WAF da AWS e desafia IPs de
 * datacenter — se rodar numa VPS, a varredura avisa que precisa de verificação. De
 * uma rede normal (ou pelo navegador do admin, que passa pelo desafio) funciona.
 */

import { writeFileSync } from 'node:fs';
import {
  extrairEditaisIfprIvaipora, resumirEditais, editaisParaCsv, editaisParaMarkdown,
  type TipoDocumento, type AreaEdital,
} from '../src/lib/ifpr-editais';

const TIPOS: TipoDocumento[] = ['EDITAL', 'RESULTADO', 'RETIFICACAO', 'PRORROGACAO', 'PORTARIA', 'OUTRO'];

function argumentos() {
  const argv = process.argv.slice(2);
  const valor = (nome: string) => argv.filter((a) => a.startsWith(`--${nome}=`)).map((a) => a.split('=')[1]);
  return {
    saida: argv.find((a) => !a.startsWith('--')) ?? 'editais-ivaipora',
    anos: valor('ano').map(Number).filter((n) => Number.isFinite(n)),
    tipos: valor('tipos').flatMap((v) => v.split(',')).map((t) => t.trim().toUpperCase()) as TipoDocumento[],
    areas: valor('areas').flatMap((v) => v.split(',')).map((a) => a.trim().toUpperCase()) as AreaEdital[],
    incluirPortarias: argv.includes('--incluir-portarias'),
  };
}

async function main() {
  const opcoes = argumentos();

  console.log('Lendo o site do IFPR (Campus Ivaiporã) pela API REST...');
  const resultado = await extrairEditaisIfprIvaipora({ fetchImpl: fetch as never });

  console.log(`páginas varridas: ${resultado.paginasVarridas} | com documentos: ${resultado.paginasComItens}`);
  for (const aviso of resultado.avisos) console.log(`⚠️  ${aviso}`);

  if (resultado.itens.length === 0) {
    console.log('\nNada encontrado.');
    if (!resultado.avisos.length) console.log('(sem avisos: o site respondeu, mas nenhuma página listou documentos)');
    process.exit(resultado.avisos.length ? 1 : 0);
  }

  let itens = resultado.itens;
  const total = itens.length;

  if (opcoes.tipos.length) itens = itens.filter((i) => opcoes.tipos.includes(i.tipo));
  else if (!opcoes.incluirPortarias) itens = itens.filter((i) => i.tipo !== 'PORTARIA' && i.tipo !== 'OUTRO');
  if (opcoes.anos.length) itens = itens.filter((i) => i.ano !== null && opcoes.anos.includes(i.ano));
  if (opcoes.areas.length) itens = itens.filter((i) => opcoes.areas.includes(i.area));

  const resumo = resumirEditais(itens);
  console.log(`\ndocumentos encontrados: ${total} | depois dos filtros: ${itens.length}`);
  console.log('por tipo:', resumo.porTipo);
  console.log('por ano:', Object.entries(resumo.porAno).sort((a, b) => b[0].localeCompare(a[0])).map(([k, v]) => `${k}=${v}`).join(' '));
  console.log('por área:', resumo.porArea);

  writeFileSync(`${opcoes.saida}.json`, JSON.stringify({ geradoEm: new Date().toISOString(), resumo, itens }, null, 2));
  writeFileSync(`${opcoes.saida}.csv`, editaisParaCsv(itens));
  writeFileSync(`${opcoes.saida}.md`, editaisParaMarkdown(itens, resumo));
  console.log(`\ngravado: ${opcoes.saida}.json | ${opcoes.saida}.csv | ${opcoes.saida}.md`);

  console.log('\n--- amostra (5 mais recentes) ---');
  for (const item of itens.slice(0, 5)) {
    console.log(`  ${item.ano ?? '—'} | ${item.tipo.padEnd(11)} | ${item.area.padEnd(22)} | ${item.titulo.slice(0, 58)}`);
  }
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
