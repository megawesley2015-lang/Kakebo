"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Sidebar from "@/components/Sidebar";
import { brl, calcDividendoMensal } from "@/lib/dividends";
import type { Ativo, Alerta } from "@/types";

export default function Alertas() {
  const [user, setUser] = useState<any>(null);
  const [ativos, setAtivos] = useState<Ativo[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingPrices, setCheckingPrices] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ticker: "", tipo: "abaixo" as "abaixo" | "acima", preco_alvo: "" });
  const [cotacoes, setCotacoes] = useState<Record<string, number>>({});
  const router = useRouter();
  const sb = createClient();

  const load = useCallback(async () => {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { router.push("/auth"); return; }
    setUser(user);
    const [a, al] = await Promise.all([
      sb.from("ativos").select("*").eq("user_id", user.id),
      sb.from("alertas").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);
    setAtivos(a.data || []);
    setAlertas(al.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function verificarPrecos() {
    setCheckingPrices(true);
    const tickersSet = new Set(alertas.filter(a => a.ativo).map(a => a.ticker));
    const tickers = Array.from(tickersSet).join(",");
    if (!tickers) { setCheckingPrices(false); return; }
    try {
      const res = await fetch(`/api/cotacoes?tickers=${tickers}`);
      const data = await res.json();
      const mapa: Record<string, number> = {};
      data.forEach((c: any) => { mapa[c.symbol] = c.regularMarketPrice; });
      setCotacoes(mapa);
      for (const alerta of alertas.filter(a => a.ativo && !a.disparado)) {
        const preco = mapa[alerta.ticker];
        if (!preco) continue;
        const disparar = alerta.tipo === "abaixo"
          ? preco <= Number(alerta.preco_alvo)
          : preco >= Number(alerta.preco_alvo);
        if (disparar) {
          await sb.from("alertas").update({ disparado: true }).eq("id", alerta.id);
        }
      }
      await load();
    } finally {
      setCheckingPrices(false);
    }
  }

  async function criarAlerta() {
    if (!form.ticker || !form.preco_alvo) return;
    await sb.from("alertas").insert({
      user_id: user.id, ticker: form.ticker,
      tipo: form.tipo, preco_alvo: +form.preco_alvo,
      ativo: true, disparado: false,
    });
    setShowModal(false);
    setForm({ ticker: "", tipo: "abaixo", preco_alvo: "" });
    await load();
  }

  async function excluirAlerta(id: number) {
    if (!confirm("Excluir este alerta?")) return;
    await sb.from("alertas").delete().eq("id", id);
    await load();
  }

  async function toggleAlerta(id: number, ativo: boolean) {
    await sb.from("alertas").update({ ativo: !ativo, disparado: false }).eq("id", id);
    await load();
  }

  if (loading) return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="text-violet-l animate-pulse">Carregando...</div>
    </div>
  );

  const divMensal  = calcDividendoMensal(ativos);
  const patrimonio = ativos.reduce((s, a) => s + Number(a.atual), 0);
  const alertasDisparados = alertas.filter(a => a.disparado);
  const alertasAtivos = alertas.filter(a => a.ativo && !a.disparado);
  const alertasPausados = alertas.filter(a => !a.ativo && !a.disparado);

  return (
    <div className="flex bg-bg min-h-screen">
      <Sidebar userEmail={user?.email} healthPct={0} patrimoniTotal={patrimonio}
        dividendoMensal={divMensal} metaDividendo={100} />
      <main className="ml-56 flex-1 p-7">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="font-display text-2xl font-black text-white">🔔 Alertas de Preço</h1>
            <p className="text-muted text-[9px] tracking-[2px] uppercase mt-0.5">
              {alertasAtivos.length} ativos · {alertasDisparados.length} disparados · {alertasPausados.length} pausados
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={verificarPrecos} disabled={checkingPrices || alertasAtivos.length === 0}
              className="bg-transparent text-teal text-xs font-bold px-4 py-2.5 rounded-lg cursor-pointer transition-all disabled:opacity-50"
              style={{ border: "1px solid rgba(52,211,153,0.2)" }}>
              {checkingPrices ? "⏳ Verificando..." : "🔄 Verificar Preços"}
            </button>
            <button onClick={() => setShowModal(true)}
              className="bg-violet text-white text-xs font-bold px-4 py-2.5 rounded-lg border-none cursor-pointer hover:opacity-90 transition-all">
              ＋ Novo Alerta
            </button>
          </div>
        </div>

        {/* Alertas disparados */}
        {alertasDisparados.length > 0 && (
          <div className="mb-5">
            <div className="text-[10px] text-rose uppercase tracking-[2px] font-bold mb-3">
              🚨 Alertas Disparados
            </div>
            <div className="space-y-2">
              {alertasDisparados.map(al => {
                const preco = cotacoes[al.ticker];
                return (
                  <div key={al.id} className="p-4 rounded-xl flex items-center justify-between"
                    style={{ background: "rgba(248,113,113,0.05)", border: "1px solid rgba(248,113,113,0.3)" }}>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🚨</span>
                      <div>
                        <div className="font-bold text-white">
                          <span className="text-rose font-black">{al.ticker}</span>
                          {" "}
                          {al.tipo === "abaixo" ? "caiu abaixo de" : "subiu acima de"}
                          {" "}
                          <span className="text-rose">{brl(Number(al.preco_alvo))}</span>
                        </div>
                        {preco && (
                          <div className="text-[9px] text-muted">Preço atual: {brl(preco)}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => toggleAlerta(al.id, al.ativo)}
                        className="text-xs text-violet-l hover:underline bg-transparent border-none cursor-pointer">
                        Reativar
                      </button>
                      <button onClick={() => excluirAlerta(al.id)}
                        className="text-xs text-rose hover:underline bg-transparent border-none cursor-pointer">
                        Excluir
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Lista de todos alertas */}
        <div className="card">
          <div className="text-[10px] text-muted uppercase tracking-[2px] font-bold mb-4">
            Alertas Configurados
          </div>
          {alertas.length === 0 ? (
            <div className="text-center py-10 text-muted text-xs">
              Nenhum alerta configurado.{" "}
              <button onClick={() => setShowModal(true)}
                className="text-violet-l hover:underline bg-transparent border-none cursor-pointer">
                Criar agora →
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {alertas.map(al => {
                const preco = cotacoes[al.ticker];
                const ativoInfo = ativos.find(a => a.ticker === al.ticker);
                const cotacaoAtual = preco || Number(ativoInfo?.cotacao || 0);
                const distancia = cotacaoAtual > 0
                  ? ((Number(al.preco_alvo) - cotacaoAtual) / cotacaoAtual) * 100 : 0;

                const borderColor = al.disparado
                  ? "rgba(248,113,113,0.25)"
                  : !al.ativo
                    ? "rgba(255,255,255,0.05)"
                    : "rgba(255,255,255,0.06)";

                return (
                  <div key={al.id}
                    className="p-3 rounded-xl flex items-center justify-between transition-all"
                    style={{
                      background: al.disparado ? "rgba(248,113,113,0.05)" : !al.ativo ? "rgba(255,255,255,0.01)" : "rgba(255,255,255,0.02)",
                      border: `1px solid ${borderColor}`,
                      opacity: !al.ativo && !al.disparado ? 0.5 : 1,
                    }}>
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        al.disparado ? "bg-rose" :
                        al.ativo ? "bg-teal animate-pulse" :
                        "bg-muted"
                      }`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{al.ticker}</span>
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                            style={{
                              background: al.tipo === "abaixo" ? "rgba(52,211,153,0.1)" : "rgba(245,158,11,0.1)",
                              color: al.tipo === "abaixo" ? "#34d399" : "#f59e0b"
                            }}>
                            {al.tipo === "abaixo" ? "↓ abaixo de" : "↑ acima de"} {brl(Number(al.preco_alvo))}
                          </span>
                        </div>
                        <div className="text-[9px] text-muted">
                          {cotacaoAtual > 0 ? (
                            <>
                              Atual: {brl(cotacaoAtual)} ·{" "}
                              <span style={{ color: distancia >= 0 ? "#f59e0b" : "#34d399" }}>
                                {distancia >= 0 ? "+" : ""}{distancia.toFixed(1)}% para o alerta
                              </span>
                            </>
                          ) : (
                            <span>Clique em "Verificar Preços" para ver</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!al.disparado && (
                        <button onClick={() => toggleAlerta(al.id, al.ativo)}
                          className="text-[9px] font-bold px-2 py-1 rounded-lg bg-transparent cursor-pointer transition-all text-muted hover:text-white"
                          style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                          {al.ativo ? "Pausar" : "Ativar"}
                        </button>
                      )}
                      <button onClick={() => excluirAlerta(al.id)}
                        className="text-rose hover:opacity-70 bg-transparent border-none cursor-pointer text-xs">🗑</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Dica */}
        <div className="card mt-5" style={{ background: "rgba(52,211,153,0.03)", borderColor: "rgba(52,211,153,0.15)" }}>
          <div className="text-xs text-teal font-bold mb-1">💡 Como funciona</div>
          <p className="text-[10px] text-muted">
            Configure alertas para ser notificado quando um ativo atingir um preço-alvo.
            Use <strong className="text-teal">↓ abaixo de</strong> para <strong className="text-white">oportunidades de compra</strong>{" "}
            e <strong className="text-amber">↑ acima de</strong> para <strong className="text-white">realização de lucro</strong>.
            Clique em <strong>🔄 Verificar Preços</strong> para consultar via brapi.dev.
            Alertas disparados podem ser reativados.
          </p>
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-5"
            onClick={e => e.target === e.currentTarget && setShowModal(false)}>
            <div className="bg-surface border border-white/[.08] rounded-2xl p-7 w-full max-w-md">
              <div className="font-display text-lg font-bold mb-5">🔔 Novo Alerta</div>
              <div className="space-y-4">
                <div>
                  <label className="label">Ativo *</label>
                  <select className="input" value={form.ticker} onChange={e => setForm(f => ({ ...f, ticker: e.target.value }))}>
                    <option value="">Selecione...</option>
                    {ativos.map(a => (
                      <option key={a.id} value={a.ticker}>
                        {a.ticker} — {a.nome} {Number(a.cotacao) > 0 ? `(R$ ${Number(a.cotacao).toFixed(2)})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Tipo de alerta</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setForm(f => ({ ...f, tipo: "abaixo" }))}
                      className="py-3 rounded-xl text-xs font-bold cursor-pointer transition-all"
                      style={{
                        background: form.tipo === "abaixo" ? "rgba(52,211,153,0.15)" : "transparent",
                        border: `1px solid ${form.tipo === "abaixo" ? "rgba(52,211,153,0.4)" : "rgba(255,255,255,0.08)"}`,
                        color: form.tipo === "abaixo" ? "#34d399" : "#64748b"
                      }}>
                      ↓ Cair abaixo de
                    </button>
                    <button onClick={() => setForm(f => ({ ...f, tipo: "acima" }))}
                      className="py-3 rounded-xl text-xs font-bold cursor-pointer transition-all"
                      style={{
                        background: form.tipo === "acima" ? "rgba(245,158,11,0.15)" : "transparent",
                        border: `1px solid ${form.tipo === "acima" ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.08)"}`,
                        color: form.tipo === "acima" ? "#f59e0b" : "#64748b"
                      }}>
                      ↑ Subir acima de
                    </button>
                  </div>
                </div>

                <div>
                  <label className="label">Preço alvo (R$) *</label>
                  <input className="input text-lg font-bold" type="number" step="0.01"
                    placeholder="0,00" value={form.preco_alvo}
                    onChange={e => setForm(f => ({ ...f, preco_alvo: e.target.value }))} />
                  {form.ticker && form.preco_alvo && (() => {
                    const at = ativos.find(a => a.ticker === form.ticker);
                    const cot = Number(at?.cotacao || 0);
                    if (!cot) return null;
                    const dist = ((+form.preco_alvo - cot) / cot) * 100;
                    return (
                      <div className="text-[9px] text-muted mt-1.5">
                        Cotação atual: {brl(cot)} ·{" "}
                        <span style={{ color: dist >= 0 ? "#f59e0b" : "#34d399" }}>
                          {dist >= 0 ? "+" : ""}{dist.toFixed(1)}% de distância
                        </span>
                      </div>
                    );
                  })()}
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-white/[.06]">
                <button onClick={() => setShowModal(false)}
                  className="bg-surface2 text-muted text-xs font-bold px-4 py-2.5 rounded-lg cursor-pointer"
                  style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
                  Cancelar
                </button>
                <button onClick={criarAlerta}
                  disabled={!form.ticker || !form.preco_alvo}
                  className="bg-violet text-white text-xs font-bold px-4 py-2.5 rounded-lg border-none cursor-pointer hover:opacity-90 disabled:opacity-50">
                  🔔 Criar Alerta
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
