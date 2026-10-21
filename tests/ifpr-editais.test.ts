import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  classificarTipo, classificarArea, extrairAno, limparTexto,
  extrairEditaisDePagina, extrairEditaisIfprIvaipora, resumirEditais, editaisParaCsv,
  type EditalExtraido,
} from '@/lib/ifpr-editais';

/**
 * Extração dos editais de Ivaiporã a partir do site do IFPR.
 *
 * Os testes rodam contra **HTML real salvo do site** (tests/fixtures), porque o
 * layout é o que decide o que dá para extrair: as duas formas que existem lá
 * (página-hub de documentos e cards com botão "Acessar Edital") estão cobertas, e
 * uma página de portarias serve para provar que portaria não entra como edital.
 */
const fixture = (nome: string) => JSON.parse(readFileSync(join(process.cwd(), 'tests', 'fixtures', nome), 'utf8'));

describe('classificação', () => {
  it('reconhece o tipo pela ordem certa (retificação não vira edital)', () => {
    expect(classificarTipo('Edital nº 51 – Retificação do Edital nº 37')).toBe('RETIFICACAO');
    expect(classificarTipo('Edital 68 – RESULTADO FINAL PAIPE')).toBe('RESULTADO');
    expect(classificarTipo('Prorrogação do período de inscrições')).toBe('PRORROGACAO');
    expect(classificarTipo('Portaria nº 04 de 17 de janeiro de 2017')).toBe('PORTARIA');
    expect(classificarTipo('Edital nº 03/2026 – Inscrição para monitoria voluntária')).toBe('EDITAL');
    expect(classificarTipo('SEI_4349102_Edital_interno.pdf')).toBe('EDITAL');
  });

  it('deduz a área pelo caminho da página', () => {
    expect(classificarArea('https://ifpr.edu.br/ivaipora/copex/bolsas/bolsas-2026-2027/')).toBe('BOLSAS');
    expect(classificarArea('https://ifpr.edu.br/ivaipora/sepae/assistencia-estudantil/')).toBe('ASSISTENCIA_ESTUDANTIL');
    expect(classificarArea('https://ifpr.edu.br/ivaipora/nossos-cursos/fics/robotica/processo-de-selecao/')).toBe('FIC');
    expect(classificarArea('https://ifpr.edu.br/ivaipora/segepe-secao-de-gestao-de-pessoas/processos-seletivos-2025/')).toBe('SERVIDORES');
    expect(classificarArea('https://ifpr.edu.br/ivaipora/documentos-institucionais/editais/')).toBe('INSTITUCIONAL');
  });

  it('extrai o ano do texto e, na falta, do caminho', () => {
    expect(extrairAno('Edital nº 03/2026 – monitoria', '')).toBe(2026);
    expect(extrairAno('sem ano', 'https://x/2022/08/arquivo.pdf')).toBe(2022);
    expect(extrairAno('sem ano', 'https://x/arquivo.pdf')).toBeNull();
  });

  it('limpa entidades e tags do HTML', () => {
    expect(limparTexto('<p>Edital&nbsp;nº&nbsp;16 &#8211; <b>Resultado</b></p>')).toBe('Edital nº 16 – Resultado');
  });
});

