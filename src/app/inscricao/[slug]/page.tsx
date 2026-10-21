'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  ChevronRight, CheckCircle, AlertCircle, ArrowLeft,
  Loader2, FileText, Clock, ClipboardCheck, ClipboardList,
} from 'lucide-react';
import { PageHero } from '@/components/layout/PageHero';
import { criarInscricao } from '@/actions/inscricao';
import { getDadosAcademicosInscricao } from '@/actions/perfil';
import { formatDate } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { TurnstileWidget } from '@/components/ui/turnstile-widget';
import { Field, Fieldset } from '@/components/ui/FormFieldPrimitives';
import { PerguntasExtraFields } from '@/components/ui/PerguntasExtraFields';
import { parsePerguntasExtra, coletarRespostasExtra, type PerguntaExtra } from '@/lib/formulario-extra';
import { MENSAGENS, mensagemAmigavel, mensagemDeErroServidor } from '@/lib/mensagens';
import {
  GRUPOS_CURSOS, SEMESTRES, TODOS_OS_CURSOS, anosDeIngresso,
  formatarSemestreInscricao, rotuloSemestre, turmaDeIngresso,
  type FonteAcademica,
} from '@/lib/perfil-academico';

type VagaInfo = {
  id: string;
  titulo: string;
  tipo: 'BOLSISTA' | 'VOLUNTARIO' | 'AMBOS';
  descricao: string | null;
  quantidade: number;
  valorBolsa: number | null;
  cargaHorariaSemanal: number | null;
};

type ProjetoInfo = {
  id: string;
  nome: string;
  inscricoes_abertas: boolean;
  inscricao_inicio: Date | null;
  inscricao_fim: Date | null;
  vagasBolsista: number;
  vagasVoluntario: number;
  vagas: VagaInfo[];
  formulario_extra?: unknown;
};

// Catálogo de cursos, anos de ingresso e semestres: um único lugar
// (src/lib/perfil-academico.ts), compartilhado com o "Meu Perfil" — antes a
// lista vivia só aqui e o perfil aceitava texto livre, o que fazia o mesmo
// aluno aparecer com nomes de curso diferentes nas duas telas.
const ANOS_INICIO = anosDeIngresso();

