/**
 * Importa projetos do SUAP a partir de uma captura feita no navegador (CLI).
 *
 * O caminho normal é o painel (Painel → SUAP → "Importar do SUAP"), que mostra a
 * prévia e usa as mesmas funções. Este script serve para operação: subir o arquivo
 * direto na VPS, sem abrir navegador, e para conferir o resultado num terminal.
 *
 * Uso (na raiz do projeto):
 *
 *     npm run db:suap -- caminho/projetos-suap-2026-10-06.json
 *
 * Opções:
 *   --seco                só analisa e mostra o resumo (não grava nada)
 *   --forcar              sobrescreve também os projetos editados à mão no portal
 *   --campus=SIGLA        sigla do campus (padrão: SUAP_CAMPUS_SIGLA do .env)
 *
 * Contexto: a sincronização automática não passa pelo SUAP porque o WAF deles
 * desafia o IP do servidor (ver DOCUMENTACAO/SUAP_IMPORTACAO.md). A captura é
 * feita no navegador logado (`public/modelos/capturar-suap-semanal.js`).
 */

import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { analisarCapturaSuap } from '../src/lib/suap-import';
import { normalizaSiglaSuap } from '../src/lib/suap-api';
import { aplicarProjetosDoSuap } from '../src/lib/suap-sync';

const prisma = new PrismaClient();

async function main() {
  const argumentos = process.argv.slice(2);
  const caminho = argumentos.find((a) => !a.startsWith('--'));
  const seco = argumentos.includes('--seco');
  const forcar = argumentos.includes('--forcar');
  const sigla = argumentos.find((a) => a.startsWith('--campus='))?.split('=')[1]
    ?? process.env.SUAP_CAMPUS_SIGLA
    ?? 'IVAIPODG';

  if (!caminho) {
    console.error('Informe o arquivo da captura: npm run db:suap -- caminho/projetos.json');
    process.exit(1);
  }

  const conteudo = readFileSync(caminho, 'utf8');
  const analise = analisarCapturaSuap(conteudo, sigla);

  console.log(`arquivo: ${caminho}`);
  console.log(`itens lidos: ${analise.total} | válidos: ${analise.projetos.length} | com problema: ${analise.erros.length}`);
  console.log('por fonte:', analise.resumo.porFonte);
  console.log('por situação:', analise.resumo.porSituacao);
  console.log('por campus:', analise.resumo.porCampus);
  console.log(`do campus ${analise.resumo.siglaAlvo}: ${analise.resumo.noCampusAlvo}`);
  if (analise.avisos.length) console.log('avisos:', analise.avisos.join(' | '));
  if (analise.erros.length) {
    console.log('erros:');
    for (const erro of analise.erros.slice(0, 15)) console.log(`  item ${erro.indice}: ${erro.motivo}`);
  }

  const alvo = normalizaSiglaSuap(sigla);
  const doCampus = analise.projetos.filter((p) => normalizaSiglaSuap(p.campus_sigla) === alvo);

  if (doCampus.length === 0) {
    console.log(`\nnada a gravar: nenhum projeto do campus ${alvo}`);
    await prisma.$disconnect();
    return;
  }
  if (doCampus.length < analise.projetos.length) {
    console.log(`\n(${analise.projetos.length - doCampus.length} projeto(s) de outros campi serão ignorados)`);
  }
  if (seco) {
    console.log(`\n--seco: ${doCampus.length} projeto(s) seriam gravados. Nada foi alterado.`);
    await prisma.$disconnect();
    return;
  }

  const resultado = await aplicarProjetosDoSuap(doCampus, { forcar, origem: 'captura do navegador (CLI)' });
  console.log(`\nrecebidos: ${resultado.total} | criados: ${resultado.criados} | atualizados: ${resultado.atualizados} | preservados: ${resultado.preservados} | erros: ${resultado.erros}`);
  for (const linha of resultado.detalhes.slice(0, 20)) console.log(`  ${linha}`);
  if (resultado.detalhes.length > 20) console.log(`  ... e mais ${resultado.detalhes.length - 20} linha(s)`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
