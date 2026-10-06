import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { MENSAGENS } from '@/lib/mensagens';
import { fimDoDiaBrasil, formatarDataBrasil } from '@/lib/datas';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .trim();
}

/**
 * Formata datas de prazo/calendário (dataEncerramento, inscricao_fim, etc.).
 *
 * Essas datas são gravadas ao MEIO-DIA no fuso do Brasil (ver
 * src/lib/datas.ts), então exibi-las no fuso do Brasil mostra exatamente o dia
 * que a coordenação digitou — independente do fuso da máquina que roda o
 * servidor (a VPS fica nos EUA, em America/Chicago).
 */
export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  return formatarDataBrasil(date, options);
}

/** Timestamps reais (createdAt, etc.) — também no fuso do Brasil. */
export function formatDateShort(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  return formatarDataBrasil(date, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...options,
  });
}

/** Dias inteiros que faltam até o fim do dia do prazo (inclusive). */
export function getDaysUntil(date: Date | string): number {
  const alvo = typeof date === 'string' ? new Date(date) : date;
  const diff = fimDoDiaBrasil(alvo).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/** Rótulo amigável de qualquer status. Status desconhecido volta como veio. */
export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    // Status de inscrição (minúsculos, vindos do banco)
    recebida: 'Recebida',
    em_analise: 'Em análise',
    selecionado: 'Selecionado',
    lista_espera: 'Lista de espera',
    nao_selecionado: 'Não selecionado',
    desistente: 'Desistente',
    // Status de projeto / edital (maiúsculos)
    EM_BREVE: 'Em breve',
    ABERTO: 'Aberto',
    EM_ANALISE: 'Em análise',
    RESULTADO_PARCIAL: 'Resultado parcial',
    PRAZO_RECURSO: 'Prazo de recurso',
    RESULTADO_PUBLICADO: 'Resultado publicado',
    ENCERRADO: 'Encerrado',
    ATIVO: 'Ativo',
    EM_EXECUCAO: 'Em execução',
    SUSPENSO: 'Suspenso',
    INSCRICOES_ABERTAS: 'Inscrições abertas',
    SEM_VAGAS: 'Sem vagas',
    PRAZO_EDITAL: 'Prazo de edital',
    EVENTO_CAMPUS: 'Evento do campus',
    EVENTO_PROJETO: 'Evento do projeto',
    REUNIAO: 'Reunião',
    PALESTRA: 'Palestra',
    BOLSAS: 'Bolsas',
    AUXILIOS: 'Auxílios',
    EXTENSAO: 'Extensão',
    PESQUISA: 'Pesquisa',
    ENSINO: 'Ensino',
    EVENTOS: 'Eventos',
    ESTAGIOS: 'Estágios',
    RESULTADOS: 'Resultados',
  };
  return labels[status] ?? status;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    EM_BREVE: 'bg-gray-100 text-gray-600 border-gray-200',
    ABERTO: 'bg-green-100 text-green-800 border-green-200',
    EM_ANALISE: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    RESULTADO_PARCIAL: 'bg-blue-100 text-blue-800 border-blue-200',
    PRAZO_RECURSO: 'bg-orange-100 text-orange-800 border-orange-200',
    RESULTADO_PUBLICADO: 'bg-purple-100 text-purple-800 border-purple-200',
    ENCERRADO: 'bg-gray-100 text-gray-600 border-gray-200',
    ATIVO: 'bg-green-100 text-green-800 border-green-200',
    EM_EXECUCAO: 'bg-blue-100 text-blue-800 border-blue-200',
    SUSPENSO: 'bg-red-100 text-red-600 border-red-200',
    INSCRICOES_ABERTAS: 'bg-green-100 text-green-800 border-green-200',
    SEM_VAGAS: 'bg-gray-100 text-gray-600 border-gray-200',
  };
  return colors[status] ?? 'bg-gray-100 text-gray-600';
}

export function getCategoryColor(categoria: string): string {
  const colors: Record<string, string> = {
    BOLSAS: 'bg-yellow-100 text-yellow-800',
    AUXILIOS: 'bg-green-100 text-green-800',
    EXTENSAO: 'bg-blue-100 text-blue-800',
    PESQUISA: 'bg-purple-100 text-purple-800',
    ENSINO: 'bg-indigo-100 text-indigo-800',
    EVENTOS: 'bg-pink-100 text-pink-800',
    ESTAGIOS: 'bg-orange-100 text-orange-800',
    RESULTADOS: 'bg-teal-100 text-teal-800',
  };
  return colors[categoria] ?? 'bg-gray-100 text-gray-600';
}

/**
 * Traduz erros do Prisma para mensagens amigáveis ao usuário.
 *
 * As mensagens vêm do catálogo central (`src/lib/mensagens.ts`) para manter o
 * mesmo tom em todo o portal. Erros que não reconhecemos caem numa mensagem
 * genérica — nunca no texto cru do Prisma, que expõe nomes de tabelas/colunas.
 */
export function translatePrismaError(error: unknown): string {
  const msg = String(error);

  // Erros de constraint/unique
  if (msg.includes('Unique constraint') || msg.includes('unique constraint') || msg.includes('duplicate key')) {
    if (msg.includes('email')) return MENSAGENS.emailJaCadastrado;
    if (msg.includes('slug')) return MENSAGENS.nomeDuplicado;
    if (msg.includes('protocolo')) return MENSAGENS.falhaProtocolo;
    return MENSAGENS.registroJaExiste;
  }

  // Erros de foreign key
  if (msg.includes('Foreign key constraint') || msg.includes('foreign key constraint')) {
    return MENSAGENS.semDadosVinculados;
  }

  // Erros de record not found
  if (msg.includes('Record to delete does not exist') || msg.includes('Record to update does not exist')) {
    return MENSAGENS.registroNaoEncontrado;
  }

  // Erros de conexão
  if (msg.includes('Connection refused') || msg.includes('ECONNREFUSED')) {
    return MENSAGENS.erroConexaoServidor;
  }

  // Erros de timeout
  if (msg.includes('Timeout') || msg.includes('ETIMEDOUT')) {
    return MENSAGENS.tempoEsgotado;
  }

  // Erros de validação do Prisma
  if (msg.includes('Invalid value') || msg.includes('null constraint')) {
    return MENSAGENS.dadosInvalidos;
  }

  // Erro genérico
  return MENSAGENS.erroInesperado;
}
