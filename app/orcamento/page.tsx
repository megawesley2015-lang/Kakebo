"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Sidebar from "@/components/Sidebar";
import { brl, calcDividendoMensal } from "@/lib/dividends";
import type { Lancamento, Ativo, Orcamento } from "@/types";

const CATS = ["Gastos Gerais","Cartão de Crédito","Assinatura","Outro"];
const MESES_F = ["","Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const CAT_ICON: Record<string, string> = {
  "Gastos Gerais": "🏠",
  "Cartão de Crédito": "💳",
  "Assinatura": "📱",
  "Outro": "📦",
};

export default function OrcamentoPage() {
  const [user, setUser] = useState<any>(null);
  const [lancs, setLancs] = useState<Lancamento[]>([]);
  const [ativos, setAtivos] = useState<Ativo[]>([]);
  const [orcamento, setOrcamento] = useState<Orcamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [ano] = useState(new Date().getFullYear());
  const [editando, setEditando] = useState<string | null>(null);
  const [novoLimite, setNovoLimite] = useState("");
  const router = useRouter();
  const sb = createClient();

  const load = useCallback(async () => {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { router.push("/auth"); return; }
    setUser(user);
    const [l, a, o] = await Promise.all([
      sb.from("lancamentos").select("*").eq("user_id", user.id),
      sb.from("ativos").select("*").eq("user_id", user.id),
      sb.from("orcamento").select("*").eq("user_id", user.id),
    ]);
    setLancs(l.data || []);
    setAtivos(a.data || []);
    setOrcamento(o.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function salvarLimite(cat: string) {
    const uid = user?.id;
    const limite = +novoLimite;
    if (!limite || limite <= 0) return;
    const existing = orcamento.find(o => o.categoria === cat && o.mes === mes && o.ano === ano);
    if (existing) {
      await sb.from("orcamento").update({ limite }).eq("id", existing.id);
    } else {
      await sb.from("orcamento").insert({ user_id: uid, categoria: cat, limite, mes, ano });
    }
    setEditando(null);
    setNovoLimite("");
    await load();
  }

  async function removerLimite(cat: string) {
    const existing = orcamento.find(o => o.categoria === cat && o.mes === mes && o.ano === ano);
    if (existing) {
      await sb.from("orcamento").delete().eq("id", existing.id);
      await load();
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="text-violet-l animate-pulse">Carregando...</div>
    </div>
  );

  const divMensal  = calcDividendoMensal(ativos);
  const patrimonio = ativos.reduce((s, a) => s + Number(a.atual), 0);

  const gastosPorCat = CATS.map(cat => {
    const gasto  = lancs.filter(l => l.cat === cat && l.mes === mes).reduce((s, l) => s + Number(l.valor), 0);
    const orc    = orcamento.find(o => o.categoria === cat && o.mes === mes && o.ano === ano);
    const limite = orc?.limite || 0;
    const pct    = limite > 0 ? Math.min(100, (gasto / limite) * 100) : 0;
    const status = !limite ? "sem_limite" : pct >= 100 ? "estourado" : pct >= 80 ? "atencao" : "ok";
    return { cat, gasto, limite, pct, status };
  });

  const totalGasto  = gastosPorCat.reduce((s, c) => s + c.gasto, 0);
  const totalLimite = gastosPorCat.reduce((s, c) => s + c.limite, 0);
  const pctTotal    = totalLimite > 0 ? Math.min(100, (totalGasto / totalLimite) * 100) : 0;

  const statusColor: Record<string, string> = {
    sem_limite: "#64748b",
    ok:         "#34d399",
    atencao:    "#fbbf24",
    estourado:  "#f87171",
  };

  const statusLabel: Record<string, string> = {
    sem_limite: "Sem limite definido",
    ok:         "✅ Dentro do limite",
    atencao:    "⚠️ Atenção — 80%+",
    estourado:  "🚨 Limite estourado!",
  };

  return (
    <div className="flex bg-bg min-h-screen">
      <Sidebar userEmail={user?.email} healthPct={0} patrimoniTotal={patrimonio}
        dividendoMensal={divMensal} metaDividendo={100} />
      <main className="ml-56 flex-1 p-7">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="font-display text-2xl font-black text-white">Orçamento Mensal</h1>
            <p className="text-muted text-[9px] tracking-[2px] uppercase mt-0.5">
              Controle de gastos por categoria
            </p>
          </div>
          <select className="input w-40" value={mes} onChange={e => setMes(+e.target.value)}>
            {MESES_F.slice(1).map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>

        {/* KPI geral */}
        <div className="card mb-5" style={{ borderColor: "rgba(124,106,247,0.2)" }}>
          <div className="flex justify-between items-center mb-3">
            <span className="text-[10px] text-violet-l uppercase tracking-[2px] font-bold">
              {MESES_F[mes]} — Resumo Geral
            </span>
            <div className="text-right">
              <span className="font-display font-bold text-xl"
                style={{ color: pctTotal >= 100 ? "#f87171" : pctTotal >= 80 ? "#fbbf24" : "#a89ef7" }}>
                {brl(totalGasto)}
              </span>
              {totalLimite > 0 && <span className="text-muted text-xs ml-1">/ {brl(totalLimite)}</span>}
            </div>
          </div>
          {totalLimite > 0 ? (
            <>
              <div className="h-2.5 bg-white/5 rounded-full overflow-hidden mb-1.5">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${pctTotal}%`,
                    background: pctTotal >= 100 ? "#f87171" : pctTotal >= 80 ? "#fbbf24" : "#a89ef7",
                  }} />
              </div>
              <div className="flex justify-between text-[9px] text-muted">
                <span>{pctTotal.toFixed(1)}% do limite total</span>
                <span>
                  {pctTotal < 100 ? `Sobra ${brl(totalLimite - totalGasto)}` : `Estouro de ${brl(totalGasto - totalLimite)}`}
                </span>
              </div>
            </>
          ) : (
            <div className="text-[10px] text-muted">Defina limites por categoria abaixo para ver o resumo visual.</div>
          )}
        </div>

        {/* Cards por categoria */}
        <div className="grid grid-cols-2 gap-4">
          {gastosPorCat.map(c => {
            const cor = statusColor[c.status];
            return (
              <div key={c.cat} className="card" style={{ borderColor: cor+"25" }}>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{CAT_ICON[c.cat] || "📦"}</span>
                    <div>
                      <div className="font-bold text-white text-sm">{c.cat}</div>
                      <div className="text-[9px]" style={{ color: cor }}>
                        {statusLabel[c.status]}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display font-bold text-base" style={{ color: cor }}>
                      {brl(c.gasto)}
                    </div>
                    {c.limite > 0 && (
                      <div className="text-[9px] text-muted">/ {brl(c.limite)}</div>
                    )}
                  </div>
                </div>

                {c.limite > 0 && (
                  <>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden mb-1.5">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${c.pct}%`, background: cor }} />
                    </div>
                    <div className="flex justify-between text-[9px] text-muted mb-3">
                      <span>{c.pct.toFixed(1)}%</span>
                      <span>
                        {c.pct < 100 ? `Sobram ${brl(c.limite - c.gasto)}` : `+${brl(c.gasto - c.limite)}`}
                      </span>
                    </div>
                  </>
                )}

                {editando === c.cat ? (
                  <div className="flex gap-2">
                    <input className="input text-xs flex-1" type="number" step="0.01"
                      placeholder="Novo limite R$" value={novoLimite}
                      onChange={e => setNovoLimite(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && salvarLimite(c.cat)}
                      autoFocus />
                    <button onClick={() => salvarLimite(c.cat)}
                      className="bg-violet text-white text-[10px] font-bold px-3 py-2 rounded-lg border-none cursor-pointer">✓</button>
                    <button onClick={() => { setEditando(null); setNovoLimite(""); }}
                      className="bg-transparent text-muted text-[10px] font-bold px-3 py-2 rounded-lg cursor-pointer"
                      style={{ border: "1px solid rgba(255,255,255,0.08)" }}>✕</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => { setEditando(c.cat); setNovoLimite(String(c.limite || "")); }}
                      className="flex-1 text-[9px] text-muted hover:text-white bg-transparent py-1.5 rounded-lg cursor-pointer transition-all"
                      style={{ border: "1px solid rgba(255,255,255,0.04)" }}>
                      {c.limite > 0 ? "✏️ Alterar limite" : "＋ Definir limite"}
                    </button>
                    {c.limite > 0 && (
                      <button onClick={() => removerLimite(c.cat)}
                        className="text-rose hover:opacity-70 bg-transparent px-3 py-1.5 rounded-lg cursor-pointer transition-all text-[9px]"
                        style={{ border: "1px solid rgba(248,113,113,0.15)" }}>
                        🗑
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Dica */}
        <div className="card mt-5" style={{ background: "rgba(52,211,153,0.03)", borderColor: "rgba(52,211,153,0.15)" }}>
          <div className="text-xs text-teal font-bold mb-1">💡 Como usar</div>
          <p className="text-[10px] text-muted">
            Defina um limite por categoria clicando em cada card. O app calcula automaticamente
            quanto você gastou vs o limite com base nos seus <strong className="text-white">lançamentos do mês selecionado</strong>.
            Quando ultrapassar 80% do limite, aparece um aviso amarelo. Ao estourar, fica vermelho.
            Os limites são mensais e ficam salvos para cada mês/ano separadamente.
          </p>
        </div>
      </main>
    </div>
  );
}
