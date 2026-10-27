import { describe, it, expect } from 'vitest';
import {
  analisarEditaisCapturados,
  chaveEdital,
  datasNumericas,
  datasPorExtenso,
  lerCronograma,
  mapearEditalSuap,
  statusDoEdital,
  statusPelasDatas,
  type EditalCapturado,
} from '@/lib/suap-editais';
import { chaveProjeto, lerPacoteCarga } from '@/lib/suap-carga';

/**
 * Editais do SUAP capturados nas listas web (27/10/2026).
 *
 * Os cartões abaixo reproduzem textos reais da lista do campus Ivaiporã — inclusive
 * a incoerência que o SUAP deixou passar (recurso terminando antes de começar).
 */
const PIBEX: EditalCapturado = {
  fonte: 'projetos',
  titulo: 'PROJETOS CIECs - PIBEX-JR - CAMPUS IVAIPORÃ',
  descricao: 'A Pró-Reitoria de Extensão, Arte, Cultura e Esportes ... torna pública a Chamada Interna Específica do Campus Ivaiporã.',
  inscricoes: '26/10/2026 00:00:00 a 04/11/2026 00:00:00',
  preSelecao: '30 de Outubro de 2026 às 00:00 - 31 de Outubro de 2026 às 00:00',
  selecao: '31 de Outubro de 2026 às 00:00 - 3 de Novembro de 2026 às 00:00',
  recurso: '3 de Novembro de 2026 às 00:00 - 1 de Novembro de 2026 às 15:25',
  resultado: '5 de Novembro de 2026 às 00:00',
  campi: 'IVAIPODG',
  temArquivo: true,
};

const FLUXO: EditalCapturado = {
  fonte: 'ensino',
  titulo: 'Edital de Projetos de Ensino em fluxo contínuo - campus Ivaiporã',
  descricao: 'O Campus Ivaiporã, por meio da Diretoria de Ensino, Pesquisa e Extensão, torna público o presente edital.',
  inscricoes: '30/09/2026 17:00:00 a 31/12/2030 00:00:00',
  preSelecao: '1 de Setembro de 2026 às 00:00 - 2 de Setembro de 2026 às 00:00',
  selecao: '2 de Setembro de 2026 às 00:00 - 31 de Dezembro de 2030 às 00:00',
  recurso: '2 de Setembro de 2026 às 08:00 - 31 de Dezembro de 2030 às 00:00',
  resultado: '1 de Outubro de 2026 às 00:00',
  campi: 'IVAIPODG',
  temArquivo: true,
};

const em = (iso: string) => new Date(iso);

describe('datas do SUAP (horário de Brasília)', () => {
  it('lê "dd/mm/aaaa hh:mm:ss" como horário de Brasília (UTC-3)', () => {
    const [ini, fim] = datasNumericas(PIBEX.inscricoes);
    expect(ini.toISOString()).toBe('2026-10-26T03:00:00.000Z');
    expect(fim.toISOString()).toBe('2026-11-04T03:00:00.000Z');
    expect(datasNumericas('30/09/2026 17:00:00')[0].toISOString()).toBe('2026-09-30T20:00:00.000Z');
  });

  it('rejeita data impossível em vez de rolar para o mês seguinte', () => {
    expect(datasNumericas('31/02/2026 00:00:00')).toEqual([]);
  });

  it('lê datas por extenso, com e sem acento no mês', () => {
    const [ini, fim] = datasPorExtenso(PIBEX.preSelecao);
    expect(ini.toISOString()).toBe('2026-10-30T03:00:00.000Z');
    expect(fim.toISOString()).toBe('2026-10-31T03:00:00.000Z');
    expect(datasPorExtenso('15 de Março de 2027 às 10:30')[0].toISOString()).toBe('2027-03-15T13:30:00.000Z');
    expect(datasPorExtenso('1 de Foobar de 2026')).toEqual([]);
  });

  it('descarta o fim de um período que termina antes de começar', () => {
    const c = lerCronograma(PIBEX);
    expect(c.recursoInicio?.toISOString()).toBe('2026-11-03T03:00:00.000Z');
    expect(c.recursoFim).toBeNull();
  });
});

