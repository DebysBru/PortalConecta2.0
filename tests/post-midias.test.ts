import { describe, it, expect } from 'vitest';
import {
  LIMITE_POST_BYTES,
  anexosDoJson,
  caminhoInternoDaUrl,
  caminhosDeImagemNoHtml,
  formatarMb,
  mensagemPesoExcedido,
  pesoDoPost,
  resumoDoPeso,
  somarBytes,
  urlPublicaDoCaminho,
} from '@/lib/post-midias';
import { detectarTipoPorConteudo } from '@/lib/file-storage';

/**
 * Orçamento de mídia do post: o limite é do POST (20 MB), somando as imagens que
 * estão no texto e os arquivos anexados — pedido da coordenação em 2026-10-05.
 *
 * O que precisa ficar travado:
 *  - a conta é a MESMA no navegador e no servidor (este arquivo é a fonte única);
 *  - só arquivo do NOSSO storage pesa (imagem externa não consome o orçamento);
 *  - caminho suspeito (`../`) nunca é aceito como mídia do post;
 *  - ZIP e RAR são aceitos, decididos por magic bytes (não pela extensão).
 */

const MB = 1024 * 1024;

function buffer(...bytes: number[]): Buffer {
  return Buffer.from(bytes);
}

describe('caminho e URL das mídias', () => {
  it('converte URL pública em caminho interno', () => {
    expect(caminhoInternoDaUrl('/files/pdf/2026/10/abc.pdf')).toBe('pdf/2026/10/abc.pdf');
    expect(caminhoInternoDaUrl('/files/outros/2026/10/pacote.zip')).toBe('outros/2026/10/pacote.zip');
  });

  it('ignora query/hash e resolve URL codificada', () => {
    expect(caminhoInternoDaUrl('/files/imagens/2026/10/foto.png?x=1')).toBe('imagens/2026/10/foto.png');
    expect(caminhoInternoDaUrl('/files/imagens/2026/10/meu%20arquivo.png')).toBe('imagens/2026/10/meu arquivo.png');
  });

  it('recusa o que não é arquivo nosso ou é caminho suspeito', () => {
    expect(caminhoInternoDaUrl('https://exemplo.com/foto.png')).toBeNull();
    expect(caminhoInternoDaUrl('/outra-pasta/foto.png')).toBeNull();
    expect(caminhoInternoDaUrl('/files/../../etc/passwd')).toBeNull();
    expect(caminhoInternoDaUrl('/files/')).toBeNull();
    expect(caminhoInternoDaUrl(null)).toBeNull();
  });

  it('monta a URL pública a partir do caminho', () => {
    expect(urlPublicaDoCaminho('outros/2026/10/x.rar')).toBe('/files/outros/2026/10/x.rar');
  });
});

describe('imagens que estão dentro do texto', () => {
  it('acha as imagens nossas e ignora as de fora', () => {
    const html = `
      <p>Olha a foto:</p>
      <img src="/files/imagens/2026/10/a.png" alt="a">
      <p>E esta de fora:</p>
      <img src="https://exemplo.com/b.png" alt="b">
      <img src='/files/imagens/2026/10/c.jpg'>
      <img src=/files/imagens/2026/10/d.webp>
    `;
    expect(caminhosDeImagemNoHtml(html)).toEqual([
      'imagens/2026/10/a.png',
      'imagens/2026/10/c.jpg',
      'imagens/2026/10/d.webp',
    ]);
  });

  it('não conta a mesma imagem duas vezes', () => {
    const html = '<img src="/files/imagens/2026/10/a.png"><img src="/files/imagens/2026/10/a.png">';
    expect(caminhosDeImagemNoHtml(html)).toHaveLength(1);
  });

  it('sem imagem (ou sem html) devolve lista vazia', () => {
    expect(caminhosDeImagemNoHtml('<p>só texto</p>')).toEqual([]);
    expect(caminhosDeImagemNoHtml('')).toEqual([]);
    expect(caminhosDeImagemNoHtml(null)).toEqual([]);
  });
});

