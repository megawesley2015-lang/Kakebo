"use client";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Sidebar from "@/components/Sidebar";
import { brl, calcDividendoMensal } from "@/lib/dividends";
import type { Lancamento, Ativo } from "@/types";

const CATS_GASTO = ["Gastos Gerais", "Cartão de Crédito", "Assinatura", "Outro"];
const CATS_TODAS = [...CATS_GASTO, "Renda Extra"];
const CATS_PARCELAVEL = ["Gastos Gerais", "Cartão de Crédito", "Assinatura"];
const MESES_A = ["","Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const MESES_F = ["","Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

export default function Lancamentos() {
  const [user, setUser] = useState<any>(null);
  const [lancs, setLancs] = useState<Lancamento[]>([]);
  const [ativos, setAtivos] = useState<Ativo[]>([]);
  const [loading, setLoading] = useState(true);
  const [mesFiltro, setMesFiltro] = useState(new Date().getMonth() + 1);
  const [showModal, setShowModal] = useState(false);
  const [deletingLanc, setDeletingLanc] = useState<Lancamento | null>(null);

  // Form state
  const [form, setForm] = useState({
    cat: "Gastos Gerais",
    descricao: "",
    valor: "",
    status: "Pendente" as "Pago" | "Pendente",
    parcelar: false,
    parcelas: "2",
    mesInicio: new Date().getMonth() + 1,
  });

  const router = useRouter();
  const sb = createClient();

  const load = useCallback(async () => {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { router.push("/auth"); return; }
    setUser(user);
    const [l, a] = await Promise.all([
      sb.from("lancamentos").select("*").eq("user_id", user.id)
        .order("ano", { ascending: false })
        .order("mes", { ascending: false })
        .order("id", { ascending: false }),
      sb.from("ativos").select("*").eq("user_id", user.id),
    ]);
    setLancs(l.data || []);
    setAtivos(a.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function gerarUUID(): string {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  async function salvarLancamento() {
    if (!form.descricao || !form.valor) return;
    const ano = new Date().getFullYear();
    const valorParcela = Number(form.valor);

    if (!form.parcelar || !CATS_PARCELAVEL.includes(form.cat)) {
      await sb.from("lancamentos").insert({
        user_id: user.id,
        mes: form.mesInicio,
        ano,
        cat: form.cat,
        descricao: form.descricao,
        valor: valorParcela,
        status: form.status,
      });
    } else {
      const totalParcelas = Math.max(2, Math.min(60, Number(form.parcelas) || 2));
      const compraId = gerarUUID();
      const registros = [];
      for (let i = 0; i < totalParcelas; i++) {
        const mesAtual = form.mesInicio + i;
        const mes = ((mesAtual - 1) % 12) + 1;
        const anoParcela = ano + Math.floor((mesAtual - 1) / 12);
        registros.push({
          user_id: user.id,
          mes,
          ano: anoParcela,
          cat: form.cat,
          descricao: `${form.descricao} (${i + 1}/${totalParcelas})`,
          valor: valorParcela,
          status: i === 0 ? form.status : "Pendente",
          compra_id: compraId,
          parcela_num: i + 1,
          parcelas_total: totalParcelas,
        });
      }
      await sb.from("lancamentos").insert(registros);
    }

    setShowModal(false);
    resetForm();
    await load();
  }

  function resetForm() {
    setForm({
      cat: "Gastos Gerais",
      descricao: "",
      valor: "",
      status: "Pendente",
      parcelar: false,
      parcelas: "2",
      mesInicio: new Date().getMonth() + 1,
    });
  }

  async function toggleStatus(l: Lancamento) {
    const novoStatus = l.status === "Pago" ? "Pendente" : "Pago";
    await sb.from("lancamentos").update({ status: novoStatus }).eq("id", l.id);
    await load();
  }

  async function excluirSoEsta() {
    if (!deletingLanc) return;
    await sb.from("lancamentos").delete().eq("id", deletingLanc.id);
    setDeletingLanc(null);
    await load();
  }

  async function excluirTodasRestantes() {
    if (!deletingLanc || !deletingLanc.compra_id) return;
    await sb.from("lancamentos")
      .delete()
      .eq("compra_id", deletingLanc.compra_id)
      .gte("parcela_num", deletingLanc.parcela_num || 0);
    setDeletingLanc(null);
    await load();
  }

  async function excluirTodoGrupo() {
    if (!deletingLanc || !deletingLanc.compra_id) return;
    await sb.from("lancamentos").delete().eq("compra_id", deletingLanc.compra_id);
    setDeletingLanc(null);
    await load();
  }

  if (loading) return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="text-violet-l animate-pulse">Carregando...</div>
    </div>
  );

  const divMensal = calcDividendoMensal(ativos);
  const patrimonio = ativos.reduce((s, a) => s + Number(a.atual), 0);

  const lancsFiltrados = lancs.filter(l => l.mes === mesFiltro);
  const totalMes = lancsFiltrados.filter(l => l.cat !== "Renda Extra").reduce((s, l) => s + Number(l.valor), 0);
  const totalRenda = lancsFiltrados.filter(l => l.cat === "Renda Extra").reduce((s, l) => s + Number(l.valor), 0);

  const parcelasPreview = form.parcelar && CATS_PARCELAVEL.includes(form.cat) && form.valor
    ? Array.from({ length: Math.max(2, Math.min(60, Number(form.parcelas) || 2)) }, (_, i) => {
        const mesAtual = form.mesInicio + i;
        const mes = ((mesAtual - 1) % 12) + 1;
        return MESES_A[mes];
      })
    : [];

  return (
    <div className="flex bg-bg min-h-screen">
      <Sidebar userEmail={user?.email} healthPct={0} patrimoniTotal={patrimonio}
        dividendoMensal={divMensal} metaDividendo={100} />
      <main className="ml-56 flex-1 p-7">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="font-display text-2xl font-black text-white">Lançamentos</h1>
            <p className="text-muted text-[9px] tracking-[2px] uppercase mt-0.5">
              {MESES_F[mesFiltro]} · {lancsFiltrados.length} itens · Total: {brl(totalMes)}
              {totalRenda > 0 && ` · Renda extra: +${brl(totalRenda)}`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select className="input w-40" value={mesFiltro} onChange={e => setMesFiltro(+e.target.value)}>
              {MESES_F.slice(1).map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <button onClick={() => setShowModal(true)}
              className="bg-violet text-white text-xs font-bold px-5 py-2.5 rounded-lg border-none cursor-pointer hover:opacity-90 transition-all">
              ＋ Novo Lançamento
            </button>
          </div>
        </div>

        {/* Lista de lançamentos */}
        <div className="card">
          {lancsFiltrados.length === 0 ? (
            <div className="text-center py-10 text-muted text-xs">
              Nenhum lançamento em {MESES_F[mesFiltro]}.
              {" "}
              <button onClick={() => setShowModal(true)}
                className="text-violet-l hover:underline bg-transparent border-none cursor-pointer">
                Criar primeiro →
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {lancsFiltrados.map(l => {
                const isParcela = !!l.compra_id;
                const isRenda = l.cat === "Renda Extra";
                const cor = isRenda ? "#34d399" : l.status === "Pago" ? "#94a3b8" : "#fbbf24";
                return (
                  <div key={l.id} className="flex items-center justify-between p-3 rounded-xl"
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(255,255,255,0.06)"
                    }}>
                    <div className="flex items-center gap-3 flex-1">
                      <button onClick={() => toggleStatus(l)}
                        disabled={isRenda}
                        className="w-5 h-5 rounded-md border cursor-pointer flex items-center justify-center text-[10px] font-bold transition-all"
                        style={{
                          borderColor: l.status === "Pago" ? "#34d399" : "rgba(255,255,255,0.2)",
                          background: l.status === "Pago" ? "rgba(52,211,153,0.15)" : "transparent",
                          color: l.status === "Pago" ? "#34d399" : "transparent",
                          opacity: isRenda ? 0.4 : 1,
                          cursor: isRenda ? "default" : "pointer",
                        }}>
                        ✓
                      </button>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">{l.descricao}</span>
                          {isParcela && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                              style={{ background: "rgba(124,106,247,0.15)", color: "#a89ef7" }}>
                              🔗 parcelado
                            </span>
                          )}
                        </div>
                        <div className="text-[9px] text-muted flex items-center gap-2">
                          <span>{l.cat}</span>
                          <span>·</span>
                          <span style={{ color: cor }}>{l.status}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="font-display font-bold text-base"
                        style={{ color: isRenda ? "#34d399" : "#e2e8f0" }}>
                        {isRenda ? "+" : ""}{brl(Number(l.valor))}
                      </div>
                      <button onClick={() => setDeletingLanc(l)}
                        className="text-rose hover:opacity-70 bg-transparent border-none cursor-pointer text-xs">
                        🗑
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Novo Lançamento */}
        {showModal && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-5"
            onClick={e => e.target === e.currentTarget && setShowModal(false)}>
            <div className="bg-surface border border-white/[.08] rounded-2xl p-7 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="font-display text-lg font-bold mb-5">＋ Novo Lançamento</div>
              <div className="space-y-3">
                <div>
                  <label className="label">Categoria *</label>
                  <select className="input" value={form.cat}
                    onChange={e => setForm(f => ({ ...f, cat: e.target.value, parcelar: false }))}>
                    {CATS_TODAS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="label">Descrição *</label>
                  <input className="input" placeholder="Ex: Geladeira Eletro" value={form.descricao}
                    onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">
                      Valor {form.parcelar ? "(por parcela)" : ""} *
                    </label>
                    <input className="input" type="number" step="0.01" placeholder="0,00"
                      value={form.valor}
                      onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Mês {form.parcelar ? "(1ª parcela)" : ""}</label>
                    <select className="input" value={form.mesInicio}
                      onChange={e => setForm(f => ({ ...f, mesInicio: +e.target.value }))}>
                      {MESES_F.slice(1).map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                    </select>
                  </div>
                </div>

                {form.cat !== "Renda Extra" && (
                  <div>
                    <label className="label">Status</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(["Pendente", "Pago"] as const).map(s => (
                        <button key={s} onClick={() => setForm(f => ({ ...f, status: s }))}
                          className="py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all"
                          style={{
                            background: form.status === s
                              ? (s === "Pago" ? "rgba(52,211,153,0.15)" : "rgba(251,191,36,0.15)")
                              : "transparent",
                            border: `1px solid ${form.status === s
                              ? (s === "Pago" ? "rgba(52,211,153,0.4)" : "rgba(251,191,36,0.4)")
                              : "rgba(255,255,255,0.08)"}`,
                            color: form.status === s
                              ? (s === "Pago" ? "#34d399" : "#fbbf24")
                              : "#64748b"
                          }}>
                          {s === "Pago" ? "✓ Pago" : "⏳ Pendente"}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Parcelamento */}
                {CATS_PARCELAVEL.includes(form.cat) && (
                  <div className="pt-2 border-t border-white/[.06]">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form.parcelar}
                        onChange={e => setForm(f => ({ ...f, parcelar: e.target.checked }))}
                        className="w-4 h-4 cursor-pointer" />
                      <span className="text-xs font-bold text-violet-l">🔗 Parcelar compra</span>
                    </label>

                    {form.parcelar && (
                      <div className="mt-3 p-3 rounded-xl"
                        style={{ background: "rgba(124,106,247,0.05)", border: "1px solid rgba(124,106,247,0.2)" }}>
                        <div className="flex items-center gap-3 mb-3">
                          <label className="label mb-0">Número de parcelas:</label>
                          <input className="input w-20 text-center font-bold" type="number"
                            min="2" max="60" value={form.parcelas}
                            onChange={e => setForm(f => ({ ...f, parcelas: e.target.value }))} />
                          <span className="text-xs text-muted">vezes</span>
                        </div>

                        {form.valor && (
                          <div className="text-xs text-muted mb-2">
                            Total da compra: <strong className="text-white">
                              {brl(Number(form.valor) * (Number(form.parcelas) || 2))}
                            </strong>
                            {" "}({Number(form.parcelas) || 2}× de {brl(Number(form.valor))})
                          </div>
                        )}

                        {parcelasPreview.length > 0 && (
                          <div>
                            <div className="text-[9px] text-violet-l uppercase tracking-wider font-bold mb-1">Preview dos meses:</div>
                            <div className="flex flex-wrap gap-1">
                              {parcelasPreview.map((mes, i) => (
                                <span key={i} className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                  style={{ background: "rgba(124,106,247,0.15)", color: "#a89ef7" }}>
                                  {mes} ({i + 1}/{parcelasPreview.length})
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-white/[.06]">
                <button onClick={() => { setShowModal(false); resetForm(); }}
                  className="bg-surface2 text-muted text-xs font-bold px-4 py-2.5 rounded-lg cursor-pointer"
                  style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
                  Cancelar
                </button>
                <button onClick={salvarLancamento}
                  disabled={!form.descricao || !form.valor}
                  className="bg-violet text-white text-xs font-bold px-4 py-2.5 rounded-lg border-none cursor-pointer hover:opacity-90 disabled:opacity-50">
                  💾 {form.parcelar && CATS_PARCELAVEL.includes(form.cat)
                    ? `Salvar ${Number(form.parcelas) || 2} parcelas`
                    : "Salvar"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Exclusão */}
        {deletingLanc && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-5"
            onClick={e => e.target === e.currentTarget && setDeletingLanc(null)}>
            <div className="bg-surface border border-white/[.08] rounded-2xl p-7 w-full max-w-md">
              <div className="font-display text-lg font-bold mb-3">🗑 Excluir lançamento</div>
              <div className="text-sm text-white mb-4">
                <strong>{deletingLanc.descricao}</strong>
                <div className="text-xs text-muted mt-0.5">
                  {brl(Number(deletingLanc.valor))} · {MESES_F[deletingLanc.mes]}
                </div>
              </div>

              {deletingLanc.compra_id ? (
                <>
                  <div className="mb-4 p-3 rounded-xl text-xs"
                    style={{ background: "rgba(124,106,247,0.05)", border: "1px solid rgba(124,106,247,0.2)" }}>
                    <div className="text-violet-l font-bold mb-1">🔗 Esta é uma compra parcelada</div>
                    <div className="text-muted">
                      Parcela {deletingLanc.parcela_num} de {deletingLanc.parcelas_total}.
                      Escolha o que excluir:
                    </div>
                  </div>
                  <div className="space-y-2">
                    <button onClick={excluirSoEsta}
                      className="w-full py-3 rounded-xl text-xs font-bold cursor-pointer transition-all text-left px-4"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", color: "#e2e8f0" }}>
                      <div>🎯 Só esta parcela</div>
                      <div className="text-[9px] text-muted font-normal mt-0.5">
                        As outras {(deletingLanc.parcelas_total || 0) - 1} parcelas continuam
                      </div>
                    </button>
                    <button onClick={excluirTodasRestantes}
                      className="w-full py-3 rounded-xl text-xs font-bold cursor-pointer transition-all text-left px-4"
                      style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.25)", color: "#fbbf24" }}>
                      <div>⏭️ Esta e todas as seguintes</div>
                      <div className="text-[9px] text-muted font-normal mt-0.5">
                        Cancela a partir desta parcela ({(deletingLanc.parcelas_total || 0) - (deletingLanc.parcela_num || 0) + 1} parcelas)
                      </div>
                    </button>
                    <button onClick={excluirTodoGrupo}
                      className="w-full py-3 rounded-xl text-xs font-bold cursor-pointer transition-all text-left px-4"
                      style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)", color: "#f87171" }}>
                      <div>🗑️ Apagar compra inteira</div>
                      <div className="text-[9px] text-muted font-normal mt-0.5">
                        Remove todas as {deletingLanc.parcelas_total} parcelas (inclusive já pagas)
                      </div>
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <button onClick={excluirSoEsta}
                    className="w-full py-3 rounded-xl text-xs font-bold cursor-pointer transition-all"
                    style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171" }}>
                    🗑️ Confirmar exclusão
                  </button>
                </div>
              )}
              <button onClick={() => setDeletingLanc(null)}
                className="w-full mt-2 py-2.5 bg-transparent text-muted text-xs font-bold cursor-pointer"
                style={{ border: "1px solid rgba(255,255,255,0.06)", borderRadius: "0.5rem" }}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