describe('extração da página-hub de editais do campus (HTML real)', () => {
  const paginas = fixture('ifpr-pagina-editais.json');
  const itens: EditalExtraido[] = extrairEditaisDePagina(paginas[0].content.rendered, { titulo: 'Editais', url: paginas[0].link });

  it('encontra os documentos com rótulo descritivo', () => {
    expect(itens.length).toBeGreaterThan(10);
    // o site do campus também aponta para o domínio antigo (ivaipora.ifpr.edu.br)
    // e para o SEI (sei.ifpr.edu.br) — todos são institucionais e ficam
    expect(itens.every((i) => /^https:\/\/([a-z0-9-]+\.)*ifpr\.edu\.br\//i.test(i.url))).toBe(true);
    expect(itens.every((i) => i.area === 'INSTITUCIONAL')).toBe(true);
  });

  it('não devolve rótulo vazio nem título repetido', () => {
    expect(itens.every((i) => i.titulo.trim().length > 0)).toBe(true);
    const urls = itens.map((i) => i.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it('não classifica página de portaria como edital (a lista bruta traz as duas)', () => {
    const tipos = new Set(itens.map((i) => i.tipo));
    expect(tipos.has('EDITAL') || tipos.has('RESULTADO')).toBe(true);
    // se alguma portaria apareceu, ela está marcada como PORTARIA (e o chamador filtra)
    const portarias = itens.filter((i) => /portaria/i.test(i.titulo));
    expect(portarias.every((i) => i.tipo === 'PORTARIA')).toBe(true);
  });

  it('acha o ano dos documentos de 2023 e 2022', () => {
    const anos = itens.map((i) => i.ano).filter(Boolean);
    expect(anos).toContain(2023);
    expect(anos.some((a) => a === 2022 || a === 2021)).toBe(true);
  });
});

describe('extração de página de bolsas com botão genérico (HTML real)', () => {
  const paginas = fixture('ifpr-pagina-bolsas.json');
  const itens: EditalExtraido[] = paginas.flatMap((p: { content: { rendered: string }; link: string; title: { rendered: string } }) =>
    extrairEditaisDePagina(p.content.rendered, { titulo: limparTexto(p.title.rendered), url: p.link }));

  it('extrai os PDFs mesmo quando o link diz só "Acessar Edital"', () => {
    expect(itens.length).toBeGreaterThan(5);
    expect(itens.every((i) => /\.pdf/i.test(i.url) || i.arquivo.length > 0)).toBe(true);
  });

  it('não deixa título genérico no resultado', () => {
    // "Acessar Edital" não é título: tem de virar o cabeçalho do bloco ou o nome do arquivo
    const genericos = itens.filter((i) => /^(\p{Emoji}\s*)?(acessar|clique|baixar|ver)\b/iu.test(i.titulo));
    expect(genericos).toEqual([]);
  });

  it('marca a área como BOLSAS', () => {
    expect(itens.every((i) => i.area === 'BOLSAS')).toBe(true);
  });
});

describe('varredura completa (fetch simulado)', () => {
  const paginas = fixture('ifpr-pagina-editais.json');
  const bolsas = fixture('ifpr-pagina-bolsas.json');

  const fetchFalso = (lotes: Record<number, unknown[]>, cabecalhos: Record<string, string> = {}) =>
    (async (url: string) => {
      const pagina = Number(new URL(url).searchParams.get('page') ?? '1');
      const corpo = lotes[pagina] ?? [];
      return {
        ok: true,
        status: 200,
        headers: { get: (n: string) => (n.toLowerCase() === 'content-type' ? 'application/json' : cabecalhos[n.toLowerCase()] ?? null) },
        json: async () => corpo,
        text: async () => JSON.stringify(corpo),
      };
    }) as never;

  it('junta páginas, deduplica por URL e resume', async () => {
    const resultado = await extrairEditaisIfprIvaipora({
      fetchImpl: fetchFalso({ 1: [...paginas, ...bolsas] }, { 'x-wp-totalpages': '1' }),
    });
    expect(resultado.paginasVarridas).toBe(paginas.length + bolsas.length);
    expect(resultado.itens.length).toBeGreaterThan(20);
    const urls = resultado.itens.map((i) => i.url);
    expect(new Set(urls).size).toBe(urls.length);
    const resumo = resumirEditais(resultado.itens);
    expect(Object.keys(resumo.porTipo).length).toBeGreaterThan(1);
    expect(Object.keys(resumo.porArea)).toEqual(expect.arrayContaining(['INSTITUCIONAL', 'BOLSAS']));
  });

  it('paginando até o fim (segue x-wp-totalpages)', async () => {
    const resultado = await extrairEditaisIfprIvaipora({
      fetchImpl: fetchFalso({ 1: paginas, 2: bolsas, 3: [] }, { 'x-wp-totalpages': '2' }),
      porPagina: 1,
    });
    expect(resultado.paginasVarridas).toBe(paginas.length + bolsas.length);
  });

  it('explica o desafio do WAF em vez de devolver lista vazia em silêncio', async () => {
    const fetchDesafiado = (async () => ({
      ok: false,
      status: 202,
      headers: { get: (n: string) => (n.toLowerCase() === 'content-type' ? 'text/html' : null) },
      json: async () => ({}),
      text: async () => '<html><title>Human Verification</title><script src="challenge.js"></script>',
    })) as never;

    const resultado = await extrairEditaisIfprIvaipora({ fetchImpl: fetchDesafiado });
    expect(resultado.itens).toEqual([]);
    expect(resultado.avisos.join(' ')).toMatch(/verifica/i);
    expect(resultado.avisos.join(' ')).toMatch(/abra ifpr\.edu\.br/i);
  });

  it('CSV abre com cabeçalho e uma linha por documento', async () => {
    const resultado = await extrairEditaisIfprIvaipora({ fetchImpl: fetchFalso({ 1: paginas }) });
    const linhas = editaisParaCsv(resultado.itens).split('\n');
    expect(linhas[0]).toBe('ano;tipo;area;titulo;url;arquivo;pagina_titulo;pagina_url');
    expect(linhas).toHaveLength(resultado.itens.length + 1);
  });
});