describe('peso do post', () => {
  const tamanhos: Record<string, number> = {
    'imagens/2026/10/a.png': 3 * MB,
    'outros/2026/10/pacote.zip': 5 * MB,
  };
  const tamanhoPorCaminho = (caminho: string) => tamanhos[caminho] ?? 0;

  it('soma imagens do texto + anexos', () => {
    const peso = pesoDoPost({
      html: '<img src="/files/imagens/2026/10/a.png">',
      anexos: [{ url: '/files/outros/2026/10/pacote.zip', nome: 'pacote.zip' }],
      tamanhoPorCaminho,
    });

    expect(peso.totalBytes).toBe(8 * MB);
    expect(peso.anexos).toEqual([
      {
        path: 'outros/2026/10/pacote.zip',
        url: '/files/outros/2026/10/pacote.zip',
        nome: 'pacote.zip',
        bytes: 5 * MB,
        mime: null,
      },
    ]);
    expect(peso.ausentes).toEqual([]);
  });

  it('IGNORA os bytes que o cliente informa (quem manda é o disco)', () => {
    const peso = pesoDoPost({
      html: '',
      // Cliente mal-intencionado dizendo que um arquivo de 5 MB tem 1 byte.
      anexos: [{ url: '/files/outros/2026/10/pacote.zip', bytes: 1 }],
      tamanhoPorCaminho,
    });

    expect(peso.totalBytes).toBe(5 * MB);
  });

  it('não conta duas vezes o mesmo anexo repetido na lista', () => {
    const peso = pesoDoPost({
      html: '',
      anexos: [
        { url: '/files/outros/2026/10/pacote.zip' },
        { url: '/files/outros/2026/10/pacote.zip' },
      ],
      tamanhoPorCaminho,
    });

    expect(peso.totalBytes).toBe(5 * MB);
    expect(peso.anexos).toHaveLength(1);
  });

  it('arquivo que não existe no disco conta 0 e entra em `ausentes`', () => {
    const peso = pesoDoPost({
      html: '<img src="/files/imagens/2026/10/sumiu.png">',
      anexos: [{ url: '/files/outros/2026/10/pacote.zip' }],
      tamanhoPorCaminho,
    });

    expect(peso.totalBytes).toBe(5 * MB);
    expect(peso.ausentes).toEqual(['imagens/2026/10/sumiu.png']);
  });

  it('anexo com URL externa é descartado (não é arquivo nosso)', () => {
    const peso = pesoDoPost({
      html: '',
      anexos: [{ url: 'https://drive.google.com/arquivo.zip' }, { path: 'outros/2026/10/pacote.zip' }],
      tamanhoPorCaminho,
    });

    expect(peso.anexos).toHaveLength(1);
    expect(peso.totalBytes).toBe(5 * MB);
  });

  it('somarBytes lida com lista vazia e valor inválido', () => {
    expect(somarBytes([])).toBe(0);
    expect(somarBytes([{ bytes: 10 }, { bytes: Number.NaN }])).toBe(10);
  });
});

describe('aviso de limite', () => {
  it('percentual satura em 100% e não sobra espaço quando estourou', () => {
    const metade = resumoDoPeso(LIMITE_POST_BYTES / 2);
    expect(metade.percentual).toBe(50);
    expect(metade.excedido).toBe(false);
    expect(metade.restanteBytes).toBe(LIMITE_POST_BYTES / 2);

    const estourado = resumoDoPeso(LIMITE_POST_BYTES + 5 * MB);
    expect(estourado.percentual).toBe(100);
    expect(estourado.excedido).toBe(true);
    expect(estourado.restanteBytes).toBe(0);
  });

  it('a mensagem diz o total, o limite e quanto remover', () => {
    const msg = mensagemPesoExcedido(23 * MB);
    expect(msg).toContain('23.0 MB');
    expect(msg).toContain('20 MB');
    expect(msg).toContain('3.0 MB');
    expect(msg).toMatch(/outro post/i);
  });

  it('formata MB com uma casa', () => {
    expect(formatarMb(1.5 * MB)).toBe('1.5 MB');
    expect(formatarMb(LIMITE_POST_BYTES, 0)).toBe('20 MB');
  });
});

describe('Post.anexos vindo do banco (JSON)', () => {
  it('normaliza uma lista válida', () => {
    expect(anexosDoJson([
      { path: 'outros/2026/10/a.zip', url: '/files/outros/2026/10/a.zip', nome: 'a.zip', bytes: 10, mime: 'application/zip' },
    ])).toEqual([
      { path: 'outros/2026/10/a.zip', url: '/files/outros/2026/10/a.zip', nome: 'a.zip', bytes: 10, mime: 'application/zip' },
    ]);
  });

  it('reconstrói a URL quando o registro não tem uma', () => {
    const [anexo] = anexosDoJson([{ path: 'pdf/2026/10/doc.pdf', nome: 'doc.pdf' }]);
    expect(anexo.url).toBe('/files/pdf/2026/10/doc.pdf');
  });

  it('nunca quebra a página com JSON inesperado', () => {
    expect(anexosDoJson(null)).toEqual([]);
    expect(anexosDoJson('texto')).toEqual([]);
    expect(anexosDoJson({})).toEqual([]);
    expect(anexosDoJson([null, 42, { semPath: true }])).toEqual([]);
  });
});

describe('tipos aceitos no anexo (por conteúdo, não por extensão)', () => {
  it('reconhece ZIP (inclusive vazio)', () => {
    expect(detectarTipoPorConteudo(buffer(0x50, 0x4b, 0x03, 0x04))?.extensao).toBe('.zip');
    expect(detectarTipoPorConteudo(buffer(0x50, 0x4b, 0x05, 0x06))?.extensao).toBe('.zip');
  });

  it('reconhece RAR nas duas versões', () => {
    expect(detectarTipoPorConteudo(buffer(0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00))?.extensao).toBe('.rar');
    expect(detectarTipoPorConteudo(
      buffer(0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x01, 0x00),
    )?.extensao).toBe('.rar');
  });

  it('continua reconhecendo PDF e imagem', () => {
    expect(detectarTipoPorConteudo(Buffer.from('%PDF-1.7'))?.extensao).toBe('.pdf');
    expect(detectarTipoPorConteudo(buffer(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))?.extensao).toBe('.png');
  });

  it('recusa o que não está na lista (ex.: SVG, HTML)', () => {
    expect(detectarTipoPorConteudo(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg">'))).toBeNull();
    expect(detectarTipoPorConteudo(Buffer.from('<html><body>oi'))).toBeNull();
    expect(detectarTipoPorConteudo(Buffer.alloc(0))).toBeNull();
  });
});
