"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Sidebar from "@/components/Sidebar";
import { brl, calcDividendoMensal, calcMesesParaMeta } from "@/lib/dividends";
import type { Ativo, Meta } from "@/types";

export default function Simulador() {
  const [user, setUser] = useState<any>(null);
  const [ativos, setAtivos] = useState<Ativo[]>([]);
  const [metas, setMetas] = useState<Meta[]>([]);
  const [loading, setLoading] = useState(true);
  const [tickerSel, setTickerSel] = useState("");
  const [cotasExtra, setCotasExtra] = useState(0);
  const [aporteMensal, setAporteMensal] = useState(1500);
  const router = useRouter();
  const sb = createClient();

  const load = useCallback(async () => {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { router.push("/auth"); return; }
    setUser(user);
    const [a, m] = await Promise.all([
      sb.from("ativos").select("*").eq("user_id", user.id),
      sb.from("metas").select("*").eq("user_id", user.id),
    ]);
    setAtivos(a.data || []);
    setMetas(m.data || []);
    if ((a.data || []).length > 0) setTickerSel((a.data || [])[0].ticker);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="text-violet-l animate-pulse">Carregando...</div>
    </div>
  );

  const divAtual = calcDividendoMensal(ativos);
  const metaDiv  = metas.find(m => m.nome.toLowerCase().includes("dividendo"))?.objetivo || 100;
  const patrimonio = ativos.reduce((s, a) => s + Number(a.atual), 0);

  const ativoSel = ativos.find(a => a.ticker === tickerSel);
  const cotasSimuladas = Number(ativoSel?.cotas || 0) + cotasExtra;
  const divAtivoAtual  = Number(ativoSel?.cotas || 0) * Number(ativoSel?.dpa || 0);
  const divAtivoNovo   = cotasSimuladas * Number(ativoSel?.dpa || 0);
  const divTotalNovo   = divAtual - divAtivoAtual + divAtivoNovo;
  const valorCompra    = cotasExtra * Number(ativoSel?.cotacao || 0);
  const mesesMeta      = calcMesesParaMeta(divTotalNovo, metaDiv, aporteMensal, ativos);
  const progAtual      = Math.min(100, metaDiv > 0 ? (divAtual / metaDiv) * 100 : 0);
  const progNovo       = Math.min(100, metaDiv > 0 ? (divTotalNovo / metaDiv) * 100 : 0);

  const faltaDivTotal  = Math.max(0, metaDiv - divAtual);
  const cotasNecessarias = ativoSel && Number(ativoSel.dpa) > 0
    ? Math.ceil(faltaDivTotal / Number(ativoSel.dpa)) : 0;
  const investNecessario = cotasNecessarias * Number(ativoSel?.cotacao || 0);

  return (
    <div className="flex bg-bg min-h-screen">
      <Sidebar userEmail={user?.email} healthPct={0} patrimoniTotal={patrimonio}
        dividendoMensal={divAtual} metaDividendo={metaDiv} />
      <main className="ml-56 flex-1 p-7">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-black text-white">Simulador de Compra</h1>
          <p className="text-muted text-[9px] tracking-[2px] uppercase mt-0.5">
            Veja o impacto de cada compra no seu dividendo mensal
          </p>
        </div>

        <div className="grid grid-cols-2 gap-5">
          <div className="space-y-4">
            <div className="card">
              <div className="text-[10px] text-violet-l uppercase tracking-[2px] font-bold mb-4">🎮 Controles</div>
              <div className="space-y-4">
                <div>
                  <label className="label">Qual ativo você quer simular?</label>
                  <select className="input" value={tickerSel} onChange={e => { setTickerSel(e.target.value); setCotasExtra(0); }}>
                    {ativos.map(a => (
                      <option key={a.id} value={a.ticker}>
                        {a.ticker} — {a.nome} (DPA: R$ {Number(a.dpa).toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Quantas cotas você quer comprar?</label>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setCotasExtra(Math.max(0, cotasExtra - 1))}
                      className="w-9 h-9 rounded-lg bg-surface2 border border-white/[.08] text-white font-bold text-lg cursor-pointer hover:border-violet/40 transition-all flex-shrink-0">−</button>
                    <input className="input text-center text-lg font-bold" type="number" min="0" value={cotasExtra}
                      onChange={e => setCotasExtra(Math.max(0, +e.target.value))} />
                    <button onClick={() => setCotasExtra(cotasExtra + 1)}
                      className="w-9 h-9 rounded-lg bg-surface2 border border-white/[.08] text-white font-bold text-lg cursor-pointer hover:border-violet/40 transition-all flex-shrink-0">+</button>
                  </div>
                  {ativoSel && cotasExtra > 0 && (
                    <div className="text-[10px] text-muted mt-2">
                      Investimento: <span className="text-amber font-bold">{brl(valorCompra)}</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="label">Aporte mensal planejado (R$)</label>
                  <input className="input" type="number" value={aporteMensal}
                    onChange={e => setAporteMensal(+e.target.value)} />
                </div>
              </div>
            </div>

            {ativoSel && Number(ativoSel.dpa) > 0 && (
              <div className="card" style={{ borderColor: "rgba(52,211,153,0.2)", background: "rgba(52,211,153,0.05)" }}>
                <div className="text-[10px] text-teal uppercase tracking-[2px] font-bold mb-3">
                  💡 Para atingir {brl(metaDiv)}/mês somente com {tickerSel}:
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted">Cotas necessárias:</span>
                    <span className="font-bold text-teal">{cotasNecessarias} cotas</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Investimento total:</span>
                    <span className="font-bold text-amber">{brl(investNecessario)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Com R$ {aporteMensal.toLocaleString("pt-BR")}/mês:</span>
                    <span className="font-bold text-violet-l">
                      {Math.ceil(investNecessario / aporteMensal)} meses
                    </span>
                  </div>
                  <button onClick={() => setCotasExtra(cotasNecessarias)}
                    className="w-full mt-2 text-teal text-xs font-bold py-2 rounded-lg cursor-pointer transition-all"
                    style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)" }}>
                    Simular essas {cotasNecessarias} cotas →
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="card">
              <div className="text-[10px] text-amber uppercase tracking-[2px] font-bold mb-4">📊 Resultado da Simulação</div>
              <div className="grid grid-cols-2 gap-4 mb-5">
                <div className="p-4 rounded-xl bg-white/[.02] border border-white/[.06]">
                  <div className="text-[9px] text-muted uppercase tracking-wide mb-2">ANTES</div>
                  <div className="font-display text-2xl font-black text-muted">{brl(divAtual)}</div>
                  <div className="text-[9px] text-muted mt-1">/mês em dividendos</div>
                  <div className="text-[9px] text-muted">{ativoSel ? `${Number(ativoSel.cotas)} cotas de ${tickerSel}` : ""}</div>
                </div>
                <div className="p-4 rounded-xl"
                  style={{
                    background: cotasExtra > 0 ? "rgba(52,211,153,0.05)" : "rgba(255,255,255,0.02)",
                    border: cotasExtra > 0 ? "1px solid rgba(52,211,153,0.3)" : "1px solid rgba(255,255,255,0.06)"
                  }}>
                  <div className="text-[9px] text-teal uppercase tracking-wide mb-2">DEPOIS</div>
                  <div className="font-display text-2xl font-black text-teal">{brl(divTotalNovo)}</div>
                  <div className="text-[9px] text-teal mt-1">
                    {cotasExtra > 0 ? `+${brl(divTotalNovo - divAtual)}/mês` : "/mês em dividendos"}
                  </div>
                  <div className="text-[9px] text-muted">{ativoSel ? `${cotasSimuladas} cotas de ${tickerSel}` : ""}</div>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-[9px] text-muted mb-1">
                    <span>Antes</span>
                    <span>{progAtual.toFixed(1)}% da meta</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-muted/50 transition-all" style={{ width: `${progAtual}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[9px] text-teal mb-1">
                    <span>Depois</span>
                    <span className="font-bold">{progNovo.toFixed(1)}% da meta</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${progNovo}%`, background: "linear-gradient(90deg, rgba(52,211,153,0.6), #34d399)" }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="card" style={{ borderColor: "rgba(124,106,247,0.2)" }}>
              <div className="text-[10px] text-violet-l uppercase tracking-[2px] font-bold mb-4">
                🎯 Projeção para Meta de {brl(metaDiv)}/mês
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-white/[.02] border border-white/[.04]">
                  <div className="text-[8px] text-muted uppercase tracking-wide mb-1">Com compra simulada</div>
                  <div className="font-display font-bold text-lg text-violet-l">{formatMeses(mesesMeta)}</div>
                </div>
                <div className="p-3 rounded-xl bg-white/[.02] border border-white/[.04]">
                  <div className="text-[8px] text-muted uppercase tracking-wide mb-1">Sem compra simulada</div>
                  <div className="font-display font-bold text-lg text-muted">{formatMeses(calcMesesParaMeta(divAtual, metaDiv, aporteMensal, ativos))}</div>
                </div>
              </div>
              {cotasExtra > 0 && (
                <div className="mt-3 p-3 rounded-xl text-xs"
                  style={{ background: "rgba(52,211,153,0.05)", border: "1px solid rgba(52,211,153,0.2)" }}>
                  <span className="text-teal font-bold">
                    Comprando {cotasExtra} cotas de {tickerSel} você economiza{" "}
                    {Math.max(0, calcMesesParaMeta(divAtual, metaDiv, aporteMensal, ativos) - mesesMeta)} meses!
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function formatMeses(n: number): string {
  if (n === 0) return "🎉 Meta!";
  if (n >= 999) return "∞";
  return `${n} meses`;
}
