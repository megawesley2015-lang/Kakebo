
"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Sidebar from "@/components/Sidebar";
import { brl, calcDividendoMensal } from "@/lib/dividends";
import type { Divida, Ativo, Meta } from "@/types";

export default function Dividas() {
  const [user, setUser]     = useState<any>(null);
  const [dividas, setDividas] = useState<Divida[]>([]);
  const [ativos, setAtivos] = useState<Ativo[]>([]);
  const [metas, setMetas]   = useState<Meta[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [edit, setEdit]     = useState<Divida | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const sb = createClient();

  const load = useCallback(async () => {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { router.push("/auth"); return; }
    setUser(user);
    const [d, a, m] = await Promise.all([
      sb.from("dividas").select("*").eq("user_id", user.id),
      sb.from("ativos").select("*").eq("user_id", user.id),
      sb.from("metas").select("*").eq("user_id", user.id),
    ]);
    setDividas(d.data || []);
    setAtivos(a.data || []);
    setMetas(m.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function salvar(form: Partial<Divida>) {
    const uid = user?.id;
    const data = { user_id: uid, credor: form.credor, descricao: form.descricao, valor: form.valor, status: form.status };
    if (edit) { await sb.from("dividas").update(data).eq("id", edit.id); }
    else { await sb.from("dividas").insert(data); }
    setShowModal(false); setEdit(null);
    await load();
  }

  async function excluir(id: number) {
    if (!confirm("Excluir esta dívida?")) return;
    await sb.from("dividas").delete().eq("id", id);
    await load();
  }

  if (loading) return <div className="min-h-screen bg-bg flex items-center justify-center"><div className="text-violet-l animate-pulse">Carregando...</div></div>;

  const total  = dividas.reduce((s,d) => s + Number(d.valor), 0);
  const pendente = dividas.filter(d => d.status === "Pendente").reduce((s,d) => s + Number(d.valor), 0);
  const divMensal = calcDividendoMensal(ativos);
  const metaDiv   = metas.find(m => m.nome.toLowerCase().includes("dividendo"))?.objetivo || 100;
  const credores  = [...new Set(dividas.map(d => d.credor))];

  return (
    <div className="flex bg-bg min-h-screen">
      <Sidebar userEmail={user?.email} healthPct={0} patrimoniTotal={ativos.reduce((s,a)=>s+Number(a.atual),0)} dividendoMensal={divMensal} metaDividendo={metaDiv} />
      <main className="ml-56 flex-1 p-7">
        <div className="flex justify-between items-center mb-6">
          <div><h1 className="font-display text-2xl font-black text-white">Dívidas</h1></div>
          <button onClick={() => { setEdit(null); setShowModal(true); }}
            className="bg-rose/20 text-rose border border-rose/30 text-xs font-bold px-4 py-2.5 rounded-lg hover:bg-rose/30 transition-all border-solid cursor-pointer">
            ＋ Nova Dívida
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { l:"⚠️ Total Dívidas", v: brl(total),    c:"#f87171" },
            { l:"⏳ Pendente",      v: brl(pendente),  c:"#fbbf24" },
            { l:"✓ Quitado",        v: brl(total-pendente), c:"#34d399" },
          ].map((k,i) => (
            <div key={i} className="card">
              <div className="text-[9px] uppercase tracking-[2px] mb-1" style={{color:k.c}}>{k.l}</div>
              <div className="font-display text-xl font-bold" style={{color:k.c}}>{k.v}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          {credores.map(cred => {
            const tot = dividas.filter(d => d.credor === cred).reduce((s,d) => s + Number(d.valor), 0);
            return (
              <div key={cred} className="card border-rose/20">
                <div className="text-[9px] text-rose/80 uppercase tracking-[2px] mb-1">{cred}</div>
                <div className="font-display font-bold text-rose text-xl">{brl(tot)}</div>
                <div className="h-1 bg-white/5 rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-rose/60 rounded-full" style={{ width: `${total > 0 ? (tot/total)*100 : 0}%` }} />
                </div>
                <div className="text-[9px] text-muted mt-1">{total > 0 ? ((tot/total)*100).toFixed(1) : 0}% do total</div>
              </div>
            );
          })}
        </div>

        <div className="card">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/[.06]">
                {["Credor","Descrição","Valor","Status","Ações"].map(h => (
                  <th key={h} className="text-left py-2.5 px-3 text-[9px] uppercase tracking-[1.5px] text-muted font-bold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dividas.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-muted">Nenhuma dívida! 🎉</td></tr>
              ) : dividas.map(d => (
                <tr key={d.id} className="border-b border-white/[.03] hover:bg-white/[.01]">
                  <td className="py-3 px-3 font-bold text-rose">{d.credor}</td>
                  <td className="py-3 px-3">{d.descricao}</td>
                  <td className="py-3 px-3 font-bold font-mono">{brl(Number(d.valor))}</td>
                  <td className="py-3 px-3">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${d.status==="Pago"?"bg-teal/10 text-teal":"bg-amber/10 text-amber"}`}>
                      {d.status==="Pago"?"✓ Pago":"⏳ Pendente"}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex gap-2">
                      <button onClick={() => { setEdit(d); setShowModal(true); }} className="hover:text-violet-l bg-transparent border-none cursor-pointer">✏️</button>
                      <button onClick={() => excluir(d.id)} className="hover:text-rose bg-transparent border-none cursor-pointer">🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {showModal && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-5"
            onClick={e => e.target === e.currentTarget && setShowModal(false)}>
            <div className="bg-[#0f0e1a] border border-white/[.08] rounded-2xl p-7 w-full max-w-md">
              <div className="font-display text-lg font-bold mb-5">{edit ? "✏️ Editar" : "＋ Nova Dívida"}</div>
              <DividaForm divida={edit} onSave={salvar} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function DividaForm({ divida, onSave }: { divida: Divida | null; onSave: (f: Partial<Divida>) => void }) {
  const [f, setF] = useState<Partial<Divida>>(divida || { credor:"", descricao:"", valor:undefined, status:"Pendente" });
  const set = (k: string, v: any) => setF(prev => ({...prev, [k]: v}));
  return (
    <div className="space-y-3">
      <div><label className="label">Credor *</label>
        <input className="input" placeholder="Nome de quem você deve" value={f.credor||""} onChange={e => set("credor", e.target.value)} /></div>
      <div><label className="label">Descrição *</label>
        <input className="input" placeholder="O que foi comprado/emprestado" value={f.descricao||""} onChange={e => set("descricao", e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Valor (R$)</label>
          <input className="input" type="number" step="0.01" value={f.valor||""} onChange={e => set("valor", +e.target.value)} /></div>
        <div><label className="label">Status</label>
          <select className="input" value={f.status} onChange={e => set("status", e.target.value)}>
            <option>Pendente</option><option>Pago</option>
          </select></div>
      </div>
      <div className="flex justify-end pt-3 border-t border-white/[.06]">
        <button className="bg-rose/20 text-rose border border-rose/30 text-xs font-bold px-4 py-2.5 rounded-lg border-solid cursor-pointer hover:bg-rose/30"
          onClick={() => onSave(f)}>💾 Salvar</button>
      </div>
    </div>
  );
}
