'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Crop, Image as ImageIcon, Loader2, RotateCcw, X, ZoomIn } from 'lucide-react';

export type TipoMidiaParaRecortar = 'post-capa' | 'projeto-capa' | 'logo';

type Previa = { rotulo: string; proporcao: number };

type Configuracao = {
  titulo: string;
  proporcao: number;
  larguraSaida: number;
  alturaSaida: number;
  dica: string;
  areaSegura: string;
  areaSeguraInset: string;
  /** Faixa da imagem que já é ocupada por texto/logo na tela final. */
  reservaLateral?: { largura: string; rotulo: string };
  previas: Previa[];
};

const CONFIGURACOES: Record<TipoMidiaParaRecortar, Configuracao> = {
  'post-capa': {
    titulo: 'Ajustar capa do post',
    proporcao: 3 / 2,
    larguraSaida: 1200,
    alturaSaida: 800,
    dica:
      'Proporção 3:2 • saída 1200×800 px. Deixe 10% de margem nas laterais e 20% no topo/base. ' +
      'O assunto principal deve ficar no centro.',
    areaSegura: 'Assunto principal no centro',
    areaSeguraInset: '20% 10%',
    previas: [
      { rotulo: 'Home / lista', proporcao: 3 / 2 },
      { rotulo: 'Capa do post', proporcao: 2.33 },
      { rotulo: 'Celular', proporcao: 1.38 },
    ],
  },
  'projeto-capa': {
    titulo: 'Ajustar capa do projeto',
    proporcao: 2,
    larguraSaida: 2400,
    alturaSaida: 1200,
    dica:
      'Proporção 2:1 • saída 2400×1200 px. Posicione o assunto principal à DIREITA: o logo, o título e o status ocupam a faixa esquerda. ' +
      'No celular as laterais são recortadas; evite o canto direito extremo, onde fica a mascote.',
    areaSegura: 'Assunto à direita, livre do texto',
    areaSeguraInset: '18% 14% 18% 52%',
    reservaLateral: { largura: '50%', rotulo: 'Logo + título + status' },
    previas: [
      { rotulo: 'Desktop', proporcao: 4.44 },
      { rotulo: 'Celular', proporcao: 1.23 },
    ],
  },
  logo: {
    titulo: 'Ajustar logo do projeto',
    proporcao: 1,
    larguraSaida: 512,
    alturaSaida: 512,
    dica:
      'Proporção 1:1 • saída 512×512 px. Use PNG ou WebP com fundo transparente e deixe cerca de 10% de margem.',
    areaSegura: 'Símbolo centralizado',
    areaSeguraInset: '10%',
    previas: [{ rotulo: 'Card / cabeçalho', proporcao: 1 }],
  },
};

function clamp(valor: number, minimo: number, maximo: number) {
  return Math.max(minimo, Math.min(maximo, valor));
}

