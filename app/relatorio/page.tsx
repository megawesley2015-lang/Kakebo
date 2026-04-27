"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Sidebar from "@/components/Sidebar";
import { brl, calcDividendoMensal } from "@/lib/dividends";
import type { Lancamento, Ativo, Divida } from "@/types";

const MESES_F = ["","Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

export default function Relatorio() {
  const [user, setUser] = useState<any>(null);
  const [lancs, setLancs] = useState<Lancamento[]>([]);
  const [ativos, setAtivos] = useState<Ativo[]>([]);
  const [dividas, setDividas] = useState<Divida[]>([]);
  const [loading, setLoading] = useState(true);
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [salario, setSalario] = useState(600);
  const router = useRouter();
  const sb = createClient();

  const load = useCallback(async () => {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { router.push("/auth"); return; }
    setUser(user);
    const [l, a, d, cfg] = await Promise.all([
      sb.from("lancamentos").select("*").eq("user_id", user.id),
      sb.from("ativos").select("*").eq("user_id", user.id),
      sb.from("dividas").select("*").eq("user_id", user.id),
      sb.from("config").select("*").eq("user_id", user.id).maybeSingle(),
    ]);
    setLancs(l.data || []);
    setAtivos(a.data || []);
    setDividas(d.data || []);
    if (cfg.data) setSalario(Number(cfg.data.salario));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="text-violet-l animate-pulse">Carregando...</div>
    </div>
  );

  const ano = new Date().getFullYear();
  const lancMes = lancs.filter(l => l.mes === mes);
  const divMensal  = calcDividendoMensal(ativos);
  const patrimonio = ativos.reduce((s, a) => s + Number(a.atual), 0);
  const totalInvest = ativos.reduce((s, a) => s + Number(a.invest), 0);
  const retorno = patrimonio - totalInvest;

  const receita  = salario + lancMes.filter(l => l.cat === "Renda Extra").reduce((s, l) => s + Number(l.valor), 0);
  const gasto    = lancMes.filter(l => l.cat !== "Renda Extra").reduce((s, l) => s + Number(l.valor), 0);
  const saldo    = receita - gasto;
  const pago     = lancMes.filter(l => l.status === "Pago" && l.cat !== "Renda Extra").reduce((s, l) => s + Number(l.valor), 0);
  const pendente = lancMes.filter(l => l.status === "Pendente" && l.cat !== "Renda Extra").reduce((s, l) => s + Number(l.valor), 0);
  const totalDivida = dividas.reduce((s, d) => s + Number(d.valor), 0);

  const catTotais: Record<string, number> = {};
  lancMes.filter(l => l.cat !== "Renda Extra").forEach(l => {
    catTotais[l.cat] = (catTotais[l.cat] || 0) + Number(l.valor);
  });

  return (
    <div className="flex bg-bg min-h-screen">
      <Sidebar userEmail={user?.email} healthPct={0} patrimoniTotal={patrimonio}
        dividendoMensal={divMensal} metaDividendo={100} />
      <main className="ml-56 flex-1 p-7">
        {/* Controles — somem na impressão */}
        <div className="flex justify-between items-center mb-6 print:hidden">
          <div>
            <h1 className="font-display text-2xl font-black text-white">📄 Relatório Mensal</h1>
            <p className="text-muted text-[9px] tracking-[2px] uppercase mt-0.5">Exporte como PDF</p>
          </div>
          <div className="flex items-center gap-3">
            <select className="input w-40" value={mes} onChange={e => setMes(+e.target.value)}>
              {MESES_F.slice(1).map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <button onClick={() => window.print()}
              className="bg-violet text-white text-xs font-bold px-5 py-2.5 rounded-lg border-none cursor-pointer hover:opacity-90 transition-all">
              🖨️ Gerar PDF
            </button>
          </div>
        </div>

        {/* RELATÓRIO — este bloco é o que vai para o PDF */}
        <div className="bg-white text-gray-900 rounded-2xl p-8 max-w-3xl mx-auto" id="relatorio-pdf">
          <style>{`
            @media print {
              body { background: white !important; }
              aside, .print\\:hidden { display: none !important; }
              main { margin: 0 !important; padding: 0 !important; }
              #relatorio-pdf {
                max-width: none !important;
                border-radius: 0 !important;
                box-shadow: none !important;
                padding: 20px !important;
              }
              @page { size: A4; margin: 1cm; }
            }
          `}</style>

          {/* Cabeçalho */}
          <div className="flex justify-between items-start mb-6 pb-4 border-b-2 border-gray-100">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">家計簿</span>
                <span className="font-bold text-gray-400 text-sm">Kakebo Pro</span>
              </div>
              <h2 className="text-2xl font-black text-gray-900">
                Relatório Financeiro — {MESES_F[mes]}/{ano}
              </h2>
              <p className="text-gray-500 text-xs mt-1">
                Gerado em {new Date().toLocaleDateString("pt-BR")} · {user?.email}
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-400 mb-0.5">Saldo do mês</div>
              <div className="text-2xl font-black" style={{ color: saldo >= 0 ? "#059669" : "#dc2626" }}>
                {brl(saldo)}
              </div>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            {[
              { l: "Receita",     v: brl(receita),   c: "#059669" },
              { l: "Gasto Total", v: brl(gasto),     c: "#d97706" },
              { l: "Pago",        v: brl(pago),      c: "#2563eb" },
              { l: "Pendente",    v: brl(pendente),  c: "#dc2626" },
            ].map((k, i) => (
              <div key={i} className="rounded-xl p-3 bg-gray-50 border border-gray-100">
                <div className="text-[9px] text-gray-400 uppercase tracking-wide mb-1">{k.l}</div>
                <div className="font-bold text-base" style={{ color: k.c }}>{k.v}</div>
              </div>
            ))}
          </div>

          {/* Gastos por categoria */}
          {Object.keys(catTotais).length > 0 && (
            <div className="mb-6">
              <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wide mb-3">Gastos por Categoria</h3>
              <div className="space-y-2">
                {Object.entries(catTotais).sort(([,a],[,b]) => b-a).map(([cat, val]) => (
                  <div key={cat} className="flex items-center gap-3">
                    <div className="w-32 text-xs text-gray-600 shrink-0">{cat}</div>
                    <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full"
                        style={{ width: `${gasto > 0 ? (val / gasto) * 100 : 0}%`, background: "#6366f1" }} />
                    </div>
                    <div className="w-24 text-right text-xs font-bold text-gray-700">{brl(val)}</div>
                    <div className="w-10 text-right text-[9px] text-gray-400">
                      {gasto > 0 ? ((val / gasto) * 100).toFixed(0) : 0}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lançamentos */}
          {lancMes.length > 0 && (
            <div className="mb-6">
              <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wide mb-3">
                Lançamentos — {MESES_F[mes]}
              </h3>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    {["Categoria","Descrição","Valor","Status"].map(h => (
                      <th key={h} className="text-left py-2 px-3 text-gray-400 font-bold border-b border-gray-100">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lancMes.sort((a,b) => a.cat.localeCompare(b.cat)).map(l => (
                    <tr key={l.id} className="border-b border-gray-50">
                      <td className="py-2 px-3 text-gray-600">{l.cat}</td>
                      <td className="py-2 px-3 text-gray-800">{l.descricao}</td>
                      <td className="py-2 px-3 font-bold text-gray-800">{brl(Number(l.valor))}</td>
                      <td className="py-2 px-3">
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                          style={{
                            background: l.status === "Pago" ? "#d1fae5" : "#fef3c7",
                            color: l.status === "Pago" ? "#059669" : "#d97706"
                          }}>
                          {l.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Carteira */}
          {ativos.length > 0 && (
            <div className="mb-6 p-4 rounded-xl bg-gray-50 border border-gray-100">
              <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wide mb-3">Carteira de Investimentos</h3>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div>
                  <div className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">Patrimônio Total</div>
                  <div className="font-bold text-sm" style={{ color: "#d97706" }}>{brl(patrimonio)}</div>
                </div>
                <div>
                  <div className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">Retorno Total</div>
                  <div className="font-bold text-sm" style={{ color: retorno >= 0 ? "#059669" : "#dc2626" }}>
                    {retorno >= 0 ? "+" : ""}{brl(retorno)}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">Dividendo Mensal</div>
                  <div className="font-bold text-sm" style={{ color: "#2563eb" }}>{brl(divMensal)}</div>
                </div>
              </div>
              <div className="text-xs text-gray-500">
                {ativos.filter(a => Number(a.cotas) > 0).length} ativos com posição ·{" "}
                Projeção anual: <strong>{brl(divMensal * 12)}</strong>
              </div>
            </div>
          )}

          {/* Dívidas */}
          {dividas.length > 0 && (
            <div className="mb-6">
              <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wide mb-2">Dívidas em Aberto</h3>
              <div className="text-sm">
                Total: <strong style={{ color: "#dc2626" }}>{brl(totalDivida)}</strong>
                {" · "}
                <span className="text-gray-500">
                  {dividas.filter(d => d.status === "Pendente").length} pendente(s)
                </span>
              </div>
            </div>
          )}

          {/* Rodapé */}
          <div className="pt-4 border-t border-gray-100 text-[9px] text-gray-400 flex justify-between">
            <span>家計簿 Kakebo Pro · Método japonês de controle financeiro</span>
            <span>{new Date().toLocaleString("pt-BR")}</span>
          </div>
        </div>

        {/* Dica — some na impressão */}
        <div className="card mt-5 max-w-3xl mx-auto print:hidden"
          style={{ background: "rgba(124,106,247,0.03)", borderColor: "rgba(124,106,247,0.15)" }}>
          <div className="text-xs text-violet-l font-bold mb-1">💡 Como exportar como PDF</div>
          <p className="text-[10px] text-muted">
            Clique em <strong className="text-white">🖨️ Gerar PDF</strong>. Na caixa de impressão do browser,
            selecione <strong className="text-white">"Salvar como PDF"</strong> como destino de impressão.
            Recomendamos Chrome ou Edge para melhores resultados. O sidebar e os controles são ocultados automaticamente — apenas o relatório vai para o PDF.
          </p>
        </div>
      </main>
    </div>
  );
}
