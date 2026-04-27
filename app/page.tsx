
"use client";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Sidebar from "@/components/Sidebar";
import { brl, calcDividendoMensal } from "@/lib/dividends";
import type { Lancamento, Ativo, Meta, Config } from "@/types";
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from "recharts";

const MESES = ["","Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function KpiCard({ label, value, sub, color, icon }: {
  label: string; value: string; sub?: string; color: string; icon: string;
}) {
  return (
    <div className="card relative overflow-hidden hover:-translate-y-0.5 transition-transform">
      <div className="absolute top-0 left-0 right-0 h-0.5"
        style={{ background: `linear-gradient(90deg,transparent,${color},transparent)` }} />
      <div className="absolute top-[-30px] right-[-30px] w-20 h-20 rounded-full opacity-40"
        style={{ background: color, filter: "blur(25px)" }} />
      <div className="text-[9px] uppercase tracking-[2px] mb-2" style={{ color }}>{icon} {label}</div>
      <div className="font-display text-xl font-bold text-white leading-none">{value}</div>
      {sub && <div className="text-[10px] mt-1.5" style={{ color }}>{sub}</div>}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[rgba(10,9,20,.96)] border border-violet/30 rounded-lg px-3 py-2 text-xs">
      <p className="text-violet-l mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {brl(p.value)}</p>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const [user, setUser]       = useState<any>(null);
  const [lancs, setLancs]     = useState<Lancamento[]>([]);
  const [ativos, setAtivos]   = useState<Ativo[]>([]);
  const [metas, setMetas]     = useState<Meta[]>([]);
  const [config, setConfig]   = useState<Config>({ salario: 600 });
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const sb = createClient();

  const load = useCallback(async () => {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { router.push("/auth"); return; }
    setUser(user);

    const [l, a, m, cfg] = await Promise.all([
      sb.from("lancamentos").select("*").eq("user_id", user.id),
      sb.from("ativos").select("*").eq("user_id", user.id),
      sb.from("metas").select("*").eq("user_id", user.id),
      sb.from("config").select("*").eq("user_id", user.id).maybeSingle(),
    ]);
    setLancs(l.data || []);
    setAtivos(a.data || []);
    setMetas(m.data || []);
    if (cfg.data) setConfig({ salario: Number(cfg.data.salario) });
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="text-violet-l font-mono text-sm animate-pulse">Carregando...</div>
    </div>
  );

  const sal = config.salario;
  const receita = sal * 12 + lancs.filter(l => l.cat === "Renda Extra").reduce((s,l) => s + Number(l.valor), 0);
  const gasto   = lancs.filter(l => l.cat !== "Renda Extra").reduce((s,l) => s + Number(l.valor), 0);
  const saldo   = receita - gasto;
  const patrimonio = ativos.reduce((s,a) => s + Number(a.atual), 0);

  // DIVIDENDO AUTO-CALCULADO
  const dividendoMensal = calcDividendoMensal(ativos);
  const metaDividendo   = metas.find(m => m.nome.toLowerCase().includes("dividendo"))?.objetivo || 100;
  const healthPct       = receita > 0 ? Math.min(100, (saldo / receita) * 100) : 0;

  // Chart data
  const byMes = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const g = lancs.filter(l => l.mes === m && l.cat !== "Renda Extra").reduce((s,l) => s + Number(l.valor), 0);
    const ex= lancs.filter(l => l.mes === m && l.cat === "Renda Extra").reduce((s,l) => s + Number(l.valor), 0);
    return { name: MESES[m], receita: sal + ex, gasto: g, saldo: sal + ex - g };
  });

  // Top ativos por dividendo
  const topAtivos = [...ativos].filter(a => a.div_mensal > 0)
    .sort((a, b) => Number(b.div_mensal) - Number(a.div_mensal)).slice(0, 5);

  return (
    <div className="flex bg-bg min-h-screen">
      <Sidebar
        userEmail={user?.email}
        healthPct={healthPct}
        patrimoniTotal={patrimonio}
        dividendoMensal={dividendoMensal}
        metaDividendo={metaDividendo}
      />
      <main className="ml-56 flex-1 p-7">
        {/* Header */}
        <div className="flex justify-between items-center mb-6 fade-up">
          <div>
            <h1 className="font-display text-2xl font-black text-white">Visão Geral</h1>
            <p className="text-muted text-[9px] tracking-[2px] uppercase mt-0.5">
              Exercício Anual · {new Date().getFullYear()}
            </p>
          </div>
          <a href="/lancamentos"
            className="bg-violet text-white text-xs font-bold px-4 py-2.5 rounded-lg hover:bg-violet-600 transition-all tracking-wide">
            ＋ Lançamento
          </a>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-4 gap-3.5 mb-5 fade-up">
          <KpiCard label="Receita Anual" value={brl(receita)} sub={`R$ ${sal}/mês`} color="#34d399" icon="💰" />
          <KpiCard label="Total Gasto"   value={brl(gasto)}   sub={`${receita > 0 ? ((gasto/receita)*100).toFixed(1) : 0}% da receita`} color="#fbbf24" icon="📤" />
          <KpiCard label="Saldo Livre"   value={brl(saldo)}   sub={`${healthPct.toFixed(1)}% guardado`} color={saldo >= 0 ? "#7c6af7" : "#f87171"} icon="💎" />
          <KpiCard label="Patrimônio"    value={brl(patrimonio)} sub="Investido" color="#f59e0b" icon="🏦" />
        </div>

        {/* DESTAQUE: Progresso Dividendos */}
        <div className="card mb-5 fade-up border-amber-500/20 bg-gradient-to-r from-amber-500/5 to-transparent">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-amber-400 text-sm">📈</span>
                <span className="text-[10px] text-amber-400/80 tracking-[2px] uppercase font-bold">
                  Dividendos Mensais — Progresso Automático
                </span>
              </div>
              <p className="text-[9px] text-muted">Atualiza automaticamente ao registrar compras de ações/FIIs</p>
            </div>
            <div className="text-right">
              <div className="font-display text-2xl font-black text-amber-400">{brl(dividendoMensal)}</div>
              <div className="text-[9px] text-muted">de {brl(metaDividendo)}/mês</div>
            </div>
          </div>
          <div className="h-3 bg-white/5 rounded-full overflow-hidden mb-2">
            <div className="h-full rounded-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-1000"
              style={{ width: `${Math.min(100, metaDividendo > 0 ? (dividendoMensal/metaDividendo)*100 : 0)}%` }} />
          </div>
          <div className="flex justify-between text-[9px] text-muted">
            <span>{metaDividendo > 0 ? ((dividendoMensal/metaDividendo)*100).toFixed(1) : 0}% da meta</span>
            <span>Faltam {brl(Math.max(0, metaDividendo - dividendoMensal))}/mês</span>
          </div>
          {topAtivos.length > 0 && (
            <div className="mt-3 pt-3 border-t border-white/[.04] flex gap-2 flex-wrap">
              {topAtivos.map(a => (
                <div key={a.id} className="flex items-center gap-1.5 bg-amber-500/8 border border-amber-500/15 rounded-lg px-2.5 py-1.5">
                  <span className="font-bold text-amber-400 text-[10px]">{a.ticker}</span>
                  <span className="text-muted text-[9px]">{brl(Number(a.div_mensal))}/mês</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-3 gap-4 mb-5 fade-up">
          <div className="card col-span-2">
            <div className="text-[10px] text-violet-l tracking-[1.5px] uppercase font-bold mb-4">
              Receita vs Gasto por Mês
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={byMes} barGap={3}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill:"#475569", fontSize:9, fontFamily:"JetBrains Mono" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill:"#475569", fontSize:9 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="receita" name="Receita" fill="#34d399" fillOpacity={0.65} radius={[4,4,0,0]} />
                <Bar dataKey="gasto"   name="Gasto"   fill="#7c6af7" fillOpacity={0.85} radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card">
            <div className="text-[10px] text-teal tracking-[1.5px] uppercase font-bold mb-4">Saldo Mensal</div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={byMes}>
                <defs>
                  <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#34d399" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#34d399" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill:"#475569", fontSize:9 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill:"#475569", fontSize:9 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="saldo" name="Saldo" stroke="#34d399" strokeWidth={2} fill="url(#sg)" dot={{ fill:"#34d399", r:3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent launches */}
        <div className="card fade-up">
          <div className="flex justify-between items-center mb-4">
            <div className="text-[10px] text-muted tracking-[1.5px] uppercase font-bold">
              Últimos Lançamentos
            </div>
            <a href="/lancamentos" className="text-[9px] text-violet-l hover:text-violet transition-colors">
              Ver todos →
            </a>
          </div>
          {lancs.length === 0 ? (
            <div className="text-center py-8 text-muted text-xs">
              Nenhum lançamento ainda.{" "}
              <a href="/lancamentos" className="text-violet-l hover:underline">Adicionar agora</a>
            </div>
          ) : (
            <div className="space-y-1">
              {[...lancs].sort((a,b) => b.id - a.id).slice(0, 6).map(l => (
                <div key={l.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-white/[.02] transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-[9px] text-muted w-12 shrink-0">{MESES[l.mes]}</span>
                    <span className="text-xs text-white/80">{l.descricao}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold font-mono">{brl(Number(l.valor))}</span>
                    <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full ${
                      l.status === "Pago"
                        ? "bg-teal/10 text-teal"
                        : "bg-amber/10 text-amber"
                    }`}>{l.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
