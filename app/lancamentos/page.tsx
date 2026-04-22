
"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Sidebar from "@/components/Sidebar";
import { brl, calcDividendoMensal } from "@/lib/dividends";
import type { Lancamento, Ativo, Meta, Config } from "@/types";

const MESES = ["","Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const CATS  = ["Gastos Gerais","Cartão de Crédito","Assinatura","Renda Extra","Outro"];
const CAT_COLOR: Record<string,string> = {
  "Gastos Gerais":     "#7c6af7",
  "Cartão de Crédito": "#fbbf24",
  "Assinatura":        "#34d399",
  "Renda Extra":       "#34d399",
};

export default function Lancamentos() {
  const [user, setUser]       = useState<any>(null);
  const [lancs, setLancs]     = useState<Lancamento[]>([]);
  const [ativos, setAtivos]   = useState<Ativo[]>([]);
  const [metas, setMetas]     = useState<Meta[]>([]);
  const [config, setConfig]   = useState<Config>({ salario: 600 });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editLanc, setEditLanc]   = useState<Lancamento | null>(null);
  const [filterMes, setFilterMes] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [filterSt,  setFilterSt]  = useState("");
  const [search,    setSearch]    = useState("");
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

  async function salvar(form: Partial<Lancamento>) {
    const uid = user?.id;
    const data = { user_id: uid, mes: form.mes, cat: form.cat, descricao: form.descricao, valor: form.valor, status: form.status, ano: form.ano || new Date().getFullYear(), obs: form.obs || "" };
    if (editLanc) {
      await sb.from("lancamentos").update(data).eq("id", editLanc.id);
    } else {
      await sb.from("lancamentos").insert(data);
    }
    setShowModal(false); setEditLanc(null);
    await load();
  }

  async function excluir(id: number) {
    if (!confirm("Excluir este lançamento?")) return;
    await sb.from("lancamentos").delete().eq("id", id);
    await load();
  }

  if (loading) return <div className="min-h-screen bg-bg flex items-center justify-center"><div className="text-violet-l animate-pulse">Carregando...</div></div>;

  const sal = config.salario;
  const receita = sal * 12 + lancs.filter(l => l.cat === "Renda Extra").reduce((s,l) => s + Number(l.valor), 0);
  const gasto   = lancs.filter(l => l.cat !== "Renda Extra").reduce((s,l) => s + Number(l.valor), 0);
  const saldo   = receita - gasto;
  const divMensal  = calcDividendoMensal(ativos);
  const metaDiv    = metas.find(m => m.nome.toLowerCase().includes("dividendo"))?.objetivo || 100;
  const healthPct  = receita > 0 ? Math.min(100, (saldo/receita)*100) : 0;
  const patrimonio = ativos.reduce((s,a) => s + Number(a.atual), 0);

  const list = lancs.filter(l => {
    if (filterMes && String(l.mes) !== filterMes) return false;
    if (filterCat && l.cat !== filterCat) return false;
    if (filterSt  && l.status !== filterSt) return false;
    if (search && !l.descricao.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).sort((a,b) => a.mes - b.mes);

  const totalFiltrado = list.reduce((s,l) => s + Number(l.valor), 0);
  const pagoFiltrado  = list.filter(l => l.status === "Pago").reduce((s,l) => s + Number(l.valor), 0);

  return (
    <div className="flex bg-bg min-h-screen">
      <Sidebar userEmail={user?.email} healthPct={healthPct} patrimoniTotal={patrimonio} dividendoMensal={divMensal} metaDividendo={metaDiv} />
      <main className="ml-56 flex-1 p-7">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="font-display text-2xl font-black text-white">Lançamentos</h1>
            <p className="text-muted text-[9px] tracking-[2px] uppercase mt-0.5">{list.length} registros · Total: {brl(totalFiltrado)}</p>
          </div>
          <button onClick={() => { setEditLanc(null); setShowModal(true); }} className="bg-violet text-white text-xs font-bold px-4 py-2.5 rounded-lg hover:bg-violet-600 transition-all border-none cursor-pointer">
            ＋ Novo Lançamento
          </button>
        </div>

        {/* KPIs rápidos */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { l:"Receita Anual", v: brl(receita), c:"#34d399" },
            { l:"Total Gasto",   v: brl(gasto),   c:"#fbbf24" },
            { l:"Saldo",         v: brl(saldo),   c: saldo>=0 ? "#7c6af7" : "#f87171" },
          ].map((k,i) => (
            <div key={i} className="card">
              <div className="text-[9px] uppercase tracking-[2px] mb-1" style={{color:k.c}}>{k.l}</div>
              <div className="font-display text-lg font-bold" style={{color:k.c}}>{k.v}</div>
            </div>
          ))}
        </div>

        <div className="card">
          {/* Filtros */}
          <div className="flex gap-2 mb-4 flex-wrap">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-xs">🔍</span>
              <input className="input pl-8 w-48" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="input w-36" value={filterMes} onChange={e => setFilterMes(e.target.value)}>
              <option value="">Todos os meses</option>
              {MESES.slice(1).map((m,i) => <option key={i} value={i+1}>{m}</option>)}
            </select>
            <select className="input w-44" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
              <option value="">Todas categorias</option>
              {CATS.map(c => <option key={c}>{c}</option>)}
            </select>
            <select className="input w-32" value={filterSt} onChange={e => setFilterSt(e.target.value)}>
              <option value="">Todos status</option>
              <option>Pago</option><option>Pendente</option>
            </select>
            {(filterMes||filterCat||filterSt||search) && (
              <button onClick={() => { setFilterMes(""); setFilterCat(""); setFilterSt(""); setSearch(""); }}
                className="text-xs text-muted hover:text-rose bg-transparent border-none cursor-pointer">✕ Limpar</button>
            )}
            {list.length > 0 && (
              <div className="ml-auto flex items-center gap-3 text-xs text-muted">
                <span>Pago: <strong className="text-teal">{brl(pagoFiltrado)}</strong></span>
                <span>Pendente: <strong className="text-amber">{brl(totalFiltrado - pagoFiltrado)}</strong></span>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[.06]">
                  {["Mês","Categoria","Descrição","Valor","Status","Ações"].map(h => (
                    <th key={h} className="text-left py-2.5 px-3 text-[9px] uppercase tracking-[1.5px] text-muted font-bold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-muted">
                    Nenhum lançamento encontrado.{" "}
                    <button onClick={() => setShowModal(true)} className="text-violet-l bg-transparent border-none cursor-pointer hover:underline">Adicionar agora</button>
                  </td></tr>
                ) : list.map(l => {
                  const cor = CAT_COLOR[l.cat] || "#94a3b8";
                  return (
                    <tr key={l.id} className="border-b border-white/[.03] hover:bg-white/[.01] transition-colors">
                      <td className="py-3 px-3 text-muted">{MESES[l.mes]}</td>
                      <td className="py-3 px-3">
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: cor+"18", color: cor }}>{l.cat}</span>
                      </td>
                      <td className="py-3 px-3 text-white/80 max-w-[200px] truncate">{l.descricao}</td>
                      <td className="py-3 px-3 font-bold font-mono">{brl(Number(l.valor))}</td>
                      <td className="py-3 px-3">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${l.status === "Pago" ? "bg-teal/10 text-teal" : "bg-amber/10 text-amber"}`}>
                          {l.status === "Pago" ? "✓ Pago" : "⏳ Pendente"}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex gap-2">
                          <button onClick={() => { setEditLanc(l); setShowModal(true); }}
                            className="hover:text-violet-l bg-transparent border-none cursor-pointer transition-colors">✏️</button>
                          <button onClick={() => excluir(l.id)}
                            className="hover:text-rose bg-transparent border-none cursor-pointer transition-colors">🗑</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-5"
            onClick={e => e.target === e.currentTarget && setShowModal(false)}>
            <div className="bg-[#0f0e1a] border border-white/[.08] rounded-2xl p-7 w-full max-w-lg">
              <div className="font-display text-lg font-bold mb-5">{editLanc ? "✏️ Editar" : "＋ Novo Lançamento"}</div>
              <LancForm lanc={editLanc} onSave={salvar} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function LancForm({ lanc, onSave }: { lanc: Lancamento | null; onSave: (f: Partial<Lancamento>) => void }) {
  const now = new Date();
  const [f, setF] = useState<Partial<Lancamento>>(lanc || {
    mes: now.getMonth()+1, cat: "Gastos Gerais", descricao: "", valor: undefined,
    status: "Pendente", ano: now.getFullYear(), obs: ""
  });
  const set = (k: string, v: any) => setF(prev => ({...prev, [k]: v}));
  const MESES_OPT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Mês</label>
          <select className="input" value={f.mes} onChange={e => set("mes", +e.target.value)}>
            {MESES_OPT.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
          </select></div>
        <div><label className="label">Categoria</label>
          <select className="input" value={f.cat} onChange={e => set("cat", e.target.value)}>
            {["Gastos Gerais","Cartão de Crédito","Assinatura","Renda Extra","Outro"].map(c => <option key={c}>{c}</option>)}
          </select></div>
        <div className="col-span-2"><label className="label">Descrição *</label>
          <input className="input" placeholder="Ex: Conta de luz, Netflix..." value={f.descricao||""} onChange={e => set("descricao", e.target.value)} /></div>
        <div><label className="label">Valor (R$) *</label>
          <input className="input" type="number" step="0.01" min="0" placeholder="0,00" value={f.valor||""} onChange={e => set("valor", +e.target.value)} /></div>
        <div><label className="label">Status</label>
          <select className="input" value={f.status} onChange={e => set("status", e.target.value)}>
            <option>Pendente</option><option>Pago</option>
          </select></div>
        <div className="col-span-2"><label className="label">Observação</label>
          <input className="input" placeholder="Opcional..." value={f.obs||""} onChange={e => set("obs", e.target.value)} /></div>
      </div>
      <div className="flex justify-end gap-2 pt-3 border-t border-white/[.06]">
        <button className="bg-violet text-white text-xs font-bold px-4 py-2.5 rounded-lg hover:bg-violet-600 border-none cursor-pointer"
          onClick={() => onSave(f)}>💾 Salvar</button>
      </div>
    </div>
  );
}
