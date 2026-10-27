/**
 * Capa do post: imagem enviada OU um ícone do catálogo nativo.
 *
 * POR QUE EXISTE: o card de "Últimas Atualizações" só sabia mostrar `imagemUrl` —
 * e o formulário do professor não tinha campo de imagem nenhum, então todo post
 * criado por ele caía no quadrado cinza vazio. Além disso, nem toda publicação
 * tem foto: "Seleção de bolsistas realizada" é um aviso, e um ícone com
 * significado comunica melhor do que um retângulo vazio.
 *
 * O catálogo é FECHADO (chaves conhecidas, aqui no código) por dois motivos:
 *  1. o servidor valida a chave — ninguém grava um identificador inventado;
 *  2. as classes do Tailwind são escritas por extenso em cada item, porque classe
 *     montada em tempo de execução não entra no CSS gerado.
 *
 * Este arquivo é puro (só importa ícones), então serve tanto para o servidor
 * (validar) quanto para os componentes (renderizar e escolher).
 */
import {
  AlarmClock, CalendarDays, ClipboardList, FileText, FlaskConical,
  GraduationCap, Megaphone, Newspaper, Trophy, UserCheck, Users,
  type LucideIcon,
} from 'lucide-react';

export type ChaveIconePost =
  | 'aviso'
  | 'inscricoes'
  | 'selecao'
  | 'prazo'
  | 'evento'
  | 'formacao'
  | 'reuniao'
  | 'atividade'
  | 'conquista'
  | 'documento';

/** Aparência de um ícone de capa — o que o componente precisa para desenhar. */
export type AparenciaDeIcone = {
  rotulo: string;
  descricao: string;
  Icone: LucideIcon;
  /** Classe de fundo (escrita por extenso — ver comentário acima). */
  fundo: string;
  /** Classe da cor do ícone. */
  cor: string;
};

export type IconeDePost = AparenciaDeIcone & { chave: ChaveIconePost };

export const ICONES_DE_POST: readonly IconeDePost[] = [
  {
    chave: 'aviso',
    rotulo: 'Aviso',
    descricao: 'Comunicado rápido para o projeto',
    Icone: Megaphone,
    fundo: 'bg-amber-100',
    cor: 'text-amber-700',
  },
  {
    chave: 'inscricoes',
    rotulo: 'Inscrições abertas',
    descricao: 'Chamada para se inscrever nas vagas',
    Icone: ClipboardList,
    fundo: 'bg-blue-100',
    cor: 'text-azul-eletrico',
  },
  {
    chave: 'selecao',
    rotulo: 'Seleção / resultado',
    descricao: 'Lista de selecionados, convocação',
    Icone: UserCheck,
    fundo: 'bg-emerald-100',
    cor: 'text-emerald-700',
  },
  {
    chave: 'prazo',
    rotulo: 'Prazo',
    descricao: 'Data limite, entrega, recurso',
    Icone: AlarmClock,
    fundo: 'bg-rose-100',
    cor: 'text-rose-700',
  },
  {
    chave: 'evento',
    rotulo: 'Evento',
    descricao: 'Encontro, mostra, palestra, visita',
    Icone: CalendarDays,
    fundo: 'bg-violet-100',
    cor: 'text-roxo-luminoso',
  },
  {
    chave: 'formacao',
    rotulo: 'Formação',
    descricao: 'Oficina, curso, capacitação',
    Icone: GraduationCap,
    fundo: 'bg-cyan-100',
    cor: 'text-ciano-claro',
  },
  {
    chave: 'reuniao',
    rotulo: 'Reunião',
    descricao: 'Encontro da equipe ou com a comunidade',
    Icone: Users,
    fundo: 'bg-indigo-100',
    cor: 'text-indigo-700',
  },
  {
    chave: 'atividade',
    rotulo: 'Atividade do projeto',
    descricao: 'Bastidores, experimento, produção',
    Icone: FlaskConical,
    fundo: 'bg-teal-100',
    cor: 'text-teal-700',
  },
  {
    chave: 'conquista',
    rotulo: 'Conquista',
    descricao: 'Premiação, destaque, meta atingida',
    Icone: Trophy,
    fundo: 'bg-yellow-100',
    cor: 'text-yellow-700',
  },
  {
    chave: 'documento',
    rotulo: 'Documento',
    descricao: 'Edital, regulamento, formulário',
    Icone: FileText,
    fundo: 'bg-slate-100',
    cor: 'text-slate-600',
  },
];

