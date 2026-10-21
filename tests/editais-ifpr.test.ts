import { describe, it, expect } from 'vitest';
import {
  mapearCategoria, mapearStatus, extrairNumero, slugDoEdital, gerarResumoIFizinha,
  mapearEditalParaPortal, filtrarEditais, opcoesDeFiltro, normalizarBusca,
} from '@/lib/editais-ifpr';
import type { EditalExtraido } from '@/lib/ifpr-editais';

/**
 * Conversão dos editais do site do IFPR para o portal.
 *
 * O que mais importa aqui é a **honestidade do texto**: a extração não traz datas,
 * valores nem requisitos (isso está dentro do PDF), então nenhum resumo pode
 * prometer essas coisas. Os testes travam isso — é o tipo de erro que passa
 * despercebido e vira informação errada na mão do estudante.
 */
const item = (over: Partial<EditalExtraido> = {}): EditalExtraido => ({
  titulo: 'Edital nº 03/2026 – Inscrição para monitoria voluntária',
  url: 'https://ifpr.edu.br/ivaipora/wp-content/uploads/sites/15/2026/08/Edital-Monitoria-2026.2.pdf',
  arquivo: 'Edital Monitoria 2026.2',
  tipo: 'EDITAL',
  area: 'ENSINO_SUPERIOR',
  ano: 2026,
  pagina: { titulo: 'Monitoria Voluntária', url: 'https://ifpr.edu.br/ivaipora/documentos-institucionais/editais/' },
  ...over,
});

describe('categoria e status', () => {
  it('resultado vira RESULTADOS, independente da área', () => {
    expect(mapearCategoria(item({ tipo: 'RESULTADO', area: 'BOLSAS' }))).toBe('RESULTADOS');
    expect(mapearCategoria(item({ tipo: 'RETIFICACAO', area: 'BOLSAS' }))).toBe('BOLSAS');
  });

  it('mapeia as áreas para as categorias que o portal conhece', () => {
    expect(mapearCategoria(item({ area: 'BOLSAS' }))).toBe('BOLSAS');
    expect(mapearCategoria(item({ area: 'ASSISTENCIA_ESTUDANTIL' }))).toBe('AUXILIOS');
    expect(mapearCategoria(item({ area: 'PESQUISA' }))).toBe('PESQUISA');
    expect(mapearCategoria(item({ area: 'EXTENSAO' }))).toBe('EXTENSAO');
    expect(mapearCategoria(item({ area: 'FIC' }))).toBe('ENSINO');
    expect(mapearCategoria(item({ area: 'INSTITUCIONAL' }))).toBe('ENSINO');
  });

  it('status: resultado publicado, ano passado encerrado, ano corrente aberto', () => {
    expect(mapearStatus(item({ tipo: 'RESULTADO' }), 2026)).toBe('RESULTADO_PUBLICADO');
    expect(mapearStatus(item({ ano: 2024 }), 2026)).toBe('ENCERRADO');
    expect(mapearStatus(item({ ano: 2026 }), 2026)).toBe('ABERTO');
    expect(mapearStatus(item({ ano: null }), 2026)).toBe('EM_BREVE');
  });
});

describe('número e slug', () => {
  it('tira o número do edital do título', () => {
    expect(extrairNumero('Edital nº 03/2026 – Inscrição para monitoria', 2026)).toBe('03/2026');
    expect(extrairNumero('Edital 09 – Processo Seletivo para ingresso', 2026)).toBe('09/2026');
    expect(extrairNumero('SEI 4339133 Edital 63 chamada interna', 2026)).toBe('63/2026');
    expect(extrairNumero('Resultado final do processo', 2026)).toBeNull();
  });

  it('slug é legível, sem acento, e não colide entre documentos diferentes', () => {
    const a = slugDoEdital('Edital nº 03/2026 – Inscrição para monitoria voluntária', 2026, 'https://x/a.pdf');
    const b = slugDoEdital('Edital nº 03/2026 – Inscrição para monitoria voluntária', 2026, 'https://x/b.pdf');
    expect(a).toMatch(/^edital-edital-n-?0?3-2026/);
    expect(a).not.toContain('ç');
    expect(a.length).toBeLessThanOrEqual(80);
    expect(a).not.toBe(b);
  });

  it('título com acento vira slug sem acento', () => {
    const slug = slugDoEdital('Relatório de gestão: ação e inclusão', 2026, 'https://x/c.pdf');
    expect(slug).not.toMatch(/[áàâãéêíóôõúç]/);
  });
});

describe('resumo da IFizinha', () => {
  const resumo = gerarResumoIFizinha(item({ area: 'BOLSAS', ano: 2025 }));

  it('fala a área, o ano e manda conferir o original', () => {
    expect(resumo).toContain('Bolsas e programas');
    expect(resumo).toContain('2025');
    expect(resumo).toMatch(/documento oficial|arquivo oficial/i);
  });

  it('NÃO inventa prazo, valor nem requisito (não estão no site do IFPR)', () => {
    // nada de dinheiro, carga horária ou data — o dado não existe na extração
    expect(resumo).not.toMatch(/R\$\s?\d/);
    expect(resumo).not.toMatch(/\d{1,2}\/\d{1,2}\/\d{2,4}/);
    expect(resumo).not.toMatch(/\d+\s?(horas|h\/semana)/i);
    // e diz explicitamente que as datas estão no arquivo
    expect(resumo).toMatch(/datas/i);
  });

  it('sem markdown (a listagem renderiza texto puro)', () => {
    expect(resumo).not.toContain('**');
  });
});

