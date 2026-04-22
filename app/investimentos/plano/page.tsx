"use client";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";

const PLANO = [
  { mes:1, titulo:"Pilar de Renda Máxima",    cor:"#60a5fa", foco:"VGIP11 — 19 cotas",          invest:"~R$ 1.482", adicionado:"+ R$ 17,48/mês", acumulado:"R$ 28,16/mês",  detalhes:"19 × R$ 78,00 · Papel IPCA+ · DY 14,91%"  },
  { mes:2, titulo:"Papel High Grade",          cor:"#a89ef7", foco:"RECR11 — 19 cotas",          invest:"~R$ 1.491", adicionado:"+ R$ 15,58/mês", acumulado:"R$ 43,74/mês",  detalhes:"19 × R$ 78,50 · Papel IPCA+ · DY 14,89%"  },
  { mes:3, titulo:"Ativando o Turbo",          cor:"#f59e0b", foco:"TGAR11 (12c) + KNSC11 (54c)",invest:"~R$ 1.498", adicionado:"+ R$ 16,86/mês", acumulado:"R$ 60,60/mês",  detalhes:"Satélite/Papel · Alto dividendo"           },
  { mes:4, titulo:"Fiagro e Renda Urbana",     cor:"#34d399", foco:"KNCA11+TRXF11+VINO11",       invest:"~R$ 1.496", adicionado:"+ R$ 15,56/mês", acumulado:"R$ 76,16/mês",  detalhes:"Satélite + Núcleo + Deep Value"            },
  { mes:5, titulo:"Segurança e Proteção",      cor:"#60a5fa", foco:"KNIP11 — 16 cotas",          invest:"~R$ 1.455", adicionado:"+ R$ 11,52/mês", acumulado:"R$ 87,68/mês",  detalhes:"16 × R$ 90,98 · IPCA+ · Proteção inflação"},
  { mes:6, titulo:"🎯 Meta R$100/mês!",        cor:"#34d399", foco:"TRXF11 (9c) + XPML11 (5c)", invest:"~R$ 1.430", adicionado:"+ R$ 12,97/mês", acumulado:"R$ 100,65/mês", detalhes:"Tijolo Atípico + Shopping Premium"         },
];

export default function Plano() {
  return (
    <div className="flex bg-bg min-h-screen">
      <Sidebar dividendoMensal={10.99} metaDividendo={100} />
      <main className="ml-56 flex-1 p-7">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="font-display text-2xl font-black text-white">Plano 6 Meses</h1>
            <p className="text-muted text-[9px] tracking-[2px] uppercase mt-0.5">Meta: R$ 100/mês em Dividendos de FIIs</p>
          </div>
          <Link href="/investimentos" className="text-xs text-muted hover:text-white transition-colors">← Carteira</Link>
        </div>

        {/* Progresso */}
        <div className="card mb-6 border-teal/20">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[10px] text-teal uppercase tracking-[2px] font-bold">📊 Progresso Atual</span>
            <div className="text-right">
              <div className="font-display text-2xl font-black text-teal">R$ 10,99</div>
              <div className="text-[9px] text-muted">de R$ 100,00/mês</div>
            </div>
          </div>
          <div className="h-2.5 bg-white/5 rounded-full overflow-hidden mb-1.5">
            <div className="h-full rounded-full bg-gradient-to-r from-teal/60 to-teal" style={{ width: "11%" }} />
          </div>
          <div className="flex justify-between text-[9px] text-muted">
            <span>11% atingido</span><span>Faltam R$ 89,01/mês</span>
          </div>
        </div>

        {/* Cards dos meses */}
        <div className="grid grid-cols-3 gap-4">
          {PLANO.map(p => (
            <div key={p.mes} className="card relative overflow-hidden" style={{ borderColor: p.cor+"30", background: p.mes===6 ? `${p.cor}06` : undefined }}>
              <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: `linear-gradient(90deg,transparent,${p.cor},transparent)` }} />
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="text-[9px] uppercase tracking-[2px] font-bold" style={{color:p.cor}}>MÊS {p.mes}</div>
                  <div className="font-display font-bold text-white mt-0.5">{p.titulo}</div>
                </div>
                <span className="text-[9px] font-bold px-2 py-1 rounded-full" style={{ background: p.cor+"18", color: p.cor }}>
                  {p.invest}
                </span>
              </div>
              <div className="rounded-lg p-2.5 mb-3" style={{ background: p.cor+"10", border: `1px solid ${p.cor}20` }}>
                <div className="text-[9px] font-bold mb-1" style={{color:p.cor}}>🎯 {p.foco}</div>
                <div className="text-[10px] text-white/70">{p.detalhes}</div>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-muted">Adicionado</span>
                <span className="font-bold text-teal">{p.adicionado}</span>
              </div>
              <div className="flex justify-between text-[10px] mt-1 pt-1 border-t border-white/[.04]">
                <span className="text-muted">Acumulado</span>
                <span className="font-bold" style={{color:p.cor}}>{p.acumulado}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Resumo */}
        <div className="card mt-5 border-amber-500/20">
          <div className="text-[10px] text-amber-400 uppercase tracking-[2px] font-bold mb-3">Resumo do Investimento Total</div>
          <div className="grid grid-cols-4 gap-4">
            {[
              { l:"Total 6 meses", v:"~R$ 8.852", c:"#f59e0b" },
              { l:"Atual/mês",     v:"R$ 10,99",  c:"#64748b" },
              { l:"Meta/mês",      v:"R$ 100,65", c:"#34d399" },
              { l:"Crescimento",   v:"+815%",      c:"#34d399" },
            ].map((k,i) => (
              <div key={i}>
                <div className="text-[9px] text-muted uppercase tracking-wide mb-1">{k.l}</div>
                <div className="font-display font-bold text-lg" style={{color:k.c}}>{k.v}</div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
