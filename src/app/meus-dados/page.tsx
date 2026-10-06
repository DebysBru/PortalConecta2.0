'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  User, Download, AlertCircle, ChevronRight, FileText, CheckCircle, XCircle,
  Trash2, GraduationCap, Save, Bell, BellRing, CheckCheck, Check, Loader2,
  ThumbsUp, ThumbsDown, Ban, CalendarDays,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { PageHero } from '@/components/layout/PageHero';
import { getMinhasInscricoes, exportMinhasInscricoesCSV, solicitarExclusaoDados } from '@/actions/meus-dados';
import { getMeuPerfilAluno, updateMeuPerfilAluno, type PerfilAlunoFormData } from '@/actions/perfil';
import { desistirDaInscricao, responderConvocacao } from '@/actions/minhas-inscricoes';
import {
  listarMinhasNotificacoes, marcarNotificacaoLida, marcarTodasNotificacoesLidas,
  type NotificacaoItem,
} from '@/actions/notificacoes';
import { formatDateShort } from '@/lib/utils';
import { mensagemDeErroServidor } from '@/lib/mensagens';
import {
  GRUPOS_CURSOS, TODOS_OS_CURSOS, SEMESTRES, anosDeIngresso, ehSemestreValido,
  fonteDeLegado, fonteDePerfil, mesclarFontesAcademicas, periodoLetivoLegivel,
  rotuloSemestre, semestreAtual,
} from '@/lib/perfil-academico';
import { podeDesistir, podeResponderConvocacao, rotuloRespostaAluno } from '@/lib/inscricao-aluno';
import { formatarTempoRelativo } from '@/lib/minha-area';

type Inscricao = Awaited<ReturnType<typeof getMinhasInscricoes>>[number];
type PerfilAluno = Awaited<ReturnType<typeof getMeuPerfilAluno>>;

const STATUS_COLORS: Record<string, string> = {
  recebida: 'bg-gray-100 text-gray-700',
  em_analise: 'bg-yellow-100 text-yellow-700',
  selecionado: 'bg-green-100 text-green-700',
  lista_espera: 'bg-blue-100 text-blue-700',
  nao_selecionado: 'bg-red-100 text-red-700',
  desistente: 'bg-orange-100 text-orange-700',
};

const ROTULO_STATUS: Record<string, string> = {
  recebida: 'Recebida',
  em_analise: 'Em análise',
  selecionado: 'Selecionado',
  lista_espera: 'Lista de espera',
  nao_selecionado: 'Não selecionado',
  desistente: 'Desistente',
};

/** Confirmação pendente: agir sobre uma inscrição é irreversível pelo aluno. */
type Confirmacao =
  | { tipo: 'desistir'; inscricao: Inscricao }
  | { tipo: 'recusar'; inscricao: Inscricao }
  | null;

