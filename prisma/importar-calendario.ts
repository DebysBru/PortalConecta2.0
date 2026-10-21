/**
 * Importação do calendário acadêmico pela linha de comando.
 *
 * O caminho normal é o painel (Agenda → Importar calendário), que mostra a prévia
 * e usa `src/actions/agenda-import.ts`. Este script existe para o caso de
 * operação: subir o calendário inteiro de uma vez, na VPS, sem depender de abrir
 * o navegador — e serve de conferência do mesmo parser.
 *
 * Uso (na raiz do projeto):
 *
 *     npx ts-node --compiler-options '{"module":"CommonJS"}' \
 *       prisma/importar-calendario.ts public/modelos/calendario-ifpr-ivaipora-2026.csv
 *
 * Opções:
 *   --email=alguem@ifpr.edu.br  quem fica como autor dos eventos (padrão: primeiro ADMIN)
 *   --seco                      só analisa e mostra o resumo, não grava
 *   --nao-atualizar             não mexe nos eventos que já existem (mesma `ref`)
 */

import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { analisarArquivo } from '../src/lib/agenda-import';

const prisma = new PrismaClient();

async function main() {
  const argumentos = process.argv.slice(2);
  const caminho = argumentos.find((a) => !a.startsWith('--'));
  const email = argumentos.find((a) => a.startsWith('--email='))?.split('=')[1];
  const seco = argumentos.includes('--seco');
  const atualizar = !argumentos.includes('--nao-atualizar');

  if (!caminho) {
    console.error('Informe o arquivo: prisma/importar-calendario.ts <arquivo.csv|json>');
    process.exit(1);
  }

  const conteudo = readFileSync(caminho, 'utf8');
  const analise = analisarArquivo(conteudo);

  console.log(`arquivo: ${caminho}`);
  console.log(`formato: ${analise.formato}${analise.separador ? ` (separador "${analise.separador}")` : ''}`);
  console.log(`linhas: ${analise.totalLinhas} | válidas: ${analise.linhas.length} | com problema: ${analise.erros.length}`);
  if (analise.resumo.primeiraData) {
    console.log(`período: ${analise.resumo.primeiraData} a ${analise.resumo.ultimaData}`);
  }
  console.log('por categoria:');
  for (const [categoria, total] of Object.entries(analise.resumo.porCategoria).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(total).padStart(3)}  ${categoria}`);
  }
  if (analise.avisos.length) {
    console.log('avisos:', analise.avisos.join(' | '));
  }
  if (analise.erros.length) {
    console.log('erros:');
    for (const erro of analise.erros.slice(0, 20)) console.log(`  linha ${erro.linha}: ${erro.motivo}`);
  }

  if (seco || analise.linhas.length === 0) {
    console.log(seco ? '\n(--seco: nada foi gravado)' : '\nnada a gravar');
    await prisma.$disconnect();
    return;
  }

  const autor = email
    ? await prisma.user.findUnique({ where: { email }, select: { id: true, email: true } })
    : await prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true, email: true } });

  if (!autor) {
    console.error('\nnenhum usuário ADMIN encontrado — passe --email=alguem@ifpr.edu.br');
    process.exit(1);
  }
  console.log(`\nautor dos eventos: ${autor.email}`);

  const lote = caminho.split(/[\\/]/).pop() ?? 'importacao';
  const existentes = await prisma.evento.findMany({
    where: { origemRef: { in: analise.linhas.map((l) => l.ref) } },
    select: { origemRef: true },
  });
  const refsExistentes = new Set(existentes.map((e) => e.origemRef));

  let criados = 0;
  let atualizados = 0;
  let inalterados = 0;
  let falhas = 0;

  for (const linha of analise.linhas) {
    const dados = {
      titulo: linha.titulo,
      descricao: linha.descricao,
      data: linha.data,
      dataFim: linha.dataFim,
      tipo: linha.tipo,
      local: linha.local,
      categoria: linha.categoria,
      subcategoria: linha.subcategoria,
      publicoAlvo: linha.publicoAlvo,
      nivel: linha.nivel,
      natureza: linha.natureza,
      interessaAlunos: linha.interessaAlunos,
      interessaProfessores: linha.interessaProfessores,
      importLote: lote,
      importadoEm: new Date(),
    };

    try {
      if (refsExistentes.has(linha.ref)) {
        if (!atualizar) {
          inalterados++;
          continue;
        }
        await prisma.evento.update({ where: { origemRef: linha.ref }, data: dados });
        atualizados++;
      } else {
        await prisma.evento.create({ data: { ...dados, origemRef: linha.ref, authorId: autor.id } });
        criados++;
      }
    } catch (e) {
      falhas++;
      console.error(`  falhou ${linha.ref}: ${(e as Error).message}`);
    }
  }

  console.log(`\ncriados: ${criados} | atualizados: ${atualizados} | sem alteração: ${inalterados} | falhas: ${falhas}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