describe('mapeamento para o portal', () => {
  const edital = mapearEditalParaPortal(item(), { anoAtual: 2026 });

  it('guarda o link original e marca a origem (idempotência por URL)', () => {
    expect(edital.origemRef).toBe(item().url);
    expect(edital.linkOficial).toBe(item().url);
    expect(edital.arquivoPdfUrl).toBe(item().url);
    expect(edital.source).toBe('IMPORT');
  });

  it('link que não é PDF fica só em linkOficial', () => {
    const pagina = mapearEditalParaPortal(item({ url: 'https://ifpr.edu.br/ivaipora/algum-edital/' }), { anoAtual: 2026 });
    expect(pagina.linkOficial).toBe('https://ifpr.edu.br/ivaipora/algum-edital/');
    expect(pagina.arquivoPdfUrl).toBeNull();
  });

  it('preenche área, setor, público e o resumo técnico com a proveniência', () => {
    expect(edital.areaEdital).toBe('ENSINO_SUPERIOR');
    expect(edital.setorResponsavel).toBe('Direção de Ensino');
    expect(edital.publicoAlvo).toBe('Estudantes');
    expect(edital.resumo).toContain('site do IFPR');
    expect(edital.resumo).toContain('Monitoria Voluntária');
  });

  it('tradução da IFizinha tem os campos que a página de detalhe lê, sem inventar', () => {
    expect(Object.keys(edital.traducaoIFizinha)).toEqual(
      expect.arrayContaining(['oquee', 'quempode', 'beneficios', 'comoinscrever', 'prazo', 'observacoes']),
    );
    // benefícios não vêm no site → fica vazio em vez de chutar
    expect(edital.traducaoIFizinha.beneficios).toBe('');
    expect(edital.traducaoIFizinha.prazo).toMatch(/não aparecem no site|documento oficial/i);
    expect(edital.traducaoIFizinha.observacoes).toContain(item().pagina.url);
  });

  it('título curto ganha contexto para não ficar repetido na lista', () => {
    const curto = mapearEditalToPortalCheck();
    expect(curto).toContain('2024');
  });

  function mapearEditalToPortalCheck() {
    return mapearEditalParaPortal(
      item({ titulo: 'Edital de Abertura', ano: 2024, area: 'SERVIDORES' }),
      { anoAtual: 2026 },
    ).titulo;
  }
});

describe('filtros da listagem', () => {
  const editais = [
    { titulo: 'Edital de Bolsas PIBIC 2026', categoria: 'BOLSAS', status: 'ABERTO', ano: 2026, areaEdital: 'BOLSAS', resumoSimples: 'bolsa de iniciação científica', updatedAt: new Date('2026-08-01') },
    { titulo: 'Resultado do processo seletivo FIC', categoria: 'RESULTADOS', status: 'RESULTADO_PUBLICADO', ano: 2025, areaEdital: 'FIC', resumoSimples: 'lista de aprovados', updatedAt: new Date('2025-12-01') },
    { titulo: 'Edital de assistência estudantil', categoria: 'AUXILIOS', status: 'ENCERRADO', ano: 2024, areaEdital: 'ASSISTENCIA_ESTUDANTIL', resumoSimples: 'auxílio estudantil', updatedAt: new Date('2024-03-01') },
  ];

  it('busca ignora acento e caixa, e exige todas as palavras', () => {
    expect(filtrarEditais(editais, { busca: 'bolsas' })).toHaveLength(1);
    expect(filtrarEditais(editais, { busca: 'BOLSAS pibic' })).toHaveLength(1);
    expect(filtrarEditais(editais, { busca: 'assistencia' })).toHaveLength(1);
    expect(filtrarEditais(editais, { busca: 'edital 2025' })).toHaveLength(0);
  });

  it('filtra por categoria, área, ano e status', () => {
    expect(filtrarEditais(editais, { categoria: 'RESULTADOS' })).toHaveLength(1);
    expect(filtrarEditais(editais, { area: 'FIC' })).toHaveLength(1);
    expect(filtrarEditais(editais, { ano: '2026' })).toHaveLength(1);
    expect(filtrarEditais(editais, { status: 'ENCERRADO' })).toHaveLength(1);
    expect(filtrarEditais(editais, { categoria: 'todas', area: 'todas', ano: 'todos' })).toHaveLength(3);
  });

  it('combina filtros e ordena por ano (recentes primeiro)', () => {
    const todos = filtrarEditais(editais, {});
    expect(todos.map((e) => e.ano)).toEqual([2026, 2025, 2024]);
    expect(filtrarEditais(editais, { ordem: 'antigos' }).map((e) => e.ano)).toEqual([2024, 2025, 2026]);
    expect(filtrarEditais(editais, { ordem: 'titulo' })[0].titulo).toMatch(/^Edital de assist/);
  });

  it('oferece só as opções que existem', () => {
    const opcoes = opcoesDeFiltro(editais);
    expect(opcoes.anos).toEqual([2026, 2025, 2024]);
    expect(opcoes.areas).toEqual(['ASSISTENCIA_ESTUDANTIL', 'BOLSAS', 'FIC']);
    expect(opcoes.categorias).toEqual(['AUXILIOS', 'BOLSAS', 'RESULTADOS']);
  });

  it('normaliza busca como o usuário digita', () => {
    expect(normalizarBusca('  Inscrição  ')).toBe('inscricao');
  });
});
