"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Sidebar from "@/components/Sidebar";
import { brl, calcDividendoMensal } from "@/lib/dividends";
import type { Ativo } from "@/types";

type SortKey = "retorno_pct" | "dy" | "div_mensal" | "invest" | "atual";

export default function Ranking() {
  const [user, setUser] = useState<any>(null);
  const [ativos, setAtivos] = useState<Ativo[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("div_mensal");
  const [loadingCot, setLoadingCot] = useState(false);
  const router = useRouter();
  const sb = createClient();

  const load = useCallback(async () => {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { router.push("/auth"); return; }
    setUser(user);
    const { data } = await sb.from("ativos").select("*").eq("user_id", user.id);
    setAtivos(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function atualizarCotacoes() {
    setLoadingCot(true);
    const tickers = ativos.map(a => a.ticker).join(",");
    try {
      const res = await fetch(`/api/cotacoes?tickers=${tickers}`);
      const cotacoes = await res.json();
      for (const c of cotacoes) {
        const ativo = ativos.find(a => a.ticker === c.symbol);
        if (ativo) {
          await sb.from("ativos").update({
            cotacao: c.regularMarketPrice,
            atual: Number(ativo.cotas) * c.regularMarketPrice,
          }).eq("id", ativo.id);
        }
      }
      await load();
    } finally {
      setLoadingCot(false);
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="text-violet-l animate-pulse">Carregando...</div>
    </div>
  );

  const divMensal  = calcDividendoMensal(ativos);
  const patrimonio = ativos.reduce((s, a) => s + Number(a.atual), 0);
  const totalInv   = ativos.reduce((s, a) => s + Number(a.invest), 0);

  const SUBTIPO_COLOR: Record<string, string> = {
    "Renda Blindada": "#60a5fa", "Renda Turbinada": "#f87171",
    "Deep Value": "#fbbf24", "Núcleo": "#34d399", "Papel": "#a89ef7",
    "Satélite": "#f59e0b",
  };

  const ranked = [...ativos]
    .filter(a => Number(a.invest) > 0 || Number(a.cotas) > 0)
    .map(a => ({
      ...a,
      retorno_pct: Number(a.invest) > 0 ? ((Number(a.atual) - Number(a.invest)) / Number(a.invest)) * 100 : 0,
    }))
    .sort((a, b) => Number(b[sortKey]) - Number(a[sortKey]));

  const SORT_OPTS: { key: SortKey; label: string }[] = [
    { key: "div_mensal",   label: "💰 Dividendo/mês" },
    { key: "dy",           label: "📈 DY %" },
    { key: "retorno_pct",  label: "🏆 Retorno %" },
    { key: "invest",       label: "💵 Investido" },
    { key: "atual",        label: "📊 Valor Atual" },
  ];

  const medal = (i: number) => i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}º`;

  return (
    <div className="flex bg-bg min-h-screen">
      <Sidebar userEmail={user?.email} healthPct={0} patrimoniTotal={patrimonio}
        dividendoMensal={divMensal} metaDividendo={100} />
      <main className="ml-56 flex-1 p-7">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="font-display text-2xl font-black text-white">Ranking de Ativos</h1>
            <p className="text-muted text-[9px] tracking-[2px] uppercase mt-0.5">
              {ranked.length} ativos · Retorno total: {brl(patrimonio - totalInv)}
            </p>
          </div>
          <button onClick={atualizarCotacoes} disabled={loadingCot}
            className="bg-transparent border border-[rgba(52,211,153,0.2)] text-teal text-xs font-bold px-4 py-2.5 rounded-lg cursor-pointer hover:bg-[rgba(52,211,153,0.1)] transition-all disabled:opacity-50">
            {loadingCot ? "⏳ Atualizando..." : "🔄 Atualizar Cotações"}
          </button>
        </div>

        <div className="flex gap-2 mb-5 flex-wrap">
          {SORT_OPTS.map(o => (
            <button key={o.key} onClick={() => setSortKey(o.key)}
              className={`px-3 py-2 rounded-lg text-[10px] font-bold transition-all cursor-pointer border ${
                sortKey === o.key
                  ? "bg-[rgba(245,158,11,0.15)] border-[rgba(245,158,11,0.4)] text-amber"
                  : "bg-surface border-white/[.06] text-muted hover:border-[rgba(245,158,11,0.2)]"
              }`}>
              {o.label}
            </button>
          ))}
        </div>

        <div className="card overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/[.06]">
                {["#","Ticker","Estratégia","Cotas","Investido","Atual","Retorno","DY","Div./mês"].map(h => (
                  <th key={h} className="text-left py-2.5 px-3 text-[9px] uppercase tracking-[1.5px] text-muted font-bold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ranked.map((a, i) => {
                const retorno    = Number(a.atual) - Number(a.invest);
                const retornoPct = Number(a.invest) > 0 ? (retorno / Number(a.invest)) * 100 : 0;
                const cor        = SUBTIPO_COLOR[a.subtipo] || "#94a3b8";
                return (
                  <tr key={a.id} className={`border-b border-white/[.03] hover:bg-white/[.02] transition-colors ${i < 3 ? "bg-[rgba(245,158,11,0.02)]" : ""}`}>
                    <td className="py-3 px-3 font-bold text-lg">{medal(i)}</td>
                    <td className="py-3 px-3">
                      <div className="font-display font-black" style={{ color: cor }}>{a.ticker}</div>
                      <div className="text-[9px] text-muted">{a.nome}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: cor+"18", color: cor }}>
                        {a.subtipo || a.tipo}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-bold">{Number(a.cotas)}</td>
                    <td className="py-3 px-3 font-mono">{brl(Number(a.invest))}</td>
                    <td className="py-3 px-3 font-mono font-bold" style={{ color: Number(a.cotacao) > 0 ? "#e2e8f0" : "#64748b" }}>
                      {Number(a.cotacao) > 0 ? brl(Number(a.atual)) : "—"}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`font-bold ${retorno >= 0 ? "text-teal" : "text-rose"}`}>
                        {retorno >= 0 ? "+" : ""}{retornoPct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-amber font-bold">{Number(a.dy).toFixed(1)}%</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`font-bold font-mono ${Number(a.div_mensal) > 0 ? "text-teal" : "text-muted"}`}>
                        {brl(Number(a.div_mensal))}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
