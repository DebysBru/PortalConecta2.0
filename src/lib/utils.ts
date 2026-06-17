import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

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

export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    ...options,
  });
}

export function formatDateShort(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function getDaysUntil(date: Date | string): number {
  const target = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffTime = target.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    EM_BREVE: 'Em breve',
    ABERTO: 'Aberto',
    EM_ANALISE: 'Em análise',
    RESULTADO_PARCIAL: 'Resultado parcial',
    PRAZO_RECURSO: 'Prazo recurso',
    RESULTADO_PUBLICADO: 'Resultado publicado',
    ENCERRADO: 'Encerrado',
    ATIVO: 'Ativo',
    EM_EXECUCAO: 'Em execução',
    SUSPENSO: 'Suspenso',
    INSCRICOES_ABERTAS: 'Inscrições abertas',
    SEM_VAGAS: 'Sem vagas',
    PRAZO_EDITAL: 'Prazo Edital',
    EVENTO_CAMPUS: 'Evento Campus',
    EVENTO_PROJETO: 'Evento Projeto',
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
