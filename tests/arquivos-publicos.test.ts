import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdir, writeFile, unlink, rm } from 'node:fs/promises';
import { join } from 'node:path';
import {
  STORAGE_ROOT,
  caminhoAbsolutoPublico,
  extensaoPublicaPermitida,
  forcarDownloadDoArquivoPublico,
  mimeDoArquivoPublico,
} from '@/lib/file-storage';
import { GET } from '@/app/files/[...caminho]/route';

/**
 * Serviço dos arquivos enviados (`/files/...`).
 *
 * Contexto real: o nginx serve essa pasta em produção, mas NADA servia fora dele —
 * no `npm run dev` toda imagem enviada aparecia quebrada, com o arquivo íntegro
 * no disco. A rota do Next cobre esse caso (e o nginx, quando existe, continua
 * atendendo antes).
 *
 * O que estes testes travam:
 *  - o arquivo sai com o MIME certo e o conteúdo idêntico ao do disco;
 *  - PDF/ZIP/RAR saem como download; imagem não;
 *  - caminho fora da pasta ou extensão não permitida → 404 (nunca 200).
 */

const PASTA_FIXTURE = join(STORAGE_ROOT, 'imagens', '2026', '10', 'teste-rota-publica');

async function chamarRota(caminho: string[]) {
  // O handler ignora a request (não usa headers/query); só `params` importa.
  return GET({} as never, { params: { caminho } });
}

beforeAll(async () => {
  await mkdir(PASTA_FIXTURE, { recursive: true });
  await writeFile(join(PASTA_FIXTURE, 'foto.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x01, 0x02, 0x03]));
  await writeFile(join(PASTA_FIXTURE, 'documento.pdf'), Buffer.from('%PDF-1.7 conteudo de teste'));
  await writeFile(join(PASTA_FIXTURE, 'pacote.zip'), Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]));
});

afterAll(async () => {
  await rm(join(STORAGE_ROOT, 'imagens', '2026', '10', 'teste-rota-publica'), { recursive: true, force: true });
  await unlink(join(STORAGE_ROOT, 'imagens', '2026', '10', 'teste-rota-publica')).catch(() => {});
});

describe('tipo e forma de entrega por extensão', () => {
  it('reconhece os tipos que o storage grava', () => {
    expect(mimeDoArquivoPublico('a/b/foto.png')).toBe('image/png');
    expect(mimeDoArquivoPublico('a/foto.JPG')).toBe('image/jpeg');
    expect(mimeDoArquivoPublico('a/foto.jpeg')).toBe('image/jpeg');
    expect(mimeDoArquivoPublico('a/foto.webp')).toBe('image/webp');
    expect(mimeDoArquivoPublico('a/foto.gif')).toBe('image/gif');
    expect(mimeDoArquivoPublico('a/doc.pdf')).toBe('application/pdf');
    expect(mimeDoArquivoPublico('a/pacote.zip')).toBe('application/zip');
    expect(mimeDoArquivoPublico('a/pacote.rar')).toBe('application/vnd.rar');
  });

  it('o que não conhece sai como binário genérico', () => {
    expect(mimeDoArquivoPublico('a/arquivo.xyz')).toBe('application/octet-stream');
  });

  it('PDF, ZIP e RAR são download; imagem abre no navegador', () => {
    expect(forcarDownloadDoArquivoPublico('a/doc.pdf')).toBe(true);
    expect(forcarDownloadDoArquivoPublico('a/pacote.ZIP')).toBe(true);
    expect(forcarDownloadDoArquivoPublico('a/pacote.rar')).toBe(true);
    expect(forcarDownloadDoArquivoPublico('a/foto.png')).toBe(false);
    expect(forcarDownloadDoArquivoPublico('a/foto.gif')).toBe(false);
  });

  it('a whitelist de extensões é fechada', () => {
    for (const ok of ['a.png', 'a.jpg', 'a.jpeg', 'a.webp', 'a.gif', 'a.pdf', 'a.zip', 'a.rar']) {
      expect(extensaoPublicaPermitida(ok)).toBe(true);
    }
    for (const nao of ['a.svg', 'a.html', 'a.js', 'a.php', 'a.txt', 'a.env', 'semextensao']) {
      expect(extensaoPublicaPermitida(nao)).toBe(false);
    }
  });
});

describe('validação do caminho', () => {
  it('aceita caminho relativo dentro da raiz', () => {
    const absoluto = caminhoAbsolutoPublico('imagens/2026/10/foto.png');
    expect(absoluto).toBeTruthy();
    expect(absoluto!.startsWith(STORAGE_ROOT)).toBe(true);
  });

  it('recusa travessia de diretório e caminho absoluto', () => {
    expect(caminhoAbsolutoPublico('../../etc/passwd')).toBeNull();
    expect(caminhoAbsolutoPublico('imagens/../../../.env')).toBeNull();
    expect(caminhoAbsolutoPublico('imagens/%2e%2e/%2e%2e/.env')).toBeNull();
    expect(caminhoAbsolutoPublico('/etc/passwd')).toBeNull();
    expect(caminhoAbsolutoPublico('')).toBeNull();
    expect(caminhoAbsolutoPublico(null)).toBeNull();
  });

  it('recusa extensão fora da whitelist, mesmo com caminho válido', () => {
    expect(caminhoAbsolutoPublico('imagens/2026/10/script.js')).toBeNull();
    expect(caminhoAbsolutoPublico('imagens/2026/10/pagina.html')).toBeNull();
  });

  it('recusa percent-encoding inválido em vez de estourar', () => {
    expect(caminhoAbsolutoPublico('imagens/%ZZ/foto.png')).toBeNull();
  });
});

describe('GET /files/[...caminho]', () => {
  it('serve a imagem com o conteúdo do disco', async () => {
    const resposta = await chamarRota(['imagens', '2026', '10', 'teste-rota-publica', 'foto.png']);

    expect(resposta.status).toBe(200);
    expect(resposta.headers.get('content-type')).toBe('image/png');
    expect(resposta.headers.get('x-content-type-options')).toBe('nosniff');
    expect(resposta.headers.get('cache-control')).toContain('max-age=604800');
    expect(resposta.headers.get('content-disposition')).toBeNull();

    const bytes = new Uint8Array(await resposta.arrayBuffer());
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it('serve PDF e ZIP como download', async () => {
    const pdf = await chamarRota(['imagens', '2026', '10', 'teste-rota-publica', 'documento.pdf']);
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get('content-type')).toBe('application/pdf');
    expect(pdf.headers.get('content-disposition')).toBe('attachment');

    const zip = await chamarRota(['imagens', '2026', '10', 'teste-rota-publica', 'pacote.zip']);
    expect(zip.status).toBe(200);
    expect(zip.headers.get('content-type')).toBe('application/zip');
    expect(zip.headers.get('content-disposition')).toBe('attachment');
  });

  it('arquivo que não existe dá 404', async () => {
    const resposta = await chamarRota(['imagens', '2026', '10', 'teste-rota-publica', 'sumiu.png']);
    expect(resposta.status).toBe(404);
  });

  it('travessia de diretório dá 404', async () => {
    const resposta = await chamarRota(['..', '..', '.env']);
    expect(resposta.status).toBe(404);
  });

  it('extensão não permitida dá 404', async () => {
    const resposta = await chamarRota(['imagens', '2026', '10', 'teste-rota-publica', 'anotacoes.txt']);
    expect(resposta.status).toBe(404);
  });
});
