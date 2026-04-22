
"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Sidebar from "@/components/Sidebar";
import { brl, calcDividendoMensal, calcMesesParaMeta } from "@/lib/dividends";
import type { Ativo, Aporte, Meta } from "@/types";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

const TIPO_COLOR: Record<string,string> = {
  "Ações/FIIs": "#60a5fa",
  "FIIs":       "#34d399",
  "Renda Fixa": "#a89ef7",
  "Cripto":     "#f59e0b",
  "Outros":     "#94a3b8",
};
const SUBTIPO_COLOR: Record<string,string> = {
  "Renda Blindada":  "#60a5fa",
  "Renda Turbinada": "#f87171",
  "Deep Value":      "#fbbf24",
  "Núcleo":          "#34d399",
  "Papel":           "#a89ef7",
  "Satélite":        "#f59e0b",
};

type Tab = "carteira" | "ativos" | "aportes" | "metas";

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[rgba(10,9,20,.96)] border border-violet/30 rounded-lg px-3 py-2 text-xs">
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {brl(p.value)}</p>
      ))}
    </div>
  );
};

export default function Investimentos() {
  const [user, setUser]       = useState<any>(null);
  const [ativos, setAtivos]   = useState<Ativo[]>([]);
  const [aportes, setAportes] = useState<Aporte[]>([]);
  const [metas, setMetas]     = useState<Meta[]>([]);
  const [tab, setTab]         = useState<Tab>("carteira");
  const [loading, setLoading] = useState(true);
  const [loadingCot, setLoadingCot] = useState(false);

  // Modal states
  const [showModalAtivo, setShowModalAtivo]   = useState(false);
  const [showModalAporte, setShowModalAporte] = useState(false);
  const [showModalMeta, setShowModalMeta]     = useState(false);
  const [editAtivo, setEditAtivo]   = useState<Ativo | null>(null);
  const [editAporte, setEditAporte] = useState<Aporte | null>(null);
  const [editMeta, setEditMeta]     = useState<Meta | null>(null);

  const router = useRouter();
  const sb = createClient();

  const load = useCallback(async () => {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { router.push("/auth"); return; }
    setUser(user);
    const [a, ap, m] = await Promise.all([
      sb.from("ativos").select("*").eq("user_id", user.id),
      sb.from("aportes").select("*").eq("user_id", user.id),
      sb.from("metas").select("*").eq("user_id", user.id),
    ]);
    setAtivos(a.data || []);
    setAportes(ap.data || []);
    setMetas(m.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ATUALIZAR COTAÇÕES em tempo real via brapi.dev
  async function atualizarCotacoes() {
    setLoadingCot(true);
    const tickers = ativos.map(a => a.ticker).join(",");
    if (!tickers) { setLoadingCot(false); return; }
    try {
      const res = await fetch(`/api/cotacoes?tickers=${tickers}`);
      const cotacoes = await res.json();
      const map: Record<string, number> = {};
      cotacoes.forEach((c: any) => { map[c.symbol] = c.regularMarketPrice; });

      // Atualizar cotacoes no banco
      for (const a of ativos) {
        if (map[a.ticker]) {
          const novaAtual = Number(a.cotas) * map[a.ticker];
          await sb.from("ativos").update({
            cotacao: map[a.ticker],
            atual: novaAtual
          }).eq("id", a.id);
        }
      }
      await load();
    } finally {
      setLoadingCot(false);
    }
  }

  // SALVAR APORTE — atualiza cotas e recalcula dividendo automaticamente
  async function salvarAporte(form: {
    ativo_id: number; mes: number; ano: number;
    cotas_compradas: number; valor: number; rend: number; obs: string;
  }) {
    const uid = user?.id;
    const ativo = ativos.find(a => a.id === form.ativo_id);
    if (!ativo) return;

    const novasCotas   = Number(ativo.cotas) + form.cotas_compradas;
    const novoDivMensal = novasCotas * Number(ativo.dpa);
    const novoInvest   = Number(ativo.invest) + form.valor;
    const novoAtual    = novasCotas * Number(ativo.cotacao || ativo.cotacao);

    // 1. Atualizar ativo (cotas + dividendo mensal — AUTOMÁTICO)
    await sb.from("ativos").update({
      cotas:      novasCotas,
      div_mensal: novoDivMensal,
      invest:     novoInvest,
      atual:      novoAtual || novoInvest,
    }).eq("id", form.ativo_id);

    // 2. Inserir aporte
    const aporteData = { user_id: uid, ...form };
    if (editAporte) {
      await sb.from("aportes").update(aporteData).eq("id", editAporte.id);
    } else {
      await sb.from("aportes").insert(aporteData);
    }

    // 3. Recalcular metas de dividendos automaticamente
    const ativosAtualizados = ativos.map(a =>
      a.id === form.ativo_id
        ? { ...a, cotas: novasCotas, div_mensal: novoDivMensal }
        : a
    );
    const novoDivTotal = calcDividendoMensal(ativosAtualizados);

    for (const meta of metas) {
      if (meta.nome.toLowerCase().includes("dividendo") || meta.nome.toLowerCase().includes("fii")) {
        await sb.from("metas").update({ atual: novoDivTotal }).eq("id", meta.id);
      }
    }

    setShowModalAporte(false);
    setEditAporte(null);
    await load();
  }

  // SALVAR ATIVO
  async function salvarAtivo(form: Partial<Ativo>) {
    const uid = user?.id;
    const data = {
      user_id: uid, ticker: form.ticker, nome: form.nome,
      tipo: form.tipo, subtipo: form.subtipo || "",
      cotas: form.cotas || 0, cotas_alvo: form.cotas_alvo || 0,
      cotacao: form.cotacao || 0, invest: form.invest || 0,
      atual: form.atual || form.invest || 0,
      dy: form.dy || 0, dpa: form.dpa || 0,
      div_mensal: (Number(form.cotas) || 0) * (Number(form.dpa) || 0),
      inst: form.inst || "", obs: form.obs || "",
    };
    if (editAtivo) {
      await sb.from("ativos").update(data).eq("id", editAtivo.id);
    } else {
      await sb.from("ativos").insert(data);
    }
    setShowModalAtivo(false); setEditAtivo(null);
    await load();
  }

  // SALVAR META
  async function salvarMeta(form: Partial<Meta>) {
    const uid = user?.id;
    const dividendoAtual = calcDividendoMensal(ativos);
    const data = {
      user_id: uid, nome: form.nome, tipo: form.tipo,
      atual: dividendoAtual, // sempre reflete o dividendo real
      objetivo: form.objetivo, aporte_mes: form.aporte_mes || 0,
      prazo: form.prazo || "", descricao: form.descricao || "",
    };
    if (editMeta) {
      await sb.from("metas").update(data).eq("id", editMeta.id);
    } else {
      await sb.from("metas").insert(data);
    }
    setShowModalMeta(false); setEditMeta(null);
    await load();
  }

  async function excluirAtivo(id: number) {
    if (!confirm("Excluir este ativo?")) return;
    await sb.from("ativos").delete().eq("id", id);
    await load();
  }
  async function excluirAporte(id: number) {
    if (!confirm("Excluir este aporte?")) return;
    await sb.from("aportes").delete().eq("id", id);
    await load();
  }
  async function excluirMeta(id: number) {
    if (!confirm("Excluir esta meta?")) return;
    await sb.from("metas").delete().eq("id", id);
    await load();
  }

  if (loading) return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="text-violet-l font-mono text-sm animate-pulse">Carregando...</div>
    </div>
  );

  const dividendoMensal  = calcDividendoMensal(ativos);
  const metaDividendo    = metas.find(m => m.nome.toLowerCase().includes("dividendo"))?.objetivo || 100;
  const patrimoniTotal   = ativos.reduce((s,a) => s + Number(a.atual), 0);
  const totalInvestido   = ativos.reduce((s,a) => s + Number(a.invest), 0);
  const retorno          = patrimoniTotal - totalInvestido;
  const progDiv          = Math.min(100, metaDividendo > 0 ? (dividendoMensal / metaDividendo) * 100 : 0);

  // Pie data
  const tipoTot: Record<string,number> = {};
  ativos.forEach(a => { tipoTot[a.tipo] = (tipoTot[a.tipo]||0) + Number(a.atual); });
  const pieData = Object.entries(tipoTot).map(([k,v]) => ({ name: k, value: v }));
  const pieTotal = pieData.reduce((s,d) => s + d.value, 0);

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id:"carteira", label:"Carteira",  icon:"🥧" },
    { id:"ativos",   label:"Ativos",    icon:"📈" },
    { id:"aportes",  label:"Aportes",   icon:"💵" },
    { id:"metas",    label:"Metas",     icon:"🎯" },
  ];

  return (
    <div className="flex bg-bg min-h-screen">
      <Sidebar
        userEmail={user?.email}
        healthPct={0}
        patrimoniTotal={patrimoniTotal}
        dividendoMensal={dividendoMensal}
        metaDividendo={metaDividendo}
      />
      <main className="ml-56 flex-1 p-7">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="font-display text-2xl font-black text-white">Investimentos</h1>
            <p className="text-muted text-[9px] tracking-[2px] uppercase mt-0.5">Carteira de Ativos</p>
          </div>
          <div className="flex gap-2">
            <button onClick={atualizarCotacoes} disabled={loadingCot}
              className="text-xs font-bold px-4 py-2.5 rounded-lg border border-teal/20 text-teal hover:bg-teal/10 transition-all disabled:opacity-50 cursor-pointer bg-transparent">
              {loadingCot ? "⏳ Atualizando..." : "🔄 Cotações"}
            </button>
            {tab === "ativos"  && <button onClick={() => { setEditAtivo(null); setShowModalAtivo(true); }} className="btn-gold">＋ Ativo</button>}
            {tab === "aportes" && <button onClick={() => { setEditAporte(null); setShowModalAporte(true); }} className="btn-gold">＋ Aporte</button>}
            {tab === "metas"   && <button onClick={() => { setEditMeta(null); setShowModalMeta(true); }} className="btn-gold">🎯 Nova Meta</button>}
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          {[
            { l:"💼 Patrimônio",     v: brl(patrimoniTotal), c:"#f59e0b" },
            { l:"💵 Investido",      v: brl(totalInvestido), c:"#60a5fa" },
            { l:retorno>=0?"📈 Retorno":"📉 Retorno", v: (retorno>=0?"+":"")+brl(retorno), c: retorno>=0?"#34d399":"#f87171" },
            { l:"📊 Div. Mensal",    v: brl(dividendoMensal), c:"#f59e0b" },
          ].map((k,i) => (
            <div key={i} className="card hover:-translate-y-0.5 transition-transform">
              <div className="text-[9px] uppercase tracking-[2px] mb-2" style={{color:k.c}}>{k.l}</div>
              <div className="font-display text-xl font-bold" style={{color:k.c}}>{k.v}</div>
            </div>
          ))}
        </div>

        {/* DESTAQUE: Barra de Progresso Dividendos */}
        <div className="card mb-5 border-amber-500/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-amber-400 tracking-[2px] uppercase font-bold">
              🎯 Meta de Dividendos — Progresso Automático
            </span>
            <div className="text-right">
              <span className="font-display font-bold text-amber-400 text-lg">{brl(dividendoMensal)}</span>
              <span className="text-muted text-[9px] ml-1">/ {brl(metaDividendo)}/mês</span>
            </div>
          </div>
          <div className="h-2.5 bg-white/5 rounded-full overflow-hidden mb-1.5">
            <div className="h-full rounded-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-1000"
              style={{ width: `${progDiv}%` }} />
          </div>
          <div className="flex justify-between text-[9px] text-muted">
            <span>{progDiv.toFixed(1)}% atingido</span>
            <span>
              {dividendoMensal < metaDividendo
                ? `${calcMesesParaMeta(dividendoMensal, metaDividendo, metas[0]?.aporte_mes || 1500, ativos)} meses para a meta`
                : "🎉 META ATINGIDA!"}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 bg-white/[.02] border border-white/[.05] rounded-xl p-1 w-fit">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-lg text-[10px] font-bold tracking-wide transition-all cursor-pointer border-none
                ${tab === t.id ? "bg-violet/20 text-violet-l border border-violet/30" : "text-muted hover:text-white bg-transparent"}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* TAB: CARTEIRA */}
        {tab === "carteira" && (
          <div className="grid grid-cols-2 gap-4">
            <div className="card">
              <div className="text-[10px] text-amber-400 tracking-[1.5px] uppercase font-bold mb-4">Distribuição</div>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90}
                    dataKey="value" stroke="none" paddingAngle={3}>
                    {pieData.map((e,i) => (
                      <Cell key={i} fill={(TIPO_COLOR[e.name]||"#888")+"cc"} />
                    ))}
                  </Pie>
                  <Tooltip content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="bg-[rgba(10,9,20,.96)] border border-amber-500/30 rounded-lg px-3 py-2 text-xs">
                        <p className="text-amber-400 font-bold">{d.name}</p>
                        <p className="text-white">{brl(d.value)}</p>
                        <p className="text-muted">{((d.value/pieTotal)*100).toFixed(1)}%</p>
                      </div>
                    );
                  }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {pieData.map((d,i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: TIPO_COLOR[d.name]||"#888" }} />
                      <span className="text-[10px] text-muted">{d.name}</span>
                    </div>
                    <span className="text-[10px] font-bold" style={{ color: TIPO_COLOR[d.name] }}>
                      {pieTotal > 0 ? ((d.value/pieTotal)*100).toFixed(1) : 0}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <div className="text-[10px] text-teal tracking-[1.5px] uppercase font-bold mb-4">Dividendo por Ativo</div>
              {ativos.filter(a => Number(a.div_mensal) > 0).length === 0 ? (
                <div className="text-center py-12 text-muted text-xs">
                  Nenhum dividendo ainda.<br />
                  <button onClick={() => setTab("aportes")} className="text-violet-l hover:underline mt-1 bg-transparent border-none cursor-pointer">
                    Registrar aportes →
                  </button>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart
                    data={[...ativos].filter(a => Number(a.div_mensal) > 0)
                      .sort((a,b) => Number(b.div_mensal)-Number(a.div_mensal))
                      .slice(0,8)
                      .map(a => ({ name: a.ticker, div: Number(a.div_mensal), fill: SUBTIPO_COLOR[a.subtipo]||TIPO_COLOR[a.tipo]||"#888" }))}
                    layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)" horizontal={false} />
                    <XAxis type="number" tick={{ fill:"#475569", fontSize:9 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${v.toFixed(0)}`} />
                    <YAxis type="category" dataKey="name" tick={{ fill:"#94a3b8", fontSize:10 }} axisLine={false} tickLine={false} width={55} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="div" name="Dividendo/mês" radius={[0,5,5,0]}>
                      {[...ativos].filter(a => Number(a.div_mensal) > 0)
                        .sort((a,b) => Number(b.div_mensal)-Number(a.div_mensal))
                        .slice(0,8)
                        .map((a,i) => <Cell key={i} fill={(SUBTIPO_COLOR[a.subtipo]||TIPO_COLOR[a.tipo]||"#888")+"cc"} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        )}

        {/* TAB: ATIVOS */}
        {tab === "ativos" && (
          <div className="grid grid-cols-3 gap-4">
            {ativos.length === 0 ? (
              <div className="col-span-3 text-center py-16 text-muted">
                <div className="text-4xl mb-3 opacity-40">📈</div>
                <div className="text-sm">Nenhum ativo cadastrado</div>
                <button onClick={() => setShowModalAtivo(true)} className="btn-gold mt-3">
                  ＋ Adicionar Ativo
                </button>
              </div>
            ) : ativos.map(a => {
              const cor   = SUBTIPO_COLOR[a.subtipo] || TIPO_COLOR[a.tipo] || "#888";
              const prog  = a.cotas_alvo > 0 ? Math.min(100, (Number(a.cotas)/Number(a.cotas_alvo))*100) : 0;
              const temPos= Number(a.cotas) > 0;
              const retorno = Number(a.atual) - Number(a.invest);
              return (
                <div key={a.id} className="card relative overflow-hidden hover:-translate-y-0.5 transition-transform"
                  style={{ borderColor: cor+"33", opacity: temPos ? 1 : 0.6 }}>
                  <div className="absolute top-0 left-0 rounded-full transition-all duration-700"
                    style={{ height: "2px", width: `${prog}%`, background: cor }} />
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-display text-base font-black" style={{ color: temPos ? cor : "#64748b" }}>
                        {a.ticker}
                      </div>
                      <div className="text-[10px] text-muted leading-tight">{a.nome}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[8px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: cor+"18", color: cor }}>
                        {a.subtipo || a.tipo}
                      </span>
                      <div className="flex gap-1">
                        <button onClick={() => { setEditAtivo(a); setShowModalAtivo(true); }}
                          className="text-[10px] hover:text-violet-l transition-colors bg-transparent border-none cursor-pointer">✏️</button>
                        <button onClick={() => excluirAtivo(a.id)}
                          className="text-[10px] hover:text-rose transition-colors bg-transparent border-none cursor-pointer">🗑</button>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                      <div className="text-[8px] text-muted uppercase tracking-wide mb-0.5">Investido</div>
                      <div className="text-xs font-bold">{brl(Number(a.invest))}</div>
                    </div>
                    <div>
                      <div className="text-[8px] text-muted uppercase tracking-wide mb-0.5">Div./mês</div>
                      <div className="text-xs font-bold" style={{ color: temPos ? "#34d399" : "#64748b" }}>
                        {brl(Number(a.div_mensal))}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1 mb-3">
                    <div>
                      <div className="text-[8px] text-muted mb-0.5">Cotas</div>
                      <div className="text-xs font-bold">{Number(a.cotas)}</div>
                    </div>
                    <div>
                      <div className="text-[8px] text-muted mb-0.5">Alvo</div>
                      <div className="text-xs font-bold" style={{ color: cor }}>{Number(a.cotas_alvo) || "—"}</div>
                    </div>
                    <div>
                      <div className="text-[8px] text-muted mb-0.5">DY</div>
                      <div className="text-xs font-bold text-amber">{Number(a.dy).toFixed(1)}%</div>
                    </div>
                  </div>
                  <div className="mb-2">
                    <div className="flex justify-between text-[8px] text-muted mb-1">
                      <span>Progresso cotas</span>
                      <span style={{ color: cor }}>{prog.toFixed(0)}%</span>
                    </div>
                    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${prog}%`, background: cor }} />
                    </div>
                  </div>
                  {a.cotacao > 0 && (
                    <div className="text-[8px] text-muted mt-1">
                      Cotação: R$ {Number(a.cotacao).toFixed(2)} · DPA: R$ {Number(a.dpa).toFixed(2)}
                    </div>
                  )}
                  {retorno !== 0 && Number(a.invest) > 0 && (
                    <div className={`text-[9px] font-bold mt-1 ${retorno >= 0 ? "text-teal" : "text-rose"}`}>
                      {retorno >= 0 ? "↑" : "↓"} {brl(Math.abs(retorno))} ({((retorno/Number(a.invest))*100).toFixed(1)}%)
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* TAB: APORTES */}
        {tab === "aportes" && (
          <div className="card">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/[.06]">
                    {["Mês/Ano","Ativo","Cotas Compradas","Valor","Dividendo Adicionado","Ações"].map(h => (
                      <th key={h} className="text-left py-2.5 px-3 text-[9px] uppercase tracking-[1.5px] text-muted font-bold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {aportes.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-muted">
                        Nenhum aporte registrado.{" "}
                        <button onClick={() => setShowModalAporte(true)} className="text-violet-l bg-transparent border-none cursor-pointer hover:underline">
                          Registrar agora
                        </button>
                      </td>
                    </tr>
                  ) : [...aportes].sort((a,b) => b.id - a.id).map(ap => {
                    const ativo = ativos.find(a => a.id === ap.ativo_id);
                    const divAdicionado = (ap.cotas_compradas || 0) * (ativo?.dpa || 0);
                    return (
                      <tr key={ap.id} className="border-b border-white/[.03] hover:bg-white/[.01]">
                        <td className="py-3 px-3 text-muted">
                          {["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][ap.mes-1]}/{ap.ano}
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-bold text-amber-400">{ativo?.ticker || "—"}</span>
                          <div className="text-[9px] text-muted">{ativo?.subtipo || ativo?.tipo}</div>
                        </td>
                        <td className="py-3 px-3 font-bold text-teal">
                          +{Number(ap.cotas_compradas || 0).toFixed(0)} cotas
                        </td>
                        <td className="py-3 px-3 font-bold font-mono">{brl(Number(ap.valor))}</td>
                        <td className="py-3 px-3">
                          <span className="text-teal font-bold">+{brl(divAdicionado)}/mês</span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex gap-2">
                            <button onClick={() => { setEditAporte(ap); setShowModalAporte(true); }}
                              className="text-[10px] hover:text-violet-l bg-transparent border-none cursor-pointer">✏️</button>
                            <button onClick={() => excluirAporte(ap.id)}
                              className="text-[10px] hover:text-rose bg-transparent border-none cursor-pointer">🗑</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: METAS */}
        {tab === "metas" && (
          <div className="grid grid-cols-2 gap-4">
            {metas.length === 0 ? (
              <div className="col-span-2 text-center py-16 text-muted">
                <div className="text-4xl mb-3 opacity-40">🎯</div>
                <div className="text-sm">Nenhuma meta criada</div>
                <button onClick={() => setShowModalMeta(true)} className="btn-gold mt-3">🎯 Criar Meta</button>
              </div>
            ) : metas.map(m => {
              const cor  = "#f59e0b";
              const prog = m.objetivo > 0 ? Math.min(100, (dividendoMensal / m.objetivo) * 100) : 0;
              const falta = Math.max(0, m.objetivo - dividendoMensal);
              const meses = calcMesesParaMeta(dividendoMensal, m.objetivo, m.aporte_mes, ativos);
              return (
                <div key={m.id} className="card relative overflow-hidden" style={{ borderColor: "#f59e0b22" }}>
                  <div className="absolute top-0 left-0 right-0 h-0.5"
                    style={{ background: `linear-gradient(90deg,transparent,${cor},transparent)` }} />
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="font-display font-bold text-white">{m.nome}</div>
                      <div className="text-[9px] text-muted tracking-wide uppercase mt-0.5">{m.tipo}</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setEditMeta(m); setShowModalMeta(true); }}
                        className="text-[10px] hover:text-violet-l bg-transparent border-none cursor-pointer">✏️</button>
                      <button onClick={() => excluirMeta(m.id)}
                        className="text-[10px] hover:text-rose bg-transparent border-none cursor-pointer">🗑</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div>
                      <div className="text-[8px] text-muted uppercase tracking-wide mb-1">Dividendo Atual</div>
                      <div className="font-display font-bold text-amber-400 text-lg">{brl(dividendoMensal)}</div>
                      <div className="text-[9px] text-muted">atualizado automaticamente</div>
                    </div>
                    <div>
                      <div className="text-[8px] text-muted uppercase tracking-wide mb-1">Objetivo</div>
                      <div className="font-display font-bold text-white text-lg">{brl(m.objetivo)}</div>
                      <div className="text-[9px] text-muted">/mês</div>
                    </div>
                  </div>
                  <div className="mb-3">
                    <div className="flex justify-between text-[9px] text-muted mb-1.5">
                      <span>Progresso</span>
                      <span className="text-amber-400 font-bold">{prog.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-1000"
                        style={{ width: `${prog}%`, background: `linear-gradient(90deg,#92400e,#f59e0b)` }} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[9px]">
                    <div>
                      <div className="text-muted mb-0.5">FALTA</div>
                      <div className="font-bold text-amber">{brl(falta)}/mês</div>
                    </div>
                    <div>
                      <div className="text-muted mb-0.5">APORTE/MÊS</div>
                      <div className="font-bold">{brl(m.aporte_mes)}</div>
                    </div>
                    <div>
                      <div className="text-muted mb-0.5">PREVISÃO</div>
                      <div className="font-bold" style={{ color: cor }}>
                        {meses === 0 ? "🎉 Atingida!" : `${meses} meses`}
                      </div>
                    </div>
                  </div>
                  {m.descricao && (
                    <div className="mt-3 pt-3 border-t border-white/[.04] text-[10px] text-muted">{m.descricao}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* MODAL ATIVO */}
        {showModalAtivo && (
          <Modal title={editAtivo ? "✏️ Editar Ativo" : "＋ Novo Ativo"} onClose={() => { setShowModalAtivo(false); setEditAtivo(null); }}>
            <AtivoForm ativo={editAtivo} onSave={salvarAtivo} />
          </Modal>
        )}

        {/* MODAL APORTE */}
        {showModalAporte && (
          <Modal title={editAporte ? "✏️ Editar Aporte" : "💵 Registrar Compra de Cotas"} onClose={() => { setShowModalAporte(false); setEditAporte(null); }}>
            <AporteForm aporte={editAporte} ativos={ativos} onSave={salvarAporte} />
          </Modal>
        )}

        {/* MODAL META */}
        {showModalMeta && (
          <Modal title={editMeta ? "✏️ Editar Meta" : "🎯 Nova Meta de Dividendos"} onClose={() => { setShowModalMeta(false); setEditMeta(null); }}>
            <MetaForm meta={editMeta} dividendoAtual={dividendoMensal} onSave={salvarMeta} />
          </Modal>
        )}
      </main>
    </div>
  );
}

// ── MODAL WRAPPER ──────────────────────────────────────────
function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-5"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#0f0e1a] border border-white/[.08] rounded-2xl p-7 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="font-display text-lg font-bold text-white mb-5">{title}</div>
        {children}
      </div>
    </div>
  );
}

// ── FORM: ATIVO ────────────────────────────────────────────
function AtivoForm({ ativo, onSave }: { ativo: Ativo | null; onSave: (f: Partial<Ativo>) => void }) {
  const [f, setF] = useState<Partial<Ativo>>(ativo || {
    ticker:"", nome:"", tipo:"FIIs", subtipo:"Núcleo",
    cotas:0, cotas_alvo:0, cotacao:0, invest:0, atual:0, dy:0, dpa:0, inst:"", obs:""
  });
  const set = (k: string, v: any) => setF(prev => ({ ...prev, [k]: v }));
  const divPreview = (Number(f.cotas)||0) * (Number(f.dpa)||0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Ticker *</label>
          <input className="input" placeholder="Ex: KNSC11" value={f.ticker||""} onChange={e => set("ticker", e.target.value.toUpperCase())} /></div>
        <div><label className="label">Nome</label>
          <input className="input" placeholder="Ex: Kinea Securities" value={f.nome||""} onChange={e => set("nome", e.target.value)} /></div>
        <div><label className="label">Tipo</label>
          <select className="input" value={f.tipo||"FIIs"} onChange={e => set("tipo", e.target.value)}>
            {["Ações/FIIs","FIIs","Renda Fixa","Cripto","Outros"].map(t => <option key={t}>{t}</option>)}
          </select></div>
        <div><label className="label">Estratégia</label>
          <select className="input" value={f.subtipo||""} onChange={e => set("subtipo", e.target.value)}>
            {["Renda Blindada","Renda Turbinada","Deep Value","Núcleo","Papel","Satélite",""].map(t => <option key={t} value={t}>{t||"—"}</option>)}
          </select></div>
        <div><label className="label">Cotas Atuais</label>
          <input className="input" type="number" value={f.cotas||0} onChange={e => set("cotas", +e.target.value)} /></div>
        <div><label className="label">Cotas Alvo</label>
          <input className="input" type="number" value={f.cotas_alvo||0} onChange={e => set("cotas_alvo", +e.target.value)} /></div>
        <div><label className="label">Cotação (R$)</label>
          <input className="input" type="number" step="0.01" value={f.cotacao||0} onChange={e => set("cotacao", +e.target.value)} /></div>
        <div><label className="label">DPA — Dividendo por Ação (R$)</label>
          <input className="input" type="number" step="0.01" value={f.dpa||0} onChange={e => set("dpa", +e.target.value)} /></div>
        <div><label className="label">DY (%)</label>
          <input className="input" type="number" step="0.01" value={f.dy||0} onChange={e => set("dy", +e.target.value)} /></div>
        <div><label className="label">Valor Investido (R$)</label>
          <input className="input" type="number" step="0.01" value={f.invest||0} onChange={e => set("invest", +e.target.value)} /></div>
        <div className="col-span-2"><label className="label">Corretora / Instituição</label>
          <input className="input" placeholder="Ex: XP, NuInvest..." value={f.inst||""} onChange={e => set("inst", e.target.value)} /></div>
      </div>
      {divPreview > 0 && (
        <div className="bg-teal/8 border border-teal/20 rounded-lg px-3 py-2 text-xs text-teal">
          💰 Dividendo calculado: <strong>{brl(divPreview)}/mês</strong> ({Number(f.cotas)} cotas × R$ {Number(f.dpa).toFixed(2)} DPA)
        </div>
      )}
      <div className="flex justify-end gap-2 pt-3 border-t border-white/[.06] mt-2">
        <button className="btn-gold" onClick={() => onSave(f)}>💾 Salvar</button>
      </div>
    </div>
  );
}

// ── FORM: APORTE ───────────────────────────────────────────
function AporteForm({ aporte, ativos, onSave }: {
  aporte: Aporte | null; ativos: Ativo[];
  onSave: (f: any) => void;
}) {
  const now = new Date();
  const [f, setF] = useState({
    ativo_id: aporte?.ativo_id || (ativos[0]?.id || 0),
    mes: aporte?.mes || now.getMonth() + 1,
    ano: aporte?.ano || now.getFullYear(),
    cotas_compradas: aporte?.cotas_compradas || 0,
    valor: aporte?.valor || 0,
    rend: aporte?.rend || 0,
    obs: aporte?.obs || "",
  });
  const set = (k: string, v: any) => setF(prev => ({ ...prev, [k]: v }));
  const ativo = ativos.find(a => a.id === Number(f.ativo_id));

  // Auto-calcular valor ao digitar cotas
  useEffect(() => {
    if (f.cotas_compradas > 0 && ativo?.cotacao) {
      set("valor", +(f.cotas_compradas * Number(ativo.cotacao)).toFixed(2));
    }
  }, [f.cotas_compradas, f.ativo_id]);

  const divAdicionado = f.cotas_compradas * (Number(ativo?.dpa) || 0);

  return (
    <div className="space-y-3">
      <div><label className="label">Ativo *</label>
        <select className="input" value={f.ativo_id} onChange={e => set("ativo_id", +e.target.value)}>
          {ativos.map(a => (
            <option key={a.id} value={a.id}>{a.ticker} — {a.nome}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Mês</label>
          <select className="input" value={f.mes} onChange={e => set("mes", +e.target.value)}>
            {["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"].map((m,i) => (
              <option key={i} value={i+1}>{m}</option>
            ))}
          </select></div>
        <div><label className="label">Ano</label>
          <input className="input" type="number" value={f.ano} onChange={e => set("ano", +e.target.value)} /></div>
        <div><label className="label">Cotas Compradas *</label>
          <input className="input" type="number" step="1" value={f.cotas_compradas||""} onChange={e => set("cotas_compradas", +e.target.value)} /></div>
        <div><label className="label">Valor Total (R$)</label>
          <input className="input" type="number" step="0.01" value={f.valor||""} onChange={e => set("valor", +e.target.value)} /></div>
      </div>
      {/* Preview automático do dividendo adicionado */}
      {divAdicionado > 0 && (
        <div className="bg-teal/8 border border-teal/20 rounded-xl p-3 space-y-1">
          <div className="text-[9px] text-teal/80 uppercase tracking-[2px] font-bold">Impacto automático</div>
          <div className="flex justify-between text-xs">
            <span className="text-muted">Dividendo adicionado à carteira:</span>
            <span className="text-teal font-bold">+{brl(divAdicionado)}/mês</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted">Cotas de {ativo?.ticker} após compra:</span>
            <span className="text-white font-bold">{Number(ativo?.cotas||0) + f.cotas_compradas}</span>
          </div>
        </div>
      )}
      <div className="flex justify-end gap-2 pt-3 border-t border-white/[.06] mt-2">
        <button className="btn-gold" onClick={() => onSave(f)}>💾 Registrar Compra</button>
      </div>
    </div>
  );
}

// ── FORM: META ─────────────────────────────────────────────
function MetaForm({ meta, dividendoAtual, onSave }: {
  meta: Meta | null; dividendoAtual: number; onSave: (f: Partial<Meta>) => void;
}) {
  const [f, setF] = useState<Partial<Meta>>(meta || {
    nome:"Meta de Dividendos — R$100/mês", tipo:"FIIs",
    atual: dividendoAtual, objetivo: 100,
    aporte_mes: 1500, prazo:"", descricao:""
  });
  const set = (k: string, v: any) => setF(prev => ({ ...prev, [k]: v }));

  return (
    <div className="space-y-3">
      <div><label className="label">Nome da Meta *</label>
        <input className="input" value={f.nome||""} onChange={e => set("nome", e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Dividendo Objetivo (R$/mês) *</label>
          <input className="input" type="number" step="0.01" value={f.objetivo||""} onChange={e => set("objetivo", +e.target.value)} /></div>
        <div><label className="label">Aporte Mensal Planejado (R$)</label>
          <input className="input" type="number" step="0.01" value={f.aporte_mes||""} onChange={e => set("aporte_mes", +e.target.value)} /></div>
        <div className="col-span-2"><label className="label">Prazo</label>
          <input className="input" type="month" value={f.prazo||""} onChange={e => set("prazo", e.target.value)} /></div>
        <div className="col-span-2"><label className="label">Descrição / Motivação</label>
          <textarea className="input" rows={2} value={f.descricao||""} onChange={e => set("descricao", e.target.value)} /></div>
      </div>
      <div className="bg-amber-500/8 border border-amber-500/20 rounded-lg px-3 py-2 text-xs text-amber-400">
        📊 Dividendo atual da carteira: <strong>{brl(dividendoAtual)}/mês</strong>
        {f.objetivo && f.objetivo > dividendoAtual &&
          ` · Faltam ${brl(f.objetivo - dividendoAtual)}/mês`}
      </div>
      <div className="flex justify-end gap-2 pt-3 border-t border-white/[.06]">
        <button className="btn-gold" onClick={() => onSave(f)}>🎯 Salvar Meta</button>
      </div>
    </div>
  );
}
