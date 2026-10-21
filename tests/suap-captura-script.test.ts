import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guardas do script de captura do SUAP.
 *
 * O script roda no navegador de quem está logado no SUAP, então ele precisa ser
 * previsível e **não pode enviar dado para lugar nenhum** — é isso que a tela do
 * painel promete a quem cola o código. Estes testes travam essas promessas e o
 * filtro de campus (pedido explícito: "quero pegar só os projetos de IVAIPODG").
 *
 * A lógica de verdade (paginação, filtro adaptativo e formato do pacote) foi
 * exercitada num navegador real com a API simulada — ver o histórico do PR; aqui
 * ficam as invariantes que não podem regredir sozinhas.
 */
const SCRIPT = readFileSync(
  join(process.cwd(), 'public', 'modelos', 'capturar-projetos-suap.js'),
  'utf8',
);

describe('script de captura do SUAP', () => {
  it('tem IVAIPODG como campus padrão e aceita trocar sem editar o arquivo', () => {
    expect(SCRIPT).toContain("window.__portalConectaCampus || 'IVAIPODG'");
  });

  it('filtra pelo campus (comparando sem caixa e sem acento)', () => {
    expect(SCRIPT).toContain('campus_sigla');
    expect(SCRIPT).toMatch(/normalize\('NFD'\)/);
    expect(SCRIPT).toMatch(/=== alvo/);
  });

  it('testa o filtro no servidor e cai para o filtro local quando a API ignora', () => {
    // o `campus_sigla` vai como parâmetro na consulta...
    expect(SCRIPT).toContain("parametros.set('campus_sigla', CAMPUS_SIGLA)");
    // ...e há o caminho de reserva percorrendo as páginas
    expect(SCRIPT).toContain('usaFiltroServidor');
    expect(SCRIPT).toMatch(/não filtra por campus/);
  });

  it('avisa quais siglas existem quando não acha o campus (em vez de arquivo vazio)', () => {
    expect(SCRIPT).toContain('siglasVistas');
    expect(SCRIPT).toMatch(/Nenhum projeto do campus/);
  });

  it('só lê o SUAP: nenhum envio para outro endereço', () => {
    // todas as URLs do script são do próprio SUAP
    const urls = SCRIPT.match(/https?:\/\/[^'"`\s)]+/g) ?? [];
    const externas = urls.filter((u) => !u.includes('suap.ifpr.edu.br'));
    expect(externas).toEqual([]);

    // e não existe POST/PUT/DELETE nem envio de corpo
    expect(SCRIPT).not.toMatch(/method:\s*['"`](POST|PUT|PATCH|DELETE)/i);
    expect(SCRIPT).not.toMatch(/\bbody:/);
    // as chamadas são GET (implícito) com a sessão do SUAP
    expect(SCRIPT).toContain("credentials: 'same-origin'");
  });

  it('reconhece o CAPTCHA do WAF e explica em vez de dar erro genérico', () => {
    expect(SCRIPT).toMatch(/Human Verification\|awsWaf\|captcha/);
  });

  it('devolve o pacote no formato que o painel importa', () => {
    expect(SCRIPT).toContain("origem: 'captura-suap-navegador'");
    expect(SCRIPT).toMatch(/extensao: resultado\.extensao/);
    expect(SCRIPT).toMatch(/pesquisa: resultado\.pesquisa/);
  });
});