describe('status pelas datas reais', () => {
  const c = lerCronograma(PIBEX);

  it('antes das inscrições: em breve', () => {
    expect(statusDoEdital(c, em('2026-10-20T12:00:00Z'))).toBe('EM_BREVE');
  });

  it('durante as inscrições: aberto', () => {
    expect(statusDoEdital(c, em('2026-10-27T12:00:00Z'))).toBe('ABERTO');
  });

  it('inscrições encerradas e resultado ainda não saiu: em análise', () => {
    expect(statusDoEdital(c, em('2026-11-04T15:00:00Z'))).toBe('EM_ANALISE');
  });

  it('depois do resultado: publicado por 30 dias, depois encerrado', () => {
    expect(statusDoEdital(c, em('2026-11-06T12:00:00Z'))).toBe('RESULTADO_PUBLICADO');
    expect(statusDoEdital(c, em('2027-01-30T12:00:00Z'))).toBe('ENCERRADO');
  });

  it('fluxo contínuo (inscrições até 2030) segue aberto mesmo com resultado já divulgado', () => {
    expect(statusDoEdital(lerCronograma(FLUXO), em('2026-10-27T12:00:00Z'))).toBe('ABERTO');
  });

  it('o período de recurso não muda o status (o portal não guarda o início dele)', () => {
    const comRecurso = lerCronograma({ ...PIBEX, recurso: '5 de Novembro de 2026 às 08:00 - 7 de Novembro de 2026 às 18:00', resultado: '10 de Novembro de 2026 às 00:00' });
    expect(statusDoEdital(comRecurso, em('2026-11-06T12:00:00Z'))).toBe('EM_ANALISE');
  });

  it('statusPelasDatas (datas gravadas no banco) dá o mesmo resultado que a importação', () => {
    const c = lerCronograma(PIBEX);
    const gravado = { dataInicio: c.inscricaoInicio, dataEncerramento: c.inscricaoFim, dataResultado: c.resultado };
    for (const quando of ['2026-10-20T12:00:00Z', '2026-10-27T12:00:00Z', '2026-11-04T15:00:00Z', '2026-11-06T12:00:00Z', '2027-01-30T12:00:00Z']) {
      expect(statusPelasDatas(gravado, em(quando)), quando).toBe(statusDoEdital(c, em(quando)));
    }
  });

  it('sem nenhuma data de inscrição não afirma que acabou', () => {
    const vazio = lerCronograma({ inscricoes: '', preSelecao: '', selecao: '', recurso: '', resultado: '' });
    expect(statusDoEdital(vazio, em('2026-10-27T12:00:00Z'))).toBe('ABERTO');
  });
});

describe('identidade do edital (os cartões não têm ID)', () => {
  it('ignora acento, caixa e espaços, e inclui fonte e ano de abertura', () => {
    expect(chaveEdital('projetos', PIBEX.titulo, PIBEX.inscricoes))
      .toBe('suap-edital:projetos:projetos-ciecs-pibex-jr-campus-ivaipora:2026');
    expect(chaveEdital('projetos', '  projetos   CIECs - pibex-jr - campus ivaipora ', '01/01/2026 00:00:00'))
      .toBe(chaveEdital('projetos', PIBEX.titulo, PIBEX.inscricoes));
  });

  it('o mesmo título em outro ano ou em outra fonte é outro edital', () => {
    const base = chaveEdital('ensino', 'Edital fluxo contínuo', '16/09/2025 00:00:00 a 30/06/2026 00:00:00');
    expect(chaveEdital('ensino', 'Edital fluxo contínuo', '30/09/2026 17:00:00 a 31/12/2030 00:00:00')).not.toBe(base);
    expect(chaveEdital('pesquisa', 'Edital fluxo contínuo', '16/09/2025 00:00:00 a 30/06/2026 00:00:00')).not.toBe(base);
  });

  it('sem data legível usa ano 0 em vez de quebrar', () => {
    expect(chaveEdital('ensino', 'Algo', '')).toBe('suap-edital:ensino:algo:0');
  });
});