export default function MeusDadosPage() {
  const { user, loading: authCarregando } = useAuth();
  const [inscricoes, setInscricoes] = useState<Inscricao[]>([]);
  const [notificacoes, setNotificacoes] = useState<NotificacaoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showExclusao, setShowExclusao] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [excluindo, setExcluindo] = useState(false);
  const [sucesso, setSucesso] = useState('');

  const [perfil, setPerfil] = useState<PerfilAluno>(null);
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  const [perfilSucesso, setPerfilSucesso] = useState('');
  const [perfilErro, setPerfilErro] = useState('');

  // Ações sobre as inscrições (desistir / responder convocação)
  const [confirmacao, setConfirmacao] = useState<Confirmacao>(null);
  const [motivoDesistencia, setMotivoDesistencia] = useState('');
  const [processandoId, setProcessandoId] = useState<string | null>(null);
  const [acaoSucesso, setAcaoSucesso] = useState('');
  const [acaoErro, setAcaoErro] = useState('');

  const carregarInscricoes = useCallback(async (idToken: string) => {
    const atualizadas = await getMinhasInscricoes(idToken);
    setInscricoes(atualizadas);
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelado = false;

    user.getIdToken().then(async (idToken) => {
      // Tudo em paralelo e só sai do "carregando" quando o PERFIL também chegou:
      // o formulário usa `defaultValue`, então renderizá-lo antes do perfil
      // chegar deixaria os campos vazios para sempre.
      const [listaInscricoes, perfilCarregado, avisos] = await Promise.all([
        getMinhasInscricoes(idToken).catch(() => [] as Inscricao[]),
        getMeuPerfilAluno(idToken).catch(() => null),
        listarMinhasNotificacoes(idToken).catch(() => [] as NotificacaoItem[]),
      ]);
      if (cancelado) return;
      setInscricoes(listaInscricoes);
      setPerfil(perfilCarregado);
      setNotificacoes(avisos);
      setLoading(false);
    });

    return () => { cancelado = true; };
  }, [user]);

  // Dados acadêmicos do perfil, já com o fallback das colunas antigas
  // (turma/"2024.5") e o semestre AVANÇADO até hoje.
  const dadosAcademicos = useMemo(
    () => mesclarFontesAcademicas(fonteDePerfil(perfil), fonteDeLegado(perfil)),
    [perfil],
  );
  const semestreAtualDoAluno = semestreAtual(
    dadosAcademicos.semestre,
    dadosAcademicos.semestreReferencia,
  );

  const handleSalvarPerfil = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    setPerfilSucesso('');
    setPerfilErro('');

    const form = new FormData(e.currentTarget);
    const anoIngresso = form.get('anoIngresso') as string;
    const semestre = form.get('semestreAtual') as string;

    const data: PerfilAlunoFormData = {
      telefone: form.get('telefone') as string,
      curso: form.get('curso') as string,
      anoIngresso: anoIngresso ? Number(anoIngresso) : null,
      semestreAtual: semestre ? Number(semestre) : null,
      matricula: form.get('matricula') as string,
      experienciasPrevias: form.get('experienciasPrevias') as string,
      areasInteresse: (form.get('areasInteresse') as string).split(',').map((s) => s.trim()).filter(Boolean),
      habilidades: (form.get('habilidades') as string).split(',').map((s) => s.trim()).filter(Boolean),
      curriculoLattes: form.get('curriculoLattes') as string,
    };

    setSalvandoPerfil(true);
    const idToken = await user.getIdToken();
    const result = await updateMeuPerfilAluno(idToken, data);
    setSalvandoPerfil(false);

    if (result.ok) {
      setPerfilSucesso('Perfil atualizado! Esses dados já vêm preenchidos nas suas próximas inscrições.');
      const atualizado = await getMeuPerfilAluno(idToken);
      setPerfil(atualizado);
    } else {
      setPerfilErro(mensagemDeErroServidor(result.error, 'Não conseguimos salvar seu perfil agora. Confira os dados e tente novamente.'));
    }
  };

  const handleExport = async () => {
    if (!user) return;
    const idToken = await user.getIdToken();
    const csv = await exportMinhasInscricoesCSV(idToken);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `minhas-inscricoes-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExclusao = async () => {
    if (!user) return;
    setExcluindo(true);
    try {
      const idToken = await user.getIdToken();
      const result = await solicitarExclusaoDados(idToken, motivo);
      if (result.ok) {
        setSucesso(
          `Pronto: ${result.count === 1 ? '1 inscrição foi marcada' : `${result.count} inscrições foram marcadas`} como desistente, e seus dados pessoais foram anonimizados.`
        );
        setShowExclusao(false);
        setMotivo('');
        // Recarregar lista
        await carregarInscricoes(idToken);
      } else {
        // Erro ao solicitar a exclusão: mantém a janela aberta para nova
        // tentativa, sem sucesso antigo na tela.
        setSucesso('');
      }
    } finally {
      setExcluindo(false);
    }
  };

  /**
   * Executa uma ação do aluno sobre a inscrição. O servidor revalida tudo
   * (posse + transição válida) — aqui só cuidamos do estado da tela; quando ele
   * recusa, mostramos o motivo real em vez de um "erro" genérico.
   */
  const executarAcao = async (
    inscricao: Inscricao,
    acao: () => Promise<{ ok: true; status: string; respostaAluno: string | null } | { ok: false; error: string }>,
    mensagemSucesso: string,
  ) => {
    if (!user) return;
    setProcessandoId(inscricao.id);
    setAcaoErro('');
    setAcaoSucesso('');

    try {
      const resultado = await acao();
      if (!resultado.ok) {
        setAcaoErro(mensagemDeErroServidor(resultado.error, 'Não conseguimos concluir esta ação agora. Tente novamente.'));
        return;
      }

      setInscricoes((prev) =>
        prev.map((i) =>
          i.id === inscricao.id
            ? { ...i, status: resultado.status, resposta_aluno: resultado.respostaAluno }
            : i,
        ),
      );
      setAcaoSucesso(mensagemSucesso);
      setConfirmacao(null);
      setMotivoDesistencia('');

      // A coordenação já foi avisada pelo servidor; recarregamos do banco para
      // trazer carimbos de data (desistiu_em / respondido_em) sem duplicar regra.
      const idToken = await user.getIdToken();
      await carregarInscricoes(idToken);
    } finally {
      setProcessandoId(null);
    }
  };

  const handleDesistir = (inscricao: Inscricao) =>
    executarAcao(
      inscricao,
      async () => {
        const idToken = await user!.getIdToken();
        return desistirDaInscricao(idToken, inscricao.id, motivoDesistencia);
      },
      `Pronto: sua inscrição em "${inscricao.projeto.nome}" foi cancelada e a coordenação foi avisada.`,
    );

  const handleResponder = (inscricao: Inscricao, resposta: 'aceito' | 'recusado') =>
    executarAcao(
      inscricao,
      async () => {
        const idToken = await user!.getIdToken();
        return responderConvocacao(idToken, inscricao.id, resposta);
      },
      resposta === 'aceito'
        ? `Você aceitou a convocação de "${inscricao.projeto.nome}". A coordenação foi avisada.`
        : `Você recusou a convocação de "${inscricao.projeto.nome}". A vaga volta a ficar disponível.`,
    );

  const marcarAvisoLido = async (id: string) => {
    if (!user) return;
    const idToken = await user.getIdToken();
    await marcarNotificacaoLida(idToken, id);
    setNotificacoes((prev) => prev.map((n) => (n.id === id ? { ...n, lida: true } : n)));
  };

  const marcarTodosAvisosLidos = async () => {
    if (!user) return;
    const idToken = await user.getIdToken();
    await marcarTodasNotificacoesLidas(idToken);
    setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })));
  };

  if (authCarregando || (user && loading)) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-400 text-sm">Carregando seus dados...</div>
      </div>
    );
  }

  // Visitante sem login: a página é de autoatendimento, então dizemos o que
  // fazer em vez de deixar o "Carregando..." girando para sempre (o efeito
  // acima sai cedo quando não há usuário e nada mais desliga o `loading`).
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <h1 className="text-xl font-black text-gray-900 mb-2">Entre para ver seus dados</h1>
          <p className="text-gray-500 text-sm mb-6">
            Seu perfil e suas inscrições ficam vinculados à sua conta no Portal Conecta.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-hero-gradient text-white font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-all"
          >
            Voltar para a home
          </Link>
        </div>
      </div>
    );
  }

  const naoLidas = notificacoes.filter((n) => !n.lida).length;
  const anosDeIngressoDisponiveis = anosDeIngresso();
  // Curso gravado antes do catálogo existir (texto livre): entra como opção
  // extra para o estudante não perder o valor ao salvar o formulário.
  const cursoForaDoCatalogo =
    dadosAcademicos.curso && !TODOS_OS_CURSOS.includes(dadosAcademicos.curso)
      ? dadosAcademicos.curso
      : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHero
        trilha={[{ href: '/', label: 'Início' }, { label: 'Meus Dados' }]}
        etiqueta="Minha área"
        titulo="Meus Dados"
        descricao="Visualize e gerencie suas inscrições no Portal Conecta"
        icone={<User className="h-7 w-7 text-azul-eletrico" />}
        fundoIcone="bg-azul-50"
      />

      <div className="container mx-auto px-4 max-w-3xl py-8 space-y-6">
        {/* Info do usuário */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-azul-eletrico/10 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-azul-eletrico" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">{user?.displayName ?? 'Estudante'}</h2>
              <p className="text-sm text-gray-500">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Meu Perfil (PerfilAluno) */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-azul-eletrico" />
            <h2 className="font-bold text-gray-900">Meu Perfil</h2>
          </div>
          <form onSubmit={handleSalvarPerfil} className="p-5 space-y-4">
            <p className="text-xs text-gray-500 -mt-1">
              Esses dados são preenchidos automaticamente nas suas inscrições e ajudam os coordenadores a te conhecer melhor.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldPerfil label="Telefone">
                <input name="telefone" type="tel" defaultValue={perfil?.telefone ?? ''} className="input-field" placeholder="(00) 00000-0000" />
              </FieldPerfil>

              <FieldPerfil label="Curso">
                <select name="curso" defaultValue={dadosAcademicos.curso ?? ''} className="input-field">
                  <option value="">Selecione seu curso</option>
                  {cursoForaDoCatalogo && (
                    <option value={cursoForaDoCatalogo}>{cursoForaDoCatalogo} (valor atual)</option>
                  )}
                  {GRUPOS_CURSOS.map((grupo) => (
                    <optgroup key={grupo.group} label={grupo.group}>
                      {grupo.options.map((curso) => (
                        <option key={curso} value={curso}>{curso}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </FieldPerfil>

              <FieldPerfil label="Ano de Ingresso" hint="no curso">
                <select
                  name="anoIngresso"
                  defaultValue={dadosAcademicos.anoIngresso ? String(dadosAcademicos.anoIngresso) : ''}
                  className="input-field"
                >
                  <option value="">Selecione o ano</option>
                  {/* Ano gravado fora da lista (ex.: data futura digitada antes) não some do formulário. */}
                  {dadosAcademicos.anoIngresso && !anosDeIngressoDisponiveis.includes(dadosAcademicos.anoIngresso) && (
                    <option value={String(dadosAcademicos.anoIngresso)}>{dadosAcademicos.anoIngresso}</option>
                  )}
                  {anosDeIngressoDisponiveis.map((ano) => (
                    <option key={ano} value={ano}>{ano}</option>
                  ))}
                </select>
              </FieldPerfil>

              <FieldPerfil label="Semestre" hint="1º a 10º">
                <select
                  name="semestreAtual"
                  defaultValue={ehSemestreValido(semestreAtualDoAluno) ? String(semestreAtualDoAluno) : ''}
                  className="input-field"
                >
                  <option value="">Selecione o semestre</option>
                  {SEMESTRES.map((s) => (
                    <option key={s} value={s}>{rotuloSemestre(s)}</option>
                  ))}
                </select>
              </FieldPerfil>

              <FieldPerfil label="Matrícula">
                <input name="matricula" type="text" defaultValue={perfil?.matricula ?? ''} className="input-field" />
              </FieldPerfil>

              <FieldPerfil label="Currículo Lattes">
                <input name="curriculoLattes" type="url" defaultValue={perfil?.curriculoLattes ?? ''} className="input-field" placeholder="https://lattes.cnpq.br/..." />
              </FieldPerfil>
            </div>

            <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
              <CalendarDays className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                O semestre avança sozinho a cada semestre letivo — hoje estamos no{' '}
                <strong>{periodoLetivoLegivel()}</strong>. Ajuste o campo acima só
                se o valor calculado estiver diferente do seu semestre real.
              </span>
            </div>

            <FieldPerfil label="Experiências prévias">
              <textarea name="experienciasPrevias" defaultValue={perfil?.experienciasPrevias ?? ''} className="input-field min-h-[70px] resize-none" placeholder="Projetos, estágios ou trabalhos anteriores..." />
            </FieldPerfil>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldPerfil label="Áreas de interesse" hint="separadas por vírgula">
                <input
                  name="areasInteresse"
                  type="text"
                  defaultValue={perfil?.areasInteresse.join(', ') ?? ''}
                  className="input-field"
                  placeholder="Ex: robótica, meio ambiente, educação"
                />
              </FieldPerfil>
              <FieldPerfil label="Habilidades" hint="separadas por vírgula">
                <input
                  name="habilidades"
                  type="text"
                  defaultValue={perfil?.habilidades.join(', ') ?? ''}
                  className="input-field"
                  placeholder="Ex: Python, edição de vídeo, oratória"
                />
              </FieldPerfil>
            </div>

            {perfilErro && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {perfilErro}
              </div>
            )}
            {perfilSucesso && (
              <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-xl p-3 text-green-700 text-sm">
                <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {perfilSucesso}
              </div>
            )}

            <button
              type="submit"
              disabled={salvandoPerfil}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-azul-eletrico text-white text-sm font-semibold hover:bg-azul-eletrico/90 transition-all disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              {salvandoPerfil ? 'Salvando...' : 'Salvar perfil'}
            </button>
          </form>
        </div>

        {/* Ações */}
        <div className="flex gap-3">
          <button
            onClick={handleExport}
            disabled={inscricoes.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
          <button
            onClick={() => setShowExclusao(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-red-200 text-sm font-medium text-red-600 hover:bg-red-50 transition-all"
          >
            <Trash2 className="w-4 h-4" />
            Solicitar Exclusão
          </button>
        </div>

        {/* Sucesso */}
        {sucesso && (
          <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-xl p-4 text-green-700 text-sm">
            <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            {sucesso}
          </div>
        )}

        {/* Retorno das ações do aluno (desistir / responder convocação) */}
        {acaoErro && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            {acaoErro}
          </div>
        )}
        {acaoSucesso && (
          <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-xl p-4 text-green-700 text-sm">
            <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            {acaoSucesso}
          </div>
        )}

        {/* Lista de inscrições */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <h2 className="font-bold text-gray-900">Suas Inscrições ({inscricoes.length})</h2>
          </div>

          {inscricoes.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">Nenhuma inscrição encontrada</p>
              <p className="text-sm mt-1">Você ainda não se inscreveu em nenhum projeto.</p>
              <Link href="/projetos" className="inline-flex items-center gap-1.5 mt-4 text-sm font-semibold text-azul-eletrico hover:underline">
                Explorar projetos
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {inscricoes.map((i) => (
                <LinhaInscricao
                  key={i.id}
                  inscricao={i}
                  processando={processandoId === i.id}
                  onDesistir={() => { setAcaoErro(''); setAcaoSucesso(''); setConfirmacao({ tipo: 'desistir', inscricao: i }); }}
                  onRecusar={() => { setAcaoErro(''); setAcaoSucesso(''); setConfirmacao({ tipo: 'recusar', inscricao: i }); }}
                  onAceitar={() => handleResponder(i, 'aceito')}
                />
              ))}
            </div>
          )}
        </div>

        {/* Atualizações das inscrições — os mesmos avisos do sino, aqui do lado
            de onde o aluno age, para ele não precisar caçar o que mudou. */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-azul-eletrico" />
              <h2 className="font-bold text-gray-900">Atualizações</h2>
              {naoLidas > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded-full font-bold bg-red-100 text-red-700">
                  {naoLidas}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {naoLidas > 0 && (
                <button
                  onClick={marcarTodosAvisosLidos}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-azul-eletrico hover:underline"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Marcar todas como lidas
                </button>
              )}
              <Link href="/minha-area#notificacoes" className="text-xs font-semibold text-azul-eletrico hover:underline">
                Ver todas
              </Link>
            </div>
          </div>

          {notificacoes.length === 0 ? (
            <div className="px-5 py-8 text-center text-gray-400">
              <BellRing className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium">Nenhuma atualização por aqui ainda</p>
              <p className="text-xs mt-1">
                Quando a coordenação mudar o status de uma inscrição sua, o aviso aparece aqui — e também no seu e-mail.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {notificacoes.slice(0, 5).map((n) => (
                <div key={n.id} className={`px-5 py-4 flex items-start gap-3 ${n.lida ? '' : 'bg-azul-eletrico/5'}`}>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    n.lida ? 'bg-gray-100 text-gray-400' : 'bg-azul-eletrico/10 text-azul-eletrico'
                  }`}>
                    {n.lida ? <Bell className="w-4 h-4" /> : <BellRing className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900">{n.titulo}</p>
                    {n.texto && <p className="text-sm text-gray-600 mt-0.5">{n.texto}</p>}
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-xs text-gray-400">{formatarTempoRelativo(n.created_at)}</span>
                      {n.link && (
                        <Link href={n.link} className="text-xs font-semibold text-azul-eletrico hover:underline">
                          Abrir
                        </Link>
                      )}
                    </div>
                  </div>
                  {!n.lida && (
                    <button
                      onClick={() => marcarAvisoLido(n.id)}
                      className="p-2 rounded-lg text-gray-400 hover:bg-gray-50 hover:text-green-600 transition-colors"
                      title="Marcar como lida"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              {notificacoes.length > 5 && (
                <div className="px-5 py-3 text-center">
                  <Link href="/minha-area#notificacoes" className="text-xs font-semibold text-azul-eletrico hover:underline">
                    Ver as {notificacoes.length} atualizações
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* LGPD Info */}
        <div className="bg-blue-50 rounded-2xl border border-blue-100 p-5">
          <h3 className="font-bold text-blue-900 text-sm mb-2">Seus Direitos (LGPD)</h3>
          <ul className="text-sm text-blue-700 space-y-1.5">
            <li>• Você pode visualizar todas as suas inscrições</li>
            <li>• Você pode desistir de uma inscrição a qualquer momento</li>
            <li>• Você pode exportar seus dados em formato CSV</li>
            <li>• Você pode solicitar a exclusão dos seus dados</li>
            <li>• Seus dados são tratados conforme a Lei 13.709/2018 (LGPD)</li>
          </ul>
        </div>

        {/* Confirmação de ação sobre a inscrição */}
        {confirmacao && (
          <ModalConfirmacao
            confirmacao={confirmacao}
            processando={processandoId === confirmacao.inscricao.id}
            motivo={motivoDesistencia}
            onMotivo={setMotivoDesistencia}
            onFechar={() => { setConfirmacao(null); setMotivoDesistencia(''); }}
            onConfirmar={() =>
              confirmacao.tipo === 'desistir'
                ? handleDesistir(confirmacao.inscricao)
                : handleResponder(confirmacao.inscricao, 'recusado')
            }
          />
        )}

        {/* Modal de exclusão */}
        {showExclusao && (
          <>
            <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowExclusao(false)} />
            <div className="fixed top-0 right-0 h-full w-full max-w-lg bg-white z-50 shadow-2xl flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h2 className="font-bold text-gray-900">Solicitar Exclusão de Dados</h2>
                <button onClick={() => setShowExclusao(false)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                  <XCircle className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-orange-700">
                      <p className="font-semibold mb-1">Atenção:</p>
                      <p>A solicitação de exclusão irá marcar suas inscrições como "desistente" e anonimizar seus dados pessoais. Esta ação é irreversível.</p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Motivo (opcional)</label>
                  <textarea
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-azul-eletrico min-h-[80px] resize-none"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Informe o motivo da exclusão..."
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowExclusao(false)}
                    className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleExclusao}
                    disabled={excluindo}
                    className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-semibold text-sm hover:bg-red-700 transition-all disabled:opacity-60"
                  >
                    {excluindo ? 'Processando...' : 'Confirmar Exclusão'}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Linha de inscrição com as ações do estudante ─────────────────────────────

function LinhaInscricao({
  inscricao,
  processando,
  onDesistir,
  onRecusar,
  onAceitar,
}: {
  inscricao: Inscricao;
  processando: boolean;
  onDesistir: () => void;
  onRecusar: () => void;
  onAceitar: () => void;
}) {
  const convocado = podeResponderConvocacao(inscricao.status, inscricao.resposta_aluno);
  const desistenciaDisponivel = podeDesistir(inscricao.status);
  const resposta = rotuloRespostaAluno(inscricao.resposta_aluno);
  const jaRespondeu = Boolean(inscricao.resposta_aluno);

  return (
    <div className="px-5 py-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Link
              href={`/projetos/${inscricao.projeto.slug}`}
              className="font-semibold text-gray-900 text-sm hover:text-azul-eletrico transition-colors"
            >
              {inscricao.projeto.nome}
            </Link>
            <span className="text-xs text-gray-400">•</span>
            <span className="text-xs text-gray-400">{inscricao.projeto.area}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
            <span className="font-mono">{inscricao.protocolo}</span>
            <span>•</span>
            <span>{inscricao.tipo_interesse}</span>
            <span>•</span>
            <span>{formatDateShort(inscricao.created_at)}</span>
            {resposta && (
              <>
                <span>•</span>
                <span className={`inline-flex items-center gap-1 font-semibold ${inscricao.resposta_aluno === 'aceito' ? 'text-green-700' : 'text-orange-700'}`}>
                  {inscricao.resposta_aluno === 'aceito' ? <ThumbsUp className="w-3 h-3" /> : <ThumbsDown className="w-3 h-3" />}
                  {resposta}
                </span>
              </>
            )}
          </div>
        </div>
        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[inscricao.status] ?? 'bg-gray-100 text-gray-600'}`}>
          {ROTULO_STATUS[inscricao.status] ?? inscricao.status.replace(/_/g, ' ')}
        </span>
      </div>

      {convocado && (
        <div className="mt-3 flex items-start gap-2 bg-green-50 border border-green-200 rounded-xl p-3 text-green-800 text-xs">
          <ThumbsUp className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            <strong>Você foi convocado(a)!</strong> Confirme se quer participar para garantir sua vaga —
            enquanto você não responde, a coordenação não sabe se pode contar com você.
          </span>
        </div>
      )}

      {(convocado || desistenciaDisponivel) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {convocado && (
            <>
              <button
                onClick={onAceitar}
                disabled={processando}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 transition-colors disabled:opacity-60"
              >
                {processando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ThumbsUp className="w-3.5 h-3.5" />}
                Aceitar convocação
              </button>
              <button
                onClick={onRecusar}
                disabled={processando}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-50 transition-colors disabled:opacity-60"
              >
                <ThumbsDown className="w-3.5 h-3.5" />
                Recusar
              </button>
            </>
          )}

          {desistenciaDisponivel && (
            <button
              onClick={onDesistir}
              disabled={processando}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50 transition-colors disabled:opacity-60 sm:ml-auto"
            >
              <Ban className="w-3.5 h-3.5" />
              Desistir da inscrição
            </button>
          )}

          {jaRespondeu && !convocado && (
            <span className="text-xs text-gray-400">
              Resposta registrada — para mudar, fale com a coordenação do projeto.
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Modal de confirmação ────────────────────────────────────────────────────

function ModalConfirmacao({
  confirmacao,
  processando,
  motivo,
  onMotivo,
  onFechar,
  onConfirmar,
}: {
  confirmacao: NonNullable<Confirmacao>;
  processando: boolean;
  motivo: string;
  onMotivo: (valor: string) => void;
  onFechar: () => void;
  onConfirmar: () => void;
}) {
  const desistir = confirmacao.tipo === 'desistir';
  const { projeto } = confirmacao.inscricao;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onFechar} />
      <div className="fixed inset-x-0 bottom-0 sm:inset-0 sm:flex sm:items-center sm:justify-center z-50 p-0 sm:p-4">
        <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl p-6">
          <h2 className="font-bold text-gray-900 mb-2">
            {desistir ? 'Desistir da inscrição?' : 'Recusar a convocação?'}
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            {desistir ? (
              <>
                Sua inscrição em <strong>{projeto.nome}</strong> será marcada como desistente e a vaga
                volta a ficar disponível. A coordenação é avisada na hora.
              </>
            ) : (
              <>
                Você está abrindo mão da vaga em <strong>{projeto.nome}</strong>. A coordenação será
                avisada e poderá chamar outra pessoa — pelo portal não dá para voltar atrás.
              </>
            )}
          </p>

          {desistir && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Motivo (opcional)</label>
              <textarea
                value={motivo}
                onChange={(e) => onMotivo(e.target.value)}
                maxLength={500}
                placeholder="Ex: consegui outra bolsa, horário incompatível..."
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-azul-eletrico min-h-[70px] resize-none"
              />
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={onFechar}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-all"
            >
              Voltar
            </button>
            <button
              onClick={onConfirmar}
              disabled={processando}
              className={`flex-1 py-2.5 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-60 ${
                desistir ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-900 hover:bg-gray-800'
              }`}
            >
              {processando ? 'Processando...' : desistir ? 'Sim, desistir' : 'Sim, recusar'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function FieldPerfil({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {hint && <span className="text-gray-400 font-normal ml-1">({hint})</span>}
      </label>
      {children}
    </div>
  );
}
