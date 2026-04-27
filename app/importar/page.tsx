"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Sidebar from "@/components/Sidebar";
import { brl, calcDividendoMensal } from "@/lib/dividends";
import { parsarArquivoB3, agruparPorTicker } from "@/lib/b3-parser";
import type { Ativo, MovParsed } from "@/types";

const TIPO_LABEL: Record<string, string> = {
  compra: "🛒 Compra",
  venda: "💸 Venda",
  bonificacao: "🎁 Bonificação",
  fracao_ganho: "➕ Fração ganha",
  fracao_perda: "➖ Fração perdida",
  dividendo: "💰 Dividendo",
  jcp: "💵 JCP",
};

const TIPO_COR: Record<string, string> = {
  compra: "#34d399",
  venda: "#f87171",
  bonificacao: "#fbbf24",
  fracao_ganho: "#60a5fa",
  fracao_perda: "#94a3b8",
  dividendo: "#a89ef7",
  jcp: "#a89ef7",
};

export default function Importar() {
  const [user, setUser] = useState<any>(null);
  const [ativos, setAtivos] = useState<Ativo[]>([]);
  const [loading, setLoading] = useState(true);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [parsed, setParsed] = useState<MovParsed[]>([]);
  const [hashesExistentes, setHashesExistentes] = useState<Set<string>>(new Set());
  const [dataLimite, setDataLimite] = useState("");
  const [useDataLimite, setUseDataLimite] = useState(false);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<{ sucesso: number; ignorados: number; novos_tickers: string[] } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const sb = createClient();

  const load = useCallback(async () => {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { router.push("/auth"); return; }
    setUser(user);
    const [a, m] = await Promise.all([
      sb.from("ativos").select("*").eq("user_id", user.id),
      sb.from("movimentacoes").select("hash").eq("user_id", user.id),
    ]);
    setAtivos(a.data || []);
    setHashesExistentes(new Set((m.data || []).map((r: any) => r.hash)));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleFile(file: File) {
    setArquivo(file);
    setResultado(null);
    try {
      const buffer = await file.arrayBuffer();
      const movs = parsarArquivoB3(buffer);
      setParsed(movs);
    } catch (err) {
      alert("Erro ao ler arquivo. Certifique-se que é um .xlsx da B3.");
      console.error(err);
      setArquivo(null);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  const movsParaImportar = parsed.filter(m => {
    if (hashesExistentes.has(m.hash)) return false;
    if (useDataLimite && dataLimite && m.data < dataLimite) return false;
    return true;
  });

  const movsJaImportadas = parsed.filter(m => hashesExistentes.has(m.hash)).length;
  const movsIgnoradasPorData = useDataLimite && dataLimite
    ? parsed.filter(m => !hashesExistentes.has(m.hash) && m.data < dataLimite).length
    : 0;

  const porTicker = agruparPorTicker(movsParaImportar);
  const tickers = Object.keys(porTicker).sort();
  const tickersExistentes = new Set(ativos.map(a => a.ticker));
  const novosTickers = tickers.filter(t => !tickersExistentes.has(t));

  async function confirmarImportacao() {
    if (!user || movsParaImportar.length === 0) return;
    setImportando(true);
    try {
      const registros = movsParaImportar.map(m => ({
        user_id: user.id,
        data: m.data,
        ticker: m.ticker,
        tipo: m.tipo,
        quantidade: m.quantidade,
        preco: m.preco,
        valor: m.valor,
        hash: m.hash,
        instituicao: m.instituicao,
      }));

      for (let i = 0; i < registros.length; i += 500) {
        const chunk = registros.slice(i, i + 500);
        const { error } = await sb.from("movimentacoes").insert(chunk);
        if (error) throw error;
      }

      const { data: todasMovs } = await sb.from("movimentacoes")
        .select("*")
        .eq("user_id", user.id)
        .order("data", { ascending: true });

      const posicoes: Record<string, { cotas: number; custo: number }> = {};
      for (const m of todasMovs || []) {
        const t = m.ticker;
        if (!posicoes[t]) posicoes[t] = { cotas: 0, custo: 0 };
        const p = posicoes[t];
        const qtd = Number(m.quantidade);
        const preco = Number(m.preco);

        if (m.tipo === "compra") {
          p.custo += qtd * preco;
          p.cotas += qtd;
        } else if (m.tipo === "venda") {
          if (p.cotas > 0) {
            const pm = p.custo / p.cotas;
            p.custo -= qtd * pm;
          }
          p.cotas -= qtd;
        } else if (m.tipo === "bonificacao" || m.tipo === "fracao_ganho") {
          p.cotas += qtd;
        } else if (m.tipo === "fracao_perda") {
          if (p.cotas > 0) {
            const pm = p.custo / p.cotas;
            p.custo -= qtd * pm;
          }
          p.cotas -= qtd;
        }
      }

      for (const ticker of Object.keys(posicoes)) {
        const p = posicoes[ticker];
        if (p.cotas <= 0) continue;
        const ativoExistente = ativos.find(a => a.ticker === ticker);
        if (!ativoExistente) {
          const isFII = /\d11$/.test(ticker);
          await sb.from("ativos").insert({
            user_id: user.id,
            ticker,
            nome: ticker,
            tipo: isFII ? "FIIs" : "Ações/FIIs",
            subtipo: "A classificar",
            cotas: p.cotas,
            cotas_alvo: p.cotas,
            cotacao: p.custo / p.cotas,
            invest: p.custo,
            atual: p.custo,
            dy: 0,
            dpa: 0,
            div_mensal: 0,
            inst: "Importado B3",
            obs: "Ativo criado via importação B3",
          });
        } else {
          const isFII = /\d11$/.test(ticker);
          const novoAtual = p.cotas * Number(ativoExistente.cotacao);
          const novoDivMensal = isFII
            ? p.cotas * Number(ativoExistente.dpa)
            : (p.cotas * Number(ativoExistente.dpa)) / 3;
          await sb.from("ativos")
            .update({ cotas: p.cotas, invest: p.custo, atual: novoAtual, div_mensal: novoDivMensal })
            .eq("id", ativoExistente.id);
        }
      }

      const { data: ativosAtualizados } = await sb.from("ativos")
        .select("*")
        .eq("user_id", user.id)
        .eq("tipo", "FIIs");
      const novoDivTotal = (ativosAtualizados || []).reduce(
        (s: number, a: any) => s + Number(a.cotas) * Number(a.dpa), 0
      );
      await sb.from("metas")
        .update({ atual: novoDivTotal })
        .eq("user_id", user.id)
        .ilike("nome", "%dividendo%");

      setResultado({
        sucesso: movsParaImportar.length,
        ignorados: movsJaImportadas + movsIgnoradasPorData,
        novos_tickers: novosTickers,
      });
      await load();
      setParsed([]);
      setArquivo(null);
    } catch (err: any) {
      alert("Erro ao importar: " + (err?.message || err));
      console.error(err);
    } finally {
      setImportando(false);
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="text-violet-l animate-pulse">Carregando...</div>
    </div>
  );

  const divMensal = calcDividendoMensal(ativos);
  const patrimonio = ativos.reduce((s, a) => s + Number(a.atual), 0);

  return (
    <div className="flex bg-bg min-h-screen">
      <Sidebar userEmail={user?.email} healthPct={0} patrimoniTotal={patrimonio}
        dividendoMensal={divMensal} metaDividendo={100} />
      <main className="ml-56 flex-1 p-7">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-black text-white">📤 Importar Movimentações B3</h1>
          <p className="text-muted text-[9px] tracking-[2px] uppercase mt-0.5">
            Upload do extrato oficial da B3 · Atualiza carteira automaticamente
          </p>
        </div>

        {/* Upload area */}
        {!arquivo && (
          <>
            <div onDrop={handleDrop}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileInputRef.current?.click()}
              className="card cursor-pointer transition-all text-center py-16"
              style={{
                borderColor: dragOver ? "#a89ef7" : "rgba(255,255,255,0.1)",
                background: dragOver ? "rgba(124,106,247,0.05)" : undefined,
                borderStyle: "dashed",
                borderWidth: "2px",
              }}>
              <div className="text-5xl mb-3">📁</div>
              <div className="font-display text-xl font-bold text-white mb-2">
                Arraste o arquivo aqui
              </div>
              <div className="text-sm text-muted mb-1">
                ou <span className="text-violet-l font-bold">clique para selecionar</span>
              </div>
              <div className="text-[10px] text-muted">
                movimentacao-AAAA-MM-DD-HH-MM-SS.xlsx
              </div>
            </div>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden"
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />

            <div className="card mt-5" style={{ background: "rgba(52,211,153,0.03)", borderColor: "rgba(52,211,153,0.15)" }}>
              <div className="text-xs text-teal font-bold mb-2">💡 Como baixar o arquivo</div>
              <ol className="text-[10px] text-muted space-y-1.5 list-decimal list-inside">
                <li>Acesse <strong className="text-white">investidor.b3.com.br</strong></li>
                <li>Faça login com seu CPF e senha</li>
                <li>Vá em <strong className="text-white">Extratos → Movimentação</strong></li>
                <li>Escolha o período (máximo 12 meses por arquivo)</li>
                <li>Clique em <strong className="text-white">"Exportar para Excel"</strong></li>
                <li>Arraste o arquivo baixado na caixa acima</li>
              </ol>
            </div>

            {hashesExistentes.size > 0 && (
              <div className="card mt-5" style={{ background: "rgba(124,106,247,0.03)", borderColor: "rgba(124,106,247,0.15)" }}>
                <div className="text-xs text-violet-l font-bold mb-1">📊 Histórico</div>
                <div className="text-[10px] text-muted">
                  Você já importou <strong className="text-white">{hashesExistentes.size}</strong> movimentações anteriormente.
                  Movimentações duplicadas serão automaticamente ignoradas.
                </div>
              </div>
            )}
          </>
        )}

        {/* Preview */}
        {arquivo && parsed.length > 0 && (
          <>
            <div className="card mb-5">
              <div className="flex justify-between items-center mb-3">
                <div>
                  <div className="text-[10px] text-teal uppercase tracking-[2px] font-bold mb-1">
                    ✅ Arquivo carregado
                  </div>
                  <div className="text-white font-bold text-sm">{arquivo.name}</div>
                  <div className="text-[10px] text-muted">
                    {parsed.length} movimentações no arquivo ·
                    {" "}{movsParaImportar.length} novas ·
                    {" "}{movsJaImportadas} já importadas
                    {movsIgnoradasPorData > 0 && ` · ${movsIgnoradasPorData} ignoradas por data`}
                  </div>
                </div>
                <button onClick={() => { setArquivo(null); setParsed([]); }}
                  className="text-xs text-muted hover:text-white bg-transparent border-none cursor-pointer">
                  ✕ Trocar arquivo
                </button>
              </div>

              <div className="pt-3 border-t border-white/[.06]">
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input type="checkbox" checked={useDataLimite}
                    onChange={e => setUseDataLimite(e.target.checked)}
                    className="w-4 h-4 cursor-pointer" />
                  <span className="text-xs text-violet-l font-bold">
                    📅 Ignorar movimentações anteriores a uma data
                  </span>
                </label>
                {useDataLimite && (
                  <input className="input" type="date" value={dataLimite}
                    onChange={e => setDataLimite(e.target.value)} />
                )}
              </div>
            </div>

            {movsParaImportar.length === 0 ? (
              <div className="card text-center py-10">
                <div className="text-4xl mb-2">✅</div>
                <div className="text-white font-bold">Tudo já está importado!</div>
                <div className="text-[10px] text-muted mt-1">
                  Todas as movimentações deste arquivo já foram processadas anteriormente.
                </div>
              </div>
            ) : (
              <>
                <div className="card mb-5">
                  <div className="text-[10px] text-amber uppercase tracking-[2px] font-bold mb-3">
                    📊 Resumo por ativo ({tickers.length} tickers)
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {tickers.map(ticker => {
                      const movs = porTicker[ticker];
                      const compras = movs.filter(m => m.tipo === "compra").reduce((s, m) => s + m.quantidade, 0);
                      const vendas = movs.filter(m => m.tipo === "venda").reduce((s, m) => s + m.quantidade, 0);
                      const bonif = movs.filter(m => m.tipo === "bonificacao" || m.tipo === "fracao_ganho").reduce((s, m) => s + m.quantidade, 0);
                      const divs = movs.filter(m => m.tipo === "dividendo" || m.tipo === "jcp").reduce((s, m) => s + m.valor, 0);
                      const isNovo = !tickersExistentes.has(ticker);

                      return (
                        <div key={ticker} className="p-3 rounded-xl"
                          style={{
                            background: isNovo ? "rgba(251,191,36,0.05)" : "rgba(255,255,255,0.02)",
                            border: `1px solid ${isNovo ? "rgba(251,191,36,0.25)" : "rgba(255,255,255,0.06)"}`
                          }}>
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-bold text-white text-sm">{ticker}</span>
                            {isNovo && (
                              <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full"
                                style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24" }}>
                                NOVO
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-muted space-y-0.5">
                            {compras > 0 && <div>🛒 +{compras} compradas</div>}
                            {vendas > 0 && <div className="text-rose">💸 -{vendas} vendidas</div>}
                            {bonif > 0 && <div className="text-amber">🎁 +{bonif} bonificação</div>}
                            {divs > 0 && <div className="text-violet-l">💰 {brl(divs)} em proventos</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="card mb-5">
                  <div className="text-[10px] text-amber uppercase tracking-[2px] font-bold mb-3">
                    📋 Detalhes {movsParaImportar.length > 30 ? `(primeiras 30 de ${movsParaImportar.length})` : ""}
                  </div>
                  <div className="space-y-1 max-h-96 overflow-y-auto">
                    {movsParaImportar.slice(0, 30).map((m, i) => (
                      <div key={i} className="flex justify-between items-center py-2 px-3 rounded-lg text-xs"
                        style={{ background: "rgba(255,255,255,0.02)" }}>
                        <div className="flex items-center gap-3 flex-1">
                          <span className="text-[10px] text-muted w-20">{m.data}</span>
                          <span className="font-bold text-white w-16">{m.ticker}</span>
                          <span className="text-[10px]" style={{ color: TIPO_COR[m.tipo] }}>
                            {TIPO_LABEL[m.tipo]}
                          </span>
                          {m.quantidade > 0 && <span className="text-[10px] text-muted">× {m.quantidade}</span>}
                        </div>
                        <div className="font-mono text-[10px] font-bold">{brl(m.valor)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {novosTickers.length > 0 && (
                  <div className="card mb-5" style={{ background: "rgba(251,191,36,0.05)", borderColor: "rgba(251,191,36,0.2)" }}>
                    <div className="text-xs text-amber font-bold mb-1">⚠️ Ativos novos detectados</div>
                    <div className="text-[10px] text-muted">
                      {novosTickers.join(", ")} serão criados automaticamente na Carteira.
                      Depois da importação, edite para ajustar nome, cotação, DPA e DY na página /investimentos.
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <button onClick={() => { setArquivo(null); setParsed([]); }}
                    disabled={importando}
                    className="bg-surface2 text-muted text-xs font-bold px-5 py-3 rounded-lg cursor-pointer disabled:opacity-50"
                    style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
                    Cancelar
                  </button>
                  <button onClick={confirmarImportacao} disabled={importando}
                    className="flex-1 bg-violet text-white text-xs font-bold px-5 py-3 rounded-lg border-none cursor-pointer hover:opacity-90 transition-all disabled:opacity-50">
                    {importando ? "⏳ Importando..." : `✅ Confirmar Importação (${movsParaImportar.length} movs)`}
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {/* Resultado final */}
        {resultado && (
          <div className="card" style={{ background: "rgba(52,211,153,0.05)", borderColor: "rgba(52,211,153,0.3)" }}>
            <div className="text-3xl mb-2">🎉</div>
            <div className="font-display text-xl font-bold text-teal mb-3">Importação concluída!</div>
            <div className="space-y-1 text-sm text-white">
              <div>✅ <strong>{resultado.sucesso}</strong> movimentações importadas com sucesso</div>
              {resultado.ignorados > 0 && (
                <div className="text-muted">⏭️ {resultado.ignorados} ignoradas (duplicatas ou fora do período)</div>
              )}
              {resultado.novos_tickers.length > 0 && (
                <div className="text-amber">
                  ⚠️ Ativos novos criados: {resultado.novos_tickers.join(", ")}.
                  {" "}<a href="/investimentos" className="underline">Ajustar na Carteira →</a>
                </div>
              )}
            </div>
            <div className="mt-4 text-[10px] text-muted">
              Carteira, preços médios, dividendo mensal e metas foram atualizados automaticamente.
            </div>
            <button onClick={() => setResultado(null)}
              className="mt-4 bg-teal text-black text-xs font-bold px-4 py-2 rounded-lg border-none cursor-pointer">
              Importar outro arquivo
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