describe('análise da captura de editais', () => {
  it('aceita os cartões do campus e calcula a chave', () => {
    const r = analisarEditaisCapturados([PIBEX, FLUXO], 'IVAIPODG');
    expect(r.editais).toHaveLength(2);
    expect(r.editais[0].chave).toBe(chaveEdital('projetos', PIBEX.titulo, PIBEX.inscricoes));
    expect(r.resumo.porFonte).toEqual({ projetos: 1, ensino: 1 });
    expect(r.erros).toEqual([]);
  });

  it('descarta edital de outro campus (segunda trava, além do filtro da URL)', () => {
    const r = analisarEditaisCapturados([PIBEX, { ...FLUXO, campi: 'LONDRINADG' }], 'IVAIPODG');
    expect(r.editais).toHaveLength(1);
    expect(r.resumo.outroCampus).toBe(1);
  });

  it('edital para vários campi entra se Ivaiporã está entre eles', () => {
    const r = analisarEditaisCapturados([{ ...PIBEX, campi: 'LONDRINADG, IVAIPODG' }], 'IVAIPODG');
    expect(r.editais).toHaveLength(1);
  });

  it('sem o campo de campi confia no filtro da URL', () => {
    expect(analisarEditaisCapturados([{ ...PIBEX, campi: '' }], 'IVAIPODG').editais).toHaveLength(1);
  });

  it('aponta item sem fonte ou sem título e segue com os demais', () => {
    const r = analisarEditaisCapturados([{ ...PIBEX, fonte: 'outra' }, { ...PIBEX, titulo: '  ' }, null, FLUXO], 'IVAIPODG');
    expect(r.editais).toHaveLength(1);
    expect(r.erros.map((e) => e.indice)).toEqual([1, 2, 3]);
  });

  it('mesmo título e ano na mesma fonte vira um só, com aviso', () => {
    const r = analisarEditaisCapturados([PIBEX, { ...PIBEX, descricao: 'versão nova' }], 'IVAIPODG');
    expect(r.editais).toHaveLength(1);
    expect(r.editais[0].descricao).toBe('versão nova');
    expect(r.avisos.join(' ')).toMatch(/mesmo título/);
  });

  it('avisa quando o SUAP não trouxe data de inscrição legível', () => {
    const r = analisarEditaisCapturados([{ ...PIBEX, inscricoes: 'a combinar' }], 'IVAIPODG');
    expect(r.avisos.join(' ')).toMatch(/sem data de inscrição/);
  });
});

describe('mapeamento para o portal', () => {
  const agora = em('2026-10-27T12:00:00Z');
  const [pibex] = analisarEditaisCapturados([PIBEX]).editais;
  const [fluxo] = analisarEditaisCapturados([FLUXO]).editais;

  it('categoria pela fonte da lista', () => {
    expect(mapearEditalSuap(pibex, agora).categoria).toBe('EXTENSAO');
    expect(mapearEditalSuap(fluxo, agora).categoria).toBe('ENSINO');
    const pesquisa = analisarEditaisCapturados([{ ...PIBEX, fonte: 'pesquisa' }]).editais[0];
    expect(mapearEditalSuap(pesquisa, agora).categoria).toBe('PESQUISA');
  });

  it('guarda as datas reais e o status delas', () => {
    const m = mapearEditalSuap(pibex, agora);
    expect(m.status).toBe('ABERTO');
    expect(m.ano).toBe(2026);
    expect(m.dataInicio?.toISOString()).toBe('2026-10-26T03:00:00.000Z');
    expect(m.dataEncerramento?.toISOString()).toBe('2026-11-04T03:00:00.000Z');
    expect(m.dataResultado?.toISOString()).toBe('2026-11-05T03:00:00.000Z');
    expect(m.prazoRecurso).toBeNull(); // período incoerente do SUAP não vira prazo
  });

  it('usa a identidade como origemRef e não guarda link de arquivo do SUAP', () => {
    const m = mapearEditalSuap(pibex, agora);
    expect(m.origemRef).toBe(pibex.chave);
    expect(m.linkOficial).toBe('https://suap.ifpr.edu.br/projetos/editais/');
    expect(JSON.stringify(m)).not.toMatch(/AWSAccessKeyId|Signature|amazonaws/i);
  });

  it('o resumo da IFizinha só diz o que o cartão diz (datas) e manda abrir o edital', () => {
    const m = mapearEditalSuap(pibex, agora);
    expect(m.resumoSimples).toContain('26/10/2026');
    expect(m.resumoSimples).toContain('04/11/2026');
    expect(m.resumoSimples).toContain('05/11/2026');
    expect(m.resumoSimples).toMatch(/edital oficial/);
    // nada de valor, carga horária ou requisito inventado
    expect(m.resumoSimples + JSON.stringify(m.traducaoIFizinha)).not.toMatch(/R\$|\d+\s*horas|\bbolsa de\b/i);
    expect(m.traducaoIFizinha.beneficios).toBe('');
  });

  it('sem descrição, o resumo não fica vazio', () => {
    const [semTexto] = analisarEditaisCapturados([{ ...PIBEX, descricao: '' }]).editais;
    expect(mapearEditalSuap(semTexto, agora).resumo).toMatch(/publicado no SUAP/);
  });

  it('extrai o número só quando o título tem "nº NN/AAAA"', () => {
    const [comNumero] = analisarEditaisCapturados([{ ...PIBEX, titulo: 'Edital nº 7/2026 - PIBEX' }]).editais;
    expect(mapearEditalSuap(comNumero, agora).numero).toBe('07/2026');
    expect(mapearEditalSuap(pibex, agora).numero).toBeNull();
  });
});