export default function InscricaoPage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const { user, supabaseUserId, loading: authCarregando } = useAuth();

  const [projeto, setProjeto] = useState<ProjetoInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [protocolo, setProtocolo] = useState('');
  const [isPending, startTransition] = useTransition();

  // Dados do perfil do estudante logado, usados para pré-preencher o formulário
  // (ver `getDadosAcademicosInscricao`). `null` = visitante sem login.
  const [dadosDoPerfil, setDadosDoPerfil] = useState<FonteAcademica | null>(null);

  // Estado para cálculo automático de turma
  const [anoInicio, setAnoInicio] = useState<string>('');
  const [semestre, setSemestre] = useState<string>('');
  const [turmaCalculada, setTurmaCalculada] = useState('');

  // Vaga escolhida (quando o projeto tem vagas reais cadastradas)
  const [vagaId, setVagaId] = useState<string>('');

  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  // Calcular turma automaticamente
  React.useEffect(() => {
    setTurmaCalculada(turmaDeIngresso(anoInicio ? Number(anoInicio) : null) ?? '');
  }, [anoInicio]);

  // Verificar inscrições ao carregar.
  //
  // Espera o Firebase dizer QUEM é o usuário (`authCarregando`) antes de montar
  // o formulário: os campos usam `defaultValue`, então se o perfil chegasse
  // depois da primeira renderização o aluno logado veria tudo em branco mesmo
  // tendo perfil — e o "puxa os dados do perfil" não funcionaria. Para quem não
  // está logado o estado de auth resolve na hora e nada muda.
  React.useEffect(() => {
    if (authCarregando) return;
    let cancelado = false;

    const idTokenPromise = user ? user.getIdToken() : Promise.resolve(null);

    Promise.all([
      fetch(`/api/projetos/check-inscricao?slug=${slug}`).then((r) => r.json()),
      idTokenPromise
        .then((idToken) => (idToken ? getDadosAcademicosInscricao(idToken) : null))
        .catch(() => null),
    ])
      .then(([data, academicos]) => {
        if (cancelado) return;

        if (data.projeto) setProjeto(data.projeto);
        else setError(mensagemAmigavel(data.error, 'Não encontramos este projeto. Ele pode ter sido removido ou o link está incompleto.'));

        if (academicos) {
          setDadosDoPerfil(academicos);
          if (academicos.anoIngresso) setAnoInicio(String(academicos.anoIngresso));
          // Já vem avançado até o semestre de hoje pelo servidor.
          if (academicos.semestreAtual) setSemestre(String(academicos.semestreAtual));
        }
      })
      .catch(() => {
        if (!cancelado) setError('Não conseguimos carregar as informações deste projeto. Confira sua conexão e recarregue a página.');
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });

    return () => { cancelado = true; };
  }, [slug, user, authCarregando]);

  const temVagas = (projeto?.vagas.length ?? 0) > 0;
  const vagaEscolhida = projeto?.vagas.find((v) => v.id === vagaId);
  const prefillDoPerfil = Boolean(
    dadosDoPerfil &&
      (dadosDoPerfil.curso ||
        dadosDoPerfil.anoIngresso ||
        dadosDoPerfil.semestre ||
        dadosDoPerfil.matricula ||
        dadosDoPerfil.telefone),
  );
  // Curso que veio do cadastro antigo e não existe no catálogo (ex.: "Técnico em
  // Informática"): aparece como opção extra para não sumir da tela, mas o aluno
  // é quem decide — o catálogo é a lista oficial.
  const cursoForaDoCatalogo =
    dadosDoPerfil?.curso && !TODOS_OS_CURSOS.includes(dadosDoPerfil.curso)
      ? dadosDoPerfil.curso
      : null;
  const perguntasExtra: PerguntaExtra[] = React.useMemo(
    () => parsePerguntasExtra(projeto?.formulario_extra),
    [projeto?.formulario_extra]
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (temVagas && !vagaId) {
      setError('Escolha a vaga em que você quer se inscrever antes de enviar.');
      return;
    }

    if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !captchaToken) {
      setError(MENSAGENS.verificacaoSegurancaPendente);
      return;
    }

    const form = new FormData(e.currentTarget);

    const data = {
      projetoId: projeto!.id,
      vagaId: vagaId || undefined,
      nome_completo: form.get('nome_completo') as string,
      email: form.get('email') as string,
      telefone: form.get('telefone') as string,
      curso: form.get('curso') as string,
      turma: turmaCalculada || form.get('turma') as string,
      // Formato histórico "<ano de ingresso>.<semestre do curso>" (ex.: "2024.5"),
      // montado pelo helper compartilhado para não divergir do perfil.
      semestre: formatarSemestreInscricao(anoInicio ? Number(anoInicio) : null, semestre ? Number(semestre) : null),
      idade: form.get('idade') ? Number(form.get('idade')) : undefined,
      matricula: form.get('matricula') as string,
      genero: form.get('genero') as string,
      tipo_interesse: vagaEscolhida
        ? vagaEscolhida.tipo
        : (form.get('tipo_interesse') as 'BOLSISTA' | 'VOLUNTARIO' | 'AMBOS'),
      disponibilidade: form.getAll('disponibilidade').join(', '),
      experiencia_previa: form.get('experiencia_previa') as string,
      justificativa: form.get('justificativa') as string,
      ciencia_regras: form.get('ciencia_regras') === 'on',
      consentimento_lgpd: form.get('consentimento_lgpd') === 'on',
      campos_extra: coletarRespostasExtra(form, perguntasExtra),
      // `user.uid` é o UID do Firebase — não tem relação nenhuma com
      // `User.id` (cuid interno do Prisma) que `Inscricao.user_id`
      // referencia. Usar o UID do Firebase aqui sempre violava a foreign
      // key pra qualquer usuário logado. `supabaseUserId` é o id correto,
      // já resolvido pelo AuthContext via `ensureUser`.
      userId: supabaseUserId || undefined,
      captchaToken: captchaToken ?? undefined,
    };

    startTransition(async () => {
      const result = await criarInscricao(data);
      if (result.ok) {
        setProtocolo(result.data.protocolo);
        setSuccess('Inscrição enviada com sucesso!');
      } else {
        setError(mensagemDeErroServidor(result.error, 'Não conseguimos concluir sua inscrição. Revise os dados e tente novamente.'));
      }
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-azul-eletrico animate-spin" />
      </div>
    );
  }

  if (error && !projeto) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Não conseguimos abrir esta inscrição</h1>
          <p className="text-gray-500 mb-6">{error}</p>
          <Link href="/projetos" className="text-azul-eletrico font-semibold hover:underline">
            Ver projetos
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-black text-gray-900 mb-2">Inscrição Confirmada!</h1>
          <p className="text-gray-500 text-sm mb-6">
            Sua inscrição no projeto <strong>{projeto?.nome}</strong> foi registrada com sucesso.
          </p>

          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <p className="text-xs text-gray-400 mb-1">Seu protocolo</p>
            <p className="text-2xl font-black text-azul-eletrico font-mono">{protocolo}</p>
          </div>

          <p className="text-xs text-gray-400 mb-6">
            Guarde este protocolo. Você pode usá-lo para acompanhar sua inscrição.
          </p>

          <div className="flex flex-col gap-3">
            <Link
              href="/projetos"
              className="w-full py-3 rounded-xl bg-azul-eletrico text-white font-semibold text-sm hover:bg-azul-eletrico/90 transition-all"
            >
              Voltar aos Projetos
            </Link>
            <Link
              href="/"
              className="w-full py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-all"
            >
              Ir para o Início
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHero
        trilha={[
          { href: '/', label: 'Início' },
          { href: '/projetos', label: 'Projetos' },
          { label: 'Inscrição' },
        ]}
        etiqueta="Inscrição"
        titulo="Inscreva-se"
        descricao={projeto?.nome ? `Projeto: ${projeto.nome}` : undefined}
        icone={<ClipboardList className="h-7 w-7 text-azul-eletrico" />}
        fundoIcone="bg-azul-50"
      />

      {/* Info do projeto */}
      <div className="container mx-auto px-4 max-w-2xl py-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
            <Clock className="w-4 h-4" />
            <span>
              Inscrições até: <strong>{projeto?.inscricao_fim ? formatDate(projeto.inscricao_fim) : 'Não definido'}</strong>
            </span>
          </div>
          {!temVagas && (
            <div className="flex gap-4 text-sm">
              {projeto?.vagasBolsista ? (
                <span className="text-gray-600">
                  <strong className="text-gray-900">{projeto.vagasBolsista}</strong> vaga(s) bolsista(s)
                </span>
              ) : null}
              {projeto?.vagasVoluntario ? (
                <span className="text-gray-600">
                  <strong className="text-gray-900">{projeto.vagasVoluntario}</strong> vaga(s) voluntária(s)
                </span>
              ) : null}
            </div>
          )}
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
          {/* Os dados vêm do perfil do aluno logado (getDadosAcademicosInscricao).
              O aviso existe para ele CONFERIR em vez de confiar: o semestre é
              calculado pelo portal e pode estar defasado se ele não atualiza o
              perfil desde que entrou no curso. */}
          {prefillDoPerfil && (
            <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
              <ClipboardCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                Puxamos seus dados do perfil para agilizar — confira antes de enviar. Algo mudou?{' '}
                <Link href="/meus-dados" className="font-semibold underline">
                  Atualize seu perfil
                </Link>{' '}
                e as próximas inscrições já vêm certinhas.
              </span>
            </div>
          )}

          {/* DADOS PESSOAIS */}
          <div>
            <h2 className="font-bold text-gray-900 text-lg mb-4">Dados Pessoais</h2>

            <div className="space-y-4">
              <Field label="Nome completo" required>
                <input name="nome_completo" type="text" className="input-field" required defaultValue={user?.displayName ?? ''} />
              </Field>

              <Field label="Email" required>
                <input name="email" type="email" className="input-field" required defaultValue={user?.email ?? ''} />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Telefone">
                  <input name="telefone" type="tel" className="input-field" placeholder="(00) 00000-0000" defaultValue={dadosDoPerfil?.telefone ?? ''} />
                </Field>
                <Field label="Idade">
                  <input name="idade" type="number" className="input-field" min="14" max="100" />
                </Field>
              </div>

              {/* Gênero - Radio buttons */}
              <Fieldset label="Gênero" required>
                <div className="flex gap-4">
                  {['Masculino', 'Feminino', 'Outro'].map((g) => (
                    <label key={g} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="genero" value={g} required className="w-4 h-4 accent-azul-eletrico" />
                      <span className="text-sm text-gray-700">{g}</span>
                    </label>
                  ))}
                </div>
              </Fieldset>
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* DADOS ACADÊMICOS */}
          <div>
            <h2 className="font-bold text-gray-900 text-lg mb-4">Dados Acadêmicos</h2>

            <div className="space-y-4">
              {/* Curso - Select com grupos */}
              <Field label="Curso" required>
                <select name="curso" className="input-field" required defaultValue={dadosDoPerfil?.curso ?? ''}>
                  <option value="">Selecione seu curso</option>
                  {cursoForaDoCatalogo && (
                    <option value={cursoForaDoCatalogo}>{cursoForaDoCatalogo} (do seu cadastro)</option>
                  )}
                  {GRUPOS_CURSOS.map((group) => (
                    <optgroup key={group.group} label={group.group}>
                      {group.options.map((curso) => (
                        <option key={curso} value={curso}>{curso}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </Field>

              <div className="grid grid-cols-2 gap-4">
                {/* Ano de início - Select */}
                <Field label="Ano de Início" required>
                  <select
                    name="ano_inicio"
                    className="input-field"
                    required
                    value={anoInicio}
                    onChange={(e) => setAnoInicio(e.target.value)}
                  >
                    <option value="">Selecione</option>
                    {ANOS_INICIO.map((ano) => (
                      <option key={ano} value={ano}>{ano}</option>
                    ))}
                  </select>
                </Field>

                {/* Semestre - Select */}
                <Field label="Semestre Atual" required>
                  <select
                    name="semestre_atual"
                    className="input-field"
                    required
                    value={semestre}
                    onChange={(e) => setSemestre(e.target.value)}
                  >
                    <option value="">Selecione</option>
                    {SEMESTRES.map((s) => (
                      <option key={s} value={s}>{rotuloSemestre(s)}</option>
                    ))}
                  </select>
                </Field>
              </div>

              {/* Turma - Calculada automaticamente */}
              <Field label="Turma">
                <input
                  type="text"
                  className="input-field bg-gray-50"
                  value={turmaCalculada}
                  readOnly
                  placeholder="Preencha Ano de Início acima"
                />
                <p className="text-xs text-gray-400 mt-1">Calculado automaticamente: Turma {anoInicio || '???'}</p>
              </Field>

              <Field label="Matrícula">
                <input name="matricula" type="text" className="input-field" placeholder="Número da matrícula" defaultValue={dadosDoPerfil?.matricula ?? ''} />
              </Field>
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* DETALHES DA INSCRIÇÃO */}
          <div>
            <h2 className="font-bold text-gray-900 text-lg mb-4">Detalhes da Inscrição</h2>

            <div className="space-y-4">
              {temVagas ? (
                <Fieldset label="Escolha a vaga" required>
                  <div className="space-y-2">
                    {projeto!.vagas.map((v) => (
                      <label
                        key={v.id}
                        className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                          vagaId === v.id ? 'border-azul-eletrico bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="vaga_escolhida"
                          value={v.id}
                          required
                          checked={vagaId === v.id}
                          onChange={() => setVagaId(v.id)}
                          className="w-4 h-4 mt-0.5 accent-azul-eletrico"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-900">
                            {v.titulo}{' '}
                            <span className="text-xs font-normal text-gray-500">
                              ({v.tipo === 'AMBOS' ? 'Bolsista ou Voluntário' : v.tipo === 'BOLSISTA' ? 'Bolsista' : 'Voluntário'})
                            </span>
                          </p>
                          {v.descricao && <p className="text-xs text-gray-500 mt-0.5">{v.descricao}</p>}
                          <p className="text-xs text-gray-400 mt-1">
                            {v.quantidade} vaga(s)
                            {v.valorBolsa ? ` · R$ ${v.valorBolsa.toFixed(2)}/mês` : ''}
                            {v.cargaHorariaSemanal ? ` · ${v.cargaHorariaSemanal}h/semana` : ''}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </Fieldset>
              ) : (
                /* Tipo de interesse - Radio buttons (fallback para projetos sem vagas cadastradas) */
                <Fieldset label="Tipo de interesse" required>
                  <div className="flex gap-4">
                    {[
                      { value: 'BOLSISTA', label: 'Bolsista' },
                      { value: 'VOLUNTARIO', label: 'Voluntário' },
                      { value: 'AMBOS', label: 'Ambos' },
                    ].map((opt) => (
                      <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="tipo_interesse" value={opt.value} required className="w-4 h-4 accent-azul-eletrico" />
                        <span className="text-sm text-gray-700">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </Fieldset>
              )}

              {/* Disponibilidade - Checkboxes */}
              <Fieldset label="Disponibilidade">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    'Manhã', 'Tarde', 'Noite',
                    'Seg-Sex', 'Sábados', 'Horário flexível',
                  ].map((d) => (
                    <label key={d} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50">
                      <input type="checkbox" name="disponibilidade" value={d} className="w-4 h-4 accent-azul-eletrico" />
                      <span className="text-sm text-gray-700">{d}</span>
                    </label>
                  ))}
                </div>
              </Fieldset>

              <Field label="Experiência prévia">
                <select name="experiencia_previa" className="input-field">
                  <option value="">Selecione</option>
                  <option value="nenhuma">Nenhuma experiência</option>
                  <option value="pouca">Pouca experiência (1-6 meses)</option>
                  <option value="media">Média experiência (6 meses - 2 anos)</option>
                  <option value="muita">Muita experiência (mais de 2 anos)</option>
                </select>
              </Field>

              <Field label="Por que quer participar?">
                <textarea name="justificativa" className="input-field min-h-[80px] resize-none" placeholder="Explique sua motivação..." />
              </Field>
            </div>
          </div>

          {perguntasExtra.length > 0 && (
            <>
              <hr className="border-gray-100" />
              <div>
                <h2 className="font-bold text-gray-900 text-lg mb-4">Perguntas do Projeto</h2>
                <div className="space-y-4">
                  <PerguntasExtraFields perguntas={perguntasExtra} />
                </div>
              </div>
            </>
          )}

          <hr className="border-gray-100" />

          {/* TERMOS */}
          <div>
            <h2 className="font-bold text-gray-900 text-lg mb-4">Termos</h2>

            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl hover:bg-gray-50 border border-gray-100">
                <input name="ciencia_regras" type="checkbox" required className="w-4 h-4 mt-0.5 accent-azul-eletrico" />
                <span className="text-sm text-gray-600">
                  Declaro que li e compreendo as regras do projeto e estou ciente das minhas responsabilidades. *
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl hover:bg-gray-50 border border-gray-100">
                <input name="consentimento_lgpd" type="checkbox" required className="w-4 h-4 mt-0.5 accent-azul-eletrico" />
                <span className="text-sm text-gray-600">
                  Autorizo o tratamento dos meus dados pessoais conforme a <strong>LGPD (Lei 13.709/2018)</strong> para fins de participação neste projeto. *
                </span>
              </label>
            </div>
          </div>

          <TurnstileWidget onVerify={setCaptchaToken} />

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-3 rounded-xl bg-azul-eletrico text-white font-semibold text-sm hover:bg-azul-eletrico/90 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Processando...</>
            ) : (
              <><FileText className="w-4 h-4" /> Enviar Inscrição</>
            )}
          </button>

          <p className="text-xs text-gray-400 text-center">
            * Campos obrigatórios
          </p>
        </form>
      </div>
    </div>
  );
}