export function EditorDeImagem({
  arquivo,
  tipo,
  onCancelar,
  onConfirmar,
}: {
  arquivo: File;
  tipo: TipoMidiaParaRecortar;
  onCancelar: () => void;
  onConfirmar: (arquivo: File) => void | Promise<void>;
}) {
  const config = CONFIGURACOES[tipo];
  const [imagem, setImagem] = useState<HTMLImageElement | null>(null);
  const [tamanhoMoldura, setTamanhoMoldura] = useState({ largura: 0, altura: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [arrastando, setArrastando] = useState(false);
  const [origemArraste, setOrigemArraste] = useState({ x: 0, y: 0 });
  const [previa, setPrevia] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const molduraRef = useRef<HTMLDivElement>(null);
  const urlLocalRef = useRef<string>('');

  // Carrega o arquivo escolhido e revoga a URL ao fechar.
  useEffect(() => {
    const url = URL.createObjectURL(arquivo);
    urlLocalRef.current = url;
    const img = new Image();
    img.onload = () => {
      setImagem(img);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setErro('');
    };
    img.onerror = () => setErro('Não conseguimos abrir esta imagem. Escolha um PNG, JPG, WebP ou GIF.');
    img.src = url;

    return () => {
      URL.revokeObjectURL(url);
      urlLocalRef.current = '';
    };
  }, [arquivo]);

  // Mantém o recorte sincronizado com o tamanho real da moldura (responsivo).
  useEffect(() => {
    const moldura = molduraRef.current;
    if (!moldura) return;
    const medir = () => {
      const r = moldura.getBoundingClientRect();
      setTamanhoMoldura({ largura: r.width, altura: r.height });
    };
    medir();
    const observer = new ResizeObserver(medir);
    observer.observe(moldura);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflowAnterior; };
  }, []);

  const escalaBase =
    imagem && tamanhoMoldura.largura > 0
      ? Math.max(
          tamanhoMoldura.largura / imagem.naturalWidth,
          tamanhoMoldura.altura / imagem.naturalHeight,
        )
      : 1;
  const escalaTotal = escalaBase * zoom;
  const larguraExibida = imagem ? imagem.naturalWidth * escalaTotal : 0;
  const alturaExibida = imagem ? imagem.naturalHeight * escalaTotal : 0;
  const maxOffsetX = Math.max(0, (larguraExibida - tamanhoMoldura.largura) / 2);
  const maxOffsetY = Math.max(0, (alturaExibida - tamanhoMoldura.altura) / 2);

  useEffect(() => {
    setOffset((atual) => ({
      x: clamp(atual.x, -maxOffsetX, maxOffsetX),
      y: clamp(atual.y, -maxOffsetY, maxOffsetY),
    }));
  }, [maxOffsetX, maxOffsetY]);

  const desenharRecorte = useCallback(
    (canvas: HTMLCanvasElement, larguraSaida: number, alturaSaida: number) => {
      if (!imagem || tamanhoMoldura.largura === 0) return false;
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;

      const total = escalaBase * zoom;
      const largura = imagem.naturalWidth * total;
      const altura = imagem.naturalHeight * total;
      const esquerda = (tamanhoMoldura.largura - largura) / 2 + offset.x;
      const topo = (tamanhoMoldura.altura - altura) / 2 + offset.y;
      const origemX = clamp(-esquerda / total, 0, Math.max(0, imagem.naturalWidth - tamanhoMoldura.largura / total));
      const origemY = clamp(-topo / total, 0, Math.max(0, imagem.naturalHeight - tamanhoMoldura.altura / total));
      const larguraOrigem = Math.min(imagem.naturalWidth - origemX, tamanhoMoldura.largura / total);
      const alturaOrigem = Math.min(imagem.naturalHeight - origemY, tamanhoMoldura.altura / total);

      canvas.width = larguraSaida;
      canvas.height = alturaSaida;
      ctx.clearRect(0, 0, larguraSaida, alturaSaida);
      ctx.drawImage(imagem, origemX, origemY, larguraOrigem, alturaOrigem, 0, 0, larguraSaida, alturaSaida);
      return true;
    },
    [imagem, tamanhoMoldura, escalaBase, zoom, offset],
  );

  // Prévia em baixa resolução para as molduras de desktop/celular.
  useEffect(() => {
    if (!imagem || tamanhoMoldura.largura === 0) return;
    const canvas = document.createElement('canvas');
    const ok = desenharRecorte(canvas, 900, Math.round(900 / config.proporcao));
    if (ok) setPrevia(canvas.toDataURL('image/jpeg', 0.82));
  }, [imagem, tamanhoMoldura, desenharRecorte, config.proporcao]);

  const iniciarArraste = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!imagem) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setArrastando(true);
    setOrigemArraste({ x: e.clientX, y: e.clientY });
  };

  const moverArraste = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!arrastando) return;
    const dx = e.clientX - origemArraste.x;
    const dy = e.clientY - origemArraste.y;
    setOrigemArraste({ x: e.clientX, y: e.clientY });
    setOffset((atual) => ({
      x: clamp(atual.x + dx, -maxOffsetX, maxOffsetX),
      y: clamp(atual.y + dy, -maxOffsetY, maxOffsetY),
    }));
  };

  const soltarArraste = (e: React.PointerEvent<HTMLDivElement>) => {
    setArrastando(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const confirmar = async () => {
    if (!imagem) return;
    setSalvando(true);
    setErro('');
    try {
      const canvas = document.createElement('canvas');
      const ok = desenharRecorte(canvas, config.larguraSaida, config.alturaSaida);
      if (!ok) throw new Error('recorte');
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.9));
      if (!blob) throw new Error('blob');
      const nomeBase = arquivo.name.replace(/\.[^.]+$/, '') || 'imagem';
      const nome = `${nomeBase}-${tipo}.webp`;
      await onConfirmar(new File([blob], nome, { type: 'image/webp' }));
    } catch {
      setErro('Não conseguimos preparar a imagem. Tente novamente com outro arquivo.');
    } finally {
      setSalvando(false);
    }
  };

  const largura = Math.max(0, tamanhoMoldura.largura);
  const altura = Math.max(0, tamanhoMoldura.altura);
  const esquerdaImagem = (largura - larguraExibida) / 2 + offset.x;
  const topoImagem = (altura - alturaExibida) / 2 + offset.y;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-editor-imagem">
      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 id="titulo-editor-imagem" className="flex items-center gap-2 text-base font-bold text-gray-900">
              <Crop className="h-4 w-4 text-azul-eletrico" />
              {config.titulo}
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">Arraste a imagem e use o zoom para enquadrar.</p>
          </div>
          <button type="button" onClick={onCancelar} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
            <div>
              <div
                ref={molduraRef}
                className="relative mx-auto w-full max-w-[460px] cursor-grab touch-none overflow-hidden rounded-xl border border-gray-200 bg-gray-900 active:cursor-grabbing"
                style={{ aspectRatio: String(config.proporcao), maxHeight: '52vh' }}
                onPointerDown={iniciarArraste}
                onPointerMove={moverArraste}
                onPointerUp={soltarArraste}
                onPointerCancel={soltarArraste}
              >
                {imagem ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imagem.src}
                    alt="Imagem para recortar"
                    draggable={false}
                    className="pointer-events-none absolute max-w-none select-none"
                    style={{
                      width: larguraExibida,
                      height: alturaExibida,
                      left: esquerdaImagem,
                      top: topoImagem,
                    }}
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/60">
                    <ImageIcon className="h-8 w-8" />
                    <span className="text-xs">Carregando imagem…</span>
                  </div>
                )}
                {/* Faixa que o layout real reserva para logo/título/status. */}
                {config.reservaLateral && (
                  <div
                    className="pointer-events-none absolute inset-y-0 left-0 bg-gradient-to-r from-black/55 via-black/20 to-transparent"
                    style={{ width: config.reservaLateral.largura }}
                  >
                    <span className="absolute bottom-2 left-2 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      {config.reservaLateral.rotulo}
                    </span>
                  </div>
                )}
                {/* Guia de área segura */}
                <div className="pointer-events-none absolute rounded border border-dashed border-white/80" style={{ inset: config.areaSeguraInset }}>
                  <span className="absolute left-2 top-2 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white">
                    {config.areaSegura}
                  </span>
                </div>
              </div>

              <div className="mx-auto mt-4 flex w-full max-w-[460px] items-center gap-3">
                <ZoomIn className="h-4 w-4 flex-shrink-0 text-gray-400" />
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="h-2 w-full cursor-pointer accent-azul-eletrico"
                  aria-label="Zoom da imagem"
                />
                <button
                  type="button"
                  onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }}
                  className="inline-flex flex-shrink-0 items-center gap-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Centralizar
                </button>
              </div>

              <p className="mx-auto mt-3 max-w-[460px] rounded-lg bg-gray-50 p-3 text-xs leading-relaxed text-gray-600">
                {config.dica}
              </p>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-bold text-gray-900">Como vai aparecer</h3>
              <div className="space-y-3">
                {config.previas.map((item) => (
                  <div key={item.rotulo}>
                    <p className="mb-1 text-xs font-medium text-gray-500">{item.rotulo}</p>
                    <div
                      className="relative overflow-hidden rounded-xl border border-gray-200 bg-gray-100"
                      style={{
                        aspectRatio: String(item.proporcao),
                        backgroundImage: previa ? `url("${previa}")` : undefined,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }}
                    >
                      {config.reservaLateral && (
                        <div
                          className="pointer-events-none absolute inset-y-0 left-0 bg-gradient-to-r from-black/65 via-black/30 to-transparent p-2"
                          style={{ width: '58%' }}
                        >
                          <div className="mb-1.5 h-4 w-4 rounded bg-white/80" />
                          <div className="h-1.5 w-3/4 rounded bg-white/90" />
                          <div className="mt-1 h-1 w-1/2 rounded bg-white/60" />
                          <p className="absolute bottom-1.5 left-2 text-[9px] font-medium text-white/90">
                            Texto e logo
                          </p>
                        </div>
                      )}
                      {!previa && (
                        <div className="flex h-full items-center justify-center text-xs text-gray-400">
                          Gerando prévia…
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {erro && <p className="mt-4 rounded-lg border border-red-100 bg-red-50 p-2 text-xs text-red-700">{erro}</p>}
        </div>

        <div className="flex flex-shrink-0 gap-3 border-t border-gray-100 p-4">
          <button
            type="button"
            onClick={onCancelar}
            disabled={salvando}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={salvando || !imagem}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-azul-eletrico py-2.5 text-sm font-semibold text-white hover:bg-azul-eletrico/90 disabled:opacity-60"
          >
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {salvando ? 'Preparando…' : 'Usar esta imagem'}
          </button>
        </div>
      </div>
    </div>
  );
}