/**
 * Capa padrão: post sem imagem e sem ícone escolhido.
 * Existe para o card NUNCA ficar com um retângulo vazio (era o que aparecia na
 * tela de "Últimas Atualizações" antes desta mudança).
 */
export const ICONE_PADRAO: AparenciaDeIcone = {
  rotulo: 'Publicação',
  descricao: 'Sem capa escolhida',
  Icone: Newspaper,
  fundo: 'bg-gray-50',
  cor: 'text-gray-400',
};

const POR_CHAVE: Record<string, IconeDePost> = Object.fromEntries(
  ICONES_DE_POST.map((i) => [i.chave, i]),
);

export function chaveDeIconeValida(valor: unknown): valor is ChaveIconePost {
  return typeof valor === 'string' && Object.prototype.hasOwnProperty.call(POR_CHAVE, valor);
}

/** Devolve o ícone da chave (ou o padrão) — nunca `undefined`, nunca lança. */
export function iconeDaChave(chave: string | null | undefined): AparenciaDeIcone {
  return (chave && POR_CHAVE[chave]) || ICONE_PADRAO;
}

export type CapaDoPost =
  | { tipo: 'imagem'; url: string }
  | { tipo: 'icone'; icone: AparenciaDeIcone; chave: ChaveIconePost | null };

/**
 * Decide o que mostrar como capa. A IMAGEM tem precedência sobre o ícone: se o
 * professor enviou uma foto, é ela que aparece (o ícone continua guardado, caso
 * ele remova a foto depois).
 */
export function capaDoPost(post: {
  imagemUrl?: string | null;
  icone?: string | null;
}): CapaDoPost {
  const url = typeof post.imagemUrl === 'string' ? post.imagemUrl.trim() : '';
  if (url) return { tipo: 'imagem', url };

  const icone = iconeDaChave(post.icone);
  return { tipo: 'icone', icone, chave: chaveDeIconeValida(post.icone) ? post.icone : null };
}

/** `true` quando o post usa a capa padrão (nem imagem, nem ícone escolhido). */
export function semCapaEscolhida(post: {
  imagemUrl?: string | null;
  icone?: string | null;
}): boolean {
  const temImagem = typeof post.imagemUrl === 'string' && post.imagemUrl.trim().length > 0;
  return !temImagem && !chaveDeIconeValida(post.icone);
}

const HOSTS_DE_PAGINA_SOCIAL =
  /(^|\.)(instagram\.com|facebook\.com|tiktok\.com|youtube\.com|youtu\.be|twitter\.com|x\.com)$/i;
const EXTENSAO_DE_IMAGEM = /\.(png|jpe?g|webp|gif|avif|svg)$/i;

/**
 * Impede usar o link de uma PUBLICAÇÃO social como capa.
 *
 * Caso real: o campo aceitava qualquer URL e alguém colou
 * `https://www.instagram.com/p/...` como imagem de capa. O navegador recebe
 * HTML, não imagem, e o card fica com o ícone de imagem quebrada. O link do
 * post não é uma imagem — quem quiser usar a foto precisa enviar o arquivo ou
 * colar a URL direta do CDN.
 */
export function erroDeUrlDeCapa(imagemUrl: unknown): string | null {
  const valor = typeof imagemUrl === 'string' ? imagemUrl.trim() : '';
  if (!valor) return null;
  if (valor.startsWith('/') && !valor.startsWith('//')) return null;

  let url: URL;
  try {
    url = new URL(valor);
  } catch {
    return null; // outras validações já rejeitam URL malformada
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  if (HOSTS_DE_PAGINA_SOCIAL.test(url.hostname) && !EXTENSAO_DE_IMAGEM.test(url.pathname)) {
    return 'Esse link é de uma publicação em rede social, não de uma imagem. Envie a imagem ou cole a URL direta do arquivo.';
  }

  return null;
}
