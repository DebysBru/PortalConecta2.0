import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { chaveEdital } from '@/lib/suap-editais';
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
  join(process.cwd(), 'public', 'modelos', 'capturar-suap-semanal.js'),
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
    expect(SCRIPT).toMatch(/nenhum do campus/);
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
    expect(SCRIPT).toMatch(/extensao: projetosLidos > 0 \? resultado\.extensao/);
    expect(SCRIPT).toMatch(/pesquisa: projetosLidos > 0 \? resultado\.pesquisa/);
    expect(SCRIPT).toMatch(/editais: editaisLidos > 0 \? editais/);
  });

  it('lê as três listas de editais do SUAP e filtra o campus pelo próprio filtro da página', () => {
    expect(SCRIPT).toContain("'/pesquisa/editais/'");
    expect(SCRIPT).toContain("'/projetos/editais/'");
    expect(SCRIPT).toContain("'/projetos_ensino/editais/'");
    // o número interno do campus vem do <select>, não de um valor fixo
    expect(SCRIPT).toContain('select[name="uo"] option');
  });

  it('descarta o que o portal já conhece (e traz tudo quando a lista não veio)', () => {
    expect(SCRIPT).toContain('window.__portalConectaConhecidos');
    expect(SCRIPT).toContain('EDITAIS_CONHECIDOS.has(chaveEdital(');
    expect(SCRIPT).toMatch(/PROJETOS_CONHECIDOS\.has\(fonte \+ ':' \+ projeto\.id\)/);
  });

  it('não copia o endereço assinado do PDF (expira e carrega chave de acesso)', () => {
    expect(SCRIPT).toContain('temArquivo');
    // do link do arquivo só se registra SE existe (booleano), nunca o endereço
    expect(SCRIPT).toContain("temLink: !!(dd && dd.querySelector('a[href]'))");
    expect(SCRIPT).not.toMatch(/Signature|AWSAccessKeyId|getAttribute\('href'\)/);
  });

  it('a chave de identidade do edital é igual no script e no servidor', () => {
    const bloco = SCRIPT.match(/\/\/ <chave-edital>([\s\S]*?)\/\/ <\/chave-edital>/);
    expect(bloco).not.toBeNull();
    const noScript = vm.runInNewContext(`${bloco![1]}; chaveEdital`) as (f: string, t: string, i: string) => string;

    const casos: [string, string, string][] = [
      ['projetos', 'PROJETOS CIECs - PIBEX-JR - CAMPUS IVAIPORÃ', '26/10/2026 00:00:00 a 04/11/2026 00:00:00'],
      ['ensino', 'Edital de Projetos de Ensino em fluxo contínuo - campus Ivaiporã', '30/09/2026 17:00:00 a 31/12/2030 00:00:00'],
      ['pesquisa', '  Edital   nº 03/2025 — Iniciação Científica (PIBIC/PIBITI)  ', '16/09/2025 00:00:00 a 30/06/2026 00:00:00'],
      ['ensino', 'Título sem datas', ''],
    ];
    for (const [fonte, titulo, inscricoes] of casos) {
      expect(noScript(fonte, titulo, inscricoes)).toBe(chaveEdital(fonte, titulo, inscricoes));
    }
  });
});
