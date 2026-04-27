"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Sidebar from "@/components/Sidebar";
import { brl, calcDividendoMensal } from "@/lib/dividends";
import type { Ativo, AgendaDividendo } from "@/types";

const MESES_A = ["","Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const MESES_F = ["","Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

function isFII(ticker: string): boolean {
  return /\d11$/.test(ticker);
}

const MESES_ACOES = [3, 6, 9, 12];

function gerarProjecao(ativos: Ativo[], userId: string, ano: number) {
  const entries: any[] = [];
  for (const at of ativos.filter(a => Number(a.cotas) > 0 && Number(a.dpa) > 0)) {
    if (isFII(at.ticker)) {
      for (let m = 1; m <= 12; m++) {
        entries.push({
          user_id: userId, ticker: at.ticker, mes: m, ano,
          valor_dpa: at.dpa, cotas: at.cotas,
        });
      }
    } else {
      const dpaTrimestral = Number(at.dpa) * 3;
      for (const m of MESES_ACOES) {
        entries.push({
          user_id: userId, ticker: at.ticker, mes: m, ano,
          valor_dpa: dpaTrimestral, cotas: at.cotas,
        });
      }
    }
  }
  return entries;
}

export default function Agenda() {
  const [user, setUser] = useState<any>(null);
  const [ativos, setAtivos] = useState<Ativo[]>([]);
  const [agenda, setAgenda] = useState<AgendaDividendo[]>([]);
  const [mesSel, setMesSel] = useState(new Date().getMonth() + 1);
  const [loading, setLoading] = useState(true);
  const [recalculando, setRecalculando] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ticker: "", data_ex: "", data_pag: "", valor_dpa: "", cotas: "" });
  const router = useRouter();
  const sb = createClient();

  const load = useCallback(async () => {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { router.push("/auth"); return; }
    setUser(user);
    const [a, ag] = await Promise.all([
      sb.from("ativos").select("*").eq("user_id", user.id),
      sb.from("agenda_dividendos").select("*").eq("user_id", user.id),
    ]);
    setAtivos(a.data || []);
    if ((ag.data || []).length === 0 && (a.data || []).length > 0) {
      const gerados = gerarProjecao(a.data || [], user.id, new Date().getFullYear());
      if (gerados.length > 0) {
        await sb.from("agenda_dividendos").insert(gerados);
        const { data: ag2 } = await sb.from("agenda_dividendos").select("*").eq("user_id", user.id);
        setAgenda(ag2 || []);
      }
    } else {
      setAgenda(ag.data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function recalcularAgenda() {
    if (!confirm("Isso vai apagar a agenda atual e recriar baseado nos ativos. Continuar?")) return;
    setRecalculando(true);
    try {
      const ano = new Date().getFullYear();
      await sb.from("agenda_dividendos").delete()
        .eq("user_id", user.id)
        .eq("ano", ano);
      const gerados = gerarProjecao(ativos, user.id, ano);
      if (gerados.length > 0) {
        await sb.from("agenda_dividendos").insert(gerados);
      }
      await load();
    } finally {
      setRecalculando(false);
    }
  }

  async function salvarItem() {
    const ativo = ativos.find(a => a.ticker === form.ticker);
    const dataPag = form.data_pag || form.data_ex;
    const mes = dataPag ? new Date(dataPag).getMonth() + 1 : mesSel;
    await sb.from("agenda_dividendos").insert({
      user_id: user.id, ticker: form.ticker, mes, ano: new Date().getFullYear(),
      data_ex: form.data_ex || null, data_pag: form.data_pag || null,
      valor_dpa: +form.valor_dpa, cotas: +form.cotas || Number(ativo?.cotas || 0),
    });
    setShowModal(false);
    setForm({ ticker: "", data_ex: "", data_pag: "", valor_dpa: "", cotas: "" });
    await load();
  }

  if (loading) return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="text-violet-l animate-pulse">Carregando...</div>
    </div>
  );

  const ano = new Date().getFullYear();
  const divMensal = calcDividendoMensal(ativos);
  const patrimonio = ativos.reduce((s, a) => s + Number(a.atual), 0);

  const ativosFII = ativos.filter(a => isFII(a.ticker) && Number(a.cotas) > 0 && Number(a.dpa) > 0).length;
  const ativosAcao = ativos.filter(a => !isFII(a.ticker) && Number(a.cotas) > 0 && Number(a.dpa) > 0).length;

  const porMes = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const itens = agenda.filter(ag => ag.mes === m && ag.ano === ano);
    const total = itens.reduce((s, ag) => s + Number(ag.valor_dpa) * Number(ag.cotas), 0);
    return { mes: m, itens, total };
  });

  const totalAnual = porMes.reduce((s, m) => s + m.total, 0);
  const mesDados = porMes[mesSel - 1];
  const mesMaior = porMes.reduce((max, m) => m.total > max.total ? m : max, porMes[0]);
  const mesMenor = porMes.filter(m => m.total > 0).reduce((min, m) => m.total < min.total ? m : min, porMes.find(m => m.total > 0) || porMes[0]);

  return (
    <div className="flex bg-bg min-h-screen">
      <Sidebar userEmail={user?.email} healthPct={0} patrimoniTotal={patrimonio}
        dividendoMensal={divMensal} metaDividendo={100} />
      <main className="ml-56 flex-1 p-7">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="font-display text-2xl font-black text-white">Agenda de Dividendos</h1>
            <p className="text-muted text-[9px] tracking-[2px] uppercase mt-0.5">
              {ano} · Projeção anual: {brl(totalAnual)} · {ativosFII} FIIs (mensal) · {ativosAcao} Ações (trimestral)
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={recalcularAgenda} disabled={recalculando}
              className="bg-transparent text-violet-l text-xs font-bold px-4 py-2.5 rounded-lg cursor-pointer transition-all disabled:opacity-50"
              style={{ border: "1px solid rgba(124,106,247,0.3)" }}>
              {recalculando ? "⏳ Recalculando..." : "🔄 Recalcular Agenda"}
            </button>
            <button onClick={() => setShowModal(true)}
              className="bg-transparent text-amber text-xs font-bold px-4 py-2.5 rounded-lg cursor-pointer transition-all"
              style={{ border: "1px solid rgba(245,158,11,0.3)" }}>
              ＋ Lançar Recebimento
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          <div className="card">
            <div className="text-[9px] text-amber uppercase tracking-[2px] mb-1">📅 Projeção Anual</div>
            <div className="font-display text-xl font-bold text-amber">{brl(totalAnual)}</div>
          </div>
          <div className="card">
            <div className="text-[9px] text-teal uppercase tracking-[2px] mb-1">📊 Média Mensal</div>
            <div className="font-display text-xl font-bold text-teal">{brl(totalAnual / 12)}</div>
          </div>
          <div className="card">
            <div className="text-[9px] text-violet-l uppercase tracking-[2px] mb-1">🏆 Melhor Mês</div>
            <div className="font-display text-xl font-bold text-violet-l">{MESES_A[mesMaior.mes]}</div>
            <div className="text-[9px] text-muted">{brl(mesMaior.total)}</div>
          </div>
          <div className="card">
            <div className="text-[9px] text-muted uppercase tracking-[2px] mb-1">💸 Menor Mês</div>
            <div className="font-display text-xl font-bold text-muted">{MESES_A[mesMenor.mes]}</div>
            <div className="text-[9px] text-muted">{brl(mesMenor.total)}</div>
          </div>
        </div>

        {/* Legenda */}
        <div className="card mb-5" style={{ background: "rgba(124,106,247,0.05)", borderColor: "rgba(124,106,247,0.15)" }}>
          <div className="flex items-center gap-4 text-[10px]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber"></span>
              <span className="text-muted">FIIs: pagam todo mês</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-violet-l"></span>
              <span className="text-muted">Ações: pagam trimestralmente (Mar, Jun, Set, Dez)</span>
            </div>
          </div>
        </div>

        {/* Grid 12 meses */}
        <div className="grid grid-cols-6 gap-2 mb-5">
          {porMes.map(m => {
            const temAcao = m.itens.some(ag => !isFII(ag.ticker));
            return (
              <button key={m.mes} onClick={() => setMesSel(m.mes)}
                className="p-3 rounded-xl text-left transition-all cursor-pointer border relative"
                style={{
                  background: mesSel === m.mes ? "rgba(245,158,11,0.15)" : "#0f0e1a",
                  borderColor: mesSel === m.mes ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.05)",
                }}>
                {temAcao && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-violet-l"></span>
                )}
                <div className="text-[9px] font-bold mb-1"
                  style={{ color: mesSel === m.mes ? "#f59e0b" : "#64748b" }}>
                  {MESES_A[m.mes]}
                </div>
                <div className="font-display font-bold text-sm"
                  style={{ color: m.total > 0 ? "#f59e0b" : "#334155" }}>
                  {brl(m.total)}
                </div>
                <div className="text-[8px] text-muted mt-0.5">{m.itens.length}×</div>
              </button>
            );
          })}
        </div>

        {/* Detalhe mês */}
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <span className="text-[10px] text-amber uppercase tracking-[2px] font-bold">
              {MESES_F[mesSel]} — Recebimentos
            </span>
            <span className="font-display font-bold text-amber text-lg">{brl(mesDados.total)}</span>
          </div>
          {mesDados.itens.length === 0 ? (
            <div className="text-center py-10 text-muted text-xs">
              Nenhum dividendo projetado para {MESES_F[mesSel]}.
            </div>
          ) : (
            <div className="space-y-2">
              {mesDados.itens
                .sort((a, b) => Number(b.valor_dpa) * Number(b.cotas) - Number(a.valor_dpa) * Number(a.cotas))
                .map(ag => {
                  const total = Number(ag.valor_dpa) * Number(ag.cotas);
                  const fii = isFII(ag.ticker);
                  return (
                    <div key={ag.id} className="flex items-center justify-between p-3 rounded-xl"
                      style={{
                        background: fii ? "rgba(245,158,11,0.05)" : "rgba(124,106,247,0.05)",
                        border: `1px solid ${fii ? "rgba(245,158,11,0.1)" : "rgba(124,106,247,0.1)"}`
                      }}>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                          style={{ background: fii ? "rgba(245,158,11,0.1)" : "rgba(124,106,247,0.1)" }}>
                          <span className="font-display font-black text-[10px]"
                            style={{ color: fii ? "#f59e0b" : "#a89ef7" }}>
                            {ag.ticker.slice(0, 5)}
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm">{ag.ticker}</span>
                            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full"
                              style={{
                                background: fii ? "rgba(245,158,11,0.15)" : "rgba(124,106,247,0.15)",
                                color: fii ? "#f59e0b" : "#a89ef7"
                              }}>
                              {fii ? "FII" : "AÇÃO"}
                            </span>
                          </div>
                          <div className="text-[9px] text-muted">
                            {Number(ag.cotas)} cotas × R$ {Number(ag.valor_dpa).toFixed(2)}
                            {fii ? " (mensal)" : " (trimestral)"}
                            {ag.data_pag && ` · Pag: ${new Date(ag.data_pag).toLocaleDateString("pt-BR")}`}
                          </div>
                        </div>
                      </div>
                      <div className="font-display font-bold text-base"
                        style={{ color: fii ? "#f59e0b" : "#a89ef7" }}>
                        {brl(total)}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Dica */}
        <div className="card mt-5" style={{ background: "rgba(52,211,153,0.03)", borderColor: "rgba(52,211,153,0.15)" }}>
          <div className="text-xs text-teal font-bold mb-1">💡 Como funciona a projeção</div>
          <p className="text-[10px] text-muted">
            A agenda é recalculada automaticamente com base nos ativos da sua carteira.
            <strong className="text-amber"> FIIs</strong> distribuem dividendos todo mês.
            <strong className="text-violet-l"> Ações</strong> tipicamente pagam trimestralmente (Mar/Jun/Set/Dez).
            Ao registrar compra de cotas ou alterar DPA, clique em <strong>🔄 Recalcular Agenda</strong> para atualizar.
          </p>
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-5"
            onClick={e => e.target === e.currentTarget && setShowModal(false)}>
            <div className="bg-surface border border-white/[.08] rounded-2xl p-7 w-full max-w-md">
              <div className="font-display text-lg font-bold mb-5">📅 Novo Recebimento</div>
              <div className="space-y-3">
                <div>
                  <label className="label">Ativo *</label>
                  <select className="input" value={form.ticker} onChange={e => {
                    const a = ativos.find(x => x.ticker === e.target.value);
                    setForm(f => ({ ...f, ticker: e.target.value, valor_dpa: String(a?.dpa || ""), cotas: String(a?.cotas || "") }));
                  }}>
                    <option value="">Selecione...</option>
                    {ativos.map(a => <option key={a.id} value={a.ticker}>{a.ticker} — {a.nome}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">Data Ex-Dividendo</label>
                    <input className="input" type="date" value={form.data_ex} onChange={e => setForm(f => ({ ...f, data_ex: e.target.value }))} /></div>
                  <div><label className="label">Data de Pagamento</label>
                    <input className="input" type="date" value={form.data_pag} onChange={e => setForm(f => ({ ...f, data_pag: e.target.value }))} /></div>
                  <div><label className="label">DPA (R$) *</label>
                    <input className="input" type="number" step="0.01" value={form.valor_dpa} onChange={e => setForm(f => ({ ...f, valor_dpa: e.target.value }))} /></div>
                  <div><label className="label">Cotas</label>
                    <input className="input" type="number" value={form.cotas} onChange={e => setForm(f => ({ ...f, cotas: e.target.value }))} /></div>
                </div>
                {form.valor_dpa && form.cotas && (
                  <div className="rounded-lg p-3 text-xs text-amber"
                    style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
                    💰 Total a receber: <strong>{brl(+form.valor_dpa * +form.cotas)}</strong>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-white/[.06]">
                <button onClick={() => setShowModal(false)}
                  className="bg-surface2 text-muted text-xs font-bold px-4 py-2.5 rounded-lg cursor-pointer"
                  style={{ border: "1px solid rgba(255,255,255,0.06)" }}>Cancelar</button>
                <button onClick={salvarItem}
                  className="bg-amber text-black text-xs font-bold px-4 py-2.5 rounded-lg border-none cursor-pointer hover:opacity-90">
                  💾 Salvar
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
