"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Sidebar from "@/components/Sidebar";
import { brl, calcDividendoMensal } from "@/lib/dividends";
import type { Ativo } from "@/types";

export default function Drip() {
  const [user, setUser] = useState<any>(null);
  const [ativos, setAtivos] = useState<Ativo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dividendoRecebido, setDividendoRecebido] = useState("");
  const [aportExtra, setAportExtra] = useState("");
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

  if (loading) return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="text-violet-l animate-pulse">Carregando...</div>
    </div>
  );

  const divMensal  = calcDividendoMensal(ativos);
  const patrimonio = ativos.reduce((s, a) => s + Number(a.atual), 0);
  const totalReinvestir = (+dividendoRecebido || divMensal) + (+aportExtra || 0);

  const candidatos = [...ativos]
    .filter(a => Number(a.cotacao) > 0 && Number(a.dy) > 0)
    .sort((a, b) => Number(b.dy) - Number(a.dy));

  type Sugestao = { ativo: Ativo; cotas: number; valor: number; divAdicionado: number; pct: number };
  const sugestoes: Sugestao[] = [];

  if (totalReinvestir > 0 && candidatos.length > 0) {
    const pesos = [0.6, 0.3, 0.1];
    for (let i = 0; i < Math.min(3, candidatos.length); i++) {
      const ativo = candidatos[i];
      const valor = totalReinvestir * pesos[i];
      const cotas = Math.floor(valor / Number(ativo.cotacao));
      const divAdicionado = cotas * Number(ativo.dpa);
      if (cotas > 0) {
        sugestoes.push({ ativo, cotas, valor: cotas * Number(ativo.cotacao), divAdicionado, pct: pesos[i] * 100 });
      }
    }
  }

  const divAdicionadoTotal = sugestoes.reduce((s, sg) => s + sg.divAdicionado, 0);
  const valorUsado = sugestoes.reduce((s, sg) => s + sg.valor, 0);
  const troco = totalReinvestir - valorUsado;

  return (
    <div className="flex bg-bg min-h-screen">
      <Sidebar userEmail={user?.email} healthPct={0} patrimoniTotal={patrimonio}
        dividendoMensal={divMensal} metaDividendo={100} />
      <main className="ml-56 flex-1 p-7">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-black text-white">♻️ DRIP — Reinvestimento</h1>
          <p className="text-muted text-[9px] tracking-[2px] uppercase mt-0.5">
            Dividend Reinvestment Plan · Onde reinvestir seus dividendos
          </p>
        </div>

        <div className="grid grid-cols-2 gap-5">
          {/* Input */}
          <div className="space-y-4">
            <div className="card">
              <div className="text-[10px] text-teal uppercase tracking-[2px] font-bold mb-4">💰 Quanto você vai reinvestir?</div>
              <div className="space-y-3">
                <div>
                  <label className="label">Dividendos recebidos este mês (R$)</label>
                  <input className="input text-lg font-bold" type="number" step="0.01"
                    placeholder={divMensal.toFixed(2)} value={dividendoRecebido}
                    onChange={e => setDividendoRecebido(e.target.value)} />
                  <div className="text-[9px] text-muted mt-1">
                    Deixe em branco para usar o dividendo atual da carteira: <strong className="text-teal">{brl(divMensal)}</strong>
                  </div>
                </div>
                <div>
                  <label className="label">Aporte extra (R$)</label>
                  <input className="input" type="number" step="0.01" placeholder="0,00"
                    value={aportExtra} onChange={e => setAportExtra(e.target.value)} />
                  <div className="text-[9px] text-muted mt-1">
                    Dinheiro novo que você quer aportar além dos dividendos
                  </div>
                </div>
                <div className="p-3 rounded-xl"
                  style={{ background: "rgba(52,211,153,0.05)", border: "1px solid rgba(52,211,153,0.2)" }}>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">Total para reinvestir:</span>
                    <span className="font-display font-bold text-teal text-lg">{brl(totalReinvestir)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Lógica explicada */}
            <div className="card" style={{ borderColor: "rgba(124,106,247,0.2)" }}>
              <div className="text-[10px] text-violet-l uppercase tracking-[2px] font-bold mb-3">📐 Como a sugestão é calculada</div>
              <div className="space-y-2 text-xs text-muted">
                <p>1. Ordena seus ativos pelo maior <strong className="text-white">Dividend Yield</strong></p>
                <p>2. Distribui o valor: <span className="text-amber font-bold">60%</span> no 1º · <span className="text-amber font-bold">30%</span> no 2º · <span className="text-amber font-bold">10%</span> no 3º</p>
                <p>3. Calcula o número inteiro de cotas possível para cada</p>
                <p>4. Mostra o dividendo mensal adicionado com essas compras</p>
                <p className="text-violet-l pt-1">💡 Objetivo: maximizar dividendos futuros com o menor capital possível.</p>
              </div>
            </div>
          </div>

          {/* Sugestões */}
          <div className="space-y-4">
            <div className="card">
              <div className="text-[10px] text-amber uppercase tracking-[2px] font-bold mb-4">🎯 Sugestão de Reinvestimento</div>
              {sugestoes.length === 0 ? (
                <div className="text-center py-10 text-muted text-xs">
                  {ativos.length === 0
                    ? "Cadastre ativos com cotação na Carteira primeiro."
                    : "Digite um valor no formulário para ver as sugestões."}
                </div>
              ) : (
                <div className="space-y-3">
                  {sugestoes.map((sg, i) => {
                    const cors = ["#f59e0b", "#60a5fa", "#a89ef7"];
                    const cor = cors[i];
                    const medals = ["🥇", "🥈", "🥉"];
                    return (
                      <div key={sg.ativo.id} className="p-4 rounded-xl transition-all"
                        style={{ background: cor+"08", border: `1px solid ${cor}30` }}>
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xl">{medals[i]}</span>
                              <span className="font-display font-black text-lg" style={{ color: cor }}>
                                {sg.ativo.ticker}
                              </span>
                            </div>
                            <div className="text-[10px] text-muted">{sg.ativo.nome}</div>
                          </div>
                          <span className="text-[9px] font-bold px-2 py-1 rounded-full"
                            style={{ background: cor+"18", color: cor }}>
                            {sg.pct.toFixed(0)}% do valor
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <div className="text-[8px] text-muted mb-0.5">COTAS</div>
                            <div className="font-bold" style={{ color: cor }}>+{sg.cotas}</div>
                          </div>
                          <div>
                            <div className="text-[8px] text-muted mb-0.5">INVESTIR</div>
                            <div className="font-bold text-white">{brl(sg.valor)}</div>
                          </div>
                          <div>
                            <div className="text-[8px] text-muted mb-0.5">DIV.+</div>
                            <div className="font-bold text-teal">+{brl(sg.divAdicionado)}/mês</div>
                          </div>
                        </div>
                        <div className="mt-2 text-[9px] text-muted">
                          DY: <span className="text-amber">{Number(sg.ativo.dy).toFixed(1)}%</span> ·
                          Cotação: R$ {Number(sg.ativo.cotacao).toFixed(2)} ·
                          DPA: R$ {Number(sg.ativo.dpa).toFixed(2)}
                        </div>
                      </div>
                    );
                  })}

                  {/* Resumo */}
                  <div className="p-4 rounded-xl mt-4"
                    style={{ background: "rgba(52,211,153,0.05)", border: "1px solid rgba(52,211,153,0.25)" }}>
                    <div className="text-[9px] text-teal uppercase tracking-[2px] font-bold mb-3">🎯 Resultado Final</div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <div className="text-muted mb-0.5">Dividendo adicionado:</div>
                        <div className="font-display font-bold text-teal text-base">+{brl(divAdicionadoTotal)}/mês</div>
                      </div>
                      <div>
                        <div className="text-muted mb-0.5">Dividendo total novo:</div>
                        <div className="font-display font-bold text-white text-base">{brl(divMensal + divAdicionadoTotal)}/mês</div>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-white/5 text-[9px] text-muted">
                      Crescimento:{" "}
                      <span className="text-teal font-bold">
                        +{divMensal > 0 ? ((divAdicionadoTotal / divMensal) * 100).toFixed(1) : "∞"}%
                      </span>{" "}
                      no dividendo mensal
                    </div>
                    {troco > 0.01 && (
                      <div className="mt-2 text-[9px] text-amber">
                        💰 Sobra: {brl(troco)} (acumular para o próximo mês)
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Aviso */}
        <div className="card mt-5" style={{ background: "rgba(245,158,11,0.03)", borderColor: "rgba(245,158,11,0.15)" }}>
          <div className="text-xs text-amber font-bold mb-1">⚠️ Cuidados com DRIP</div>
          <p className="text-[10px] text-muted">
            <strong className="text-white">Não concentre demais:</strong> reinvestir sempre no maior DY pode aumentar risco de concentração.
            <strong className="text-white"> DY alto demais (&gt;15%)</strong> pode ser armadilha — empresa em crise paga dividendo pesado pra atrair investidor.
            Rebalanceie periodicamente e diversifique entre Ações e FIIs.
          </p>
        </div>
      </main>
    </div>
  );
}