describe('pacote da carga semanal', () => {
  it('lê o pacote novo: editais à parte, projetos no formato que já existia', () => {
    const r = lerPacoteCarga(JSON.stringify({
      origem: 'captura-suap-navegador', versao: 2, geradoEm: '2026-10-27T12:00:00Z',
      ignoradosJaExistentes: { editais: 5, projetos: 40 },
      problemas: ['editais (pesquisa): layout mudou'],
      editais: [PIBEX], extensao: [{ id: 1, titulo: 'x' }], pesquisa: [],
    }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.editais).toHaveLength(1);
    expect(JSON.parse(r.projetos!)).toMatchObject({ extensao: [{ id: 1 }], pesquisa: [] });
    expect(JSON.parse(r.projetos!).editais).toBeUndefined();
    expect(r.ignoradosNoScript).toEqual({ editais: 5, projetos: 40 });
    expect(r.problemas).toEqual(['editais (pesquisa): layout mudou']);
  });

  it('semana sem novidades continua sendo um pacote válido', () => {
    const r = lerPacoteCarga(JSON.stringify({ editais: [], extensao: [], pesquisa: [], ignoradosJaExistentes: { editais: 7, projetos: 90 } }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.editais).toEqual([]);
  });

  it('só editais (grupo de projetos falhou no script): projetos fica de fora, sem registrar carga', () => {
    const r = lerPacoteCarga(JSON.stringify({ editais: [PIBEX], problemas: ['projetos (extensao): WAF'] }));
    expect(r.ok && r.projetos).toBeNull();
  });

  it('o formato antigo (só projetos) segue valendo', () => {
    const r = lerPacoteCarga(JSON.stringify({ extensao: [{ id: 1, titulo: 'x' }], pesquisa: [] }));
    expect(r.ok && r.editais).toBeNull();
    expect(r.ok && r.projetos).not.toBeNull();
    expect(lerPacoteCarga(JSON.stringify([{ id: 1, titulo: 'x' }])).ok).toBe(true);
  });

  it('aceita BOM e recusa o que não é da captura', () => {
    expect(lerPacoteCarga('﻿' + JSON.stringify({ editais: [] })).ok).toBe(true);
    expect(lerPacoteCarga('{ quebrado').ok).toBe(false);
    expect(lerPacoteCarga(JSON.stringify({ qualquer: 'coisa' })).ok).toBe(false);
    expect(lerPacoteCarga('"texto"').ok).toBe(false);
  });

  it('chave do projeto casa com a que o script usa (extensão é ID negativo no banco)', () => {
    expect(chaveProjeto(-123)).toBe('extensao:123');
    expect(chaveProjeto(123)).toBe('pesquisa:123');
  });
});
