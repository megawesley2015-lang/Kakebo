
"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { brl } from "@/lib/dividends";

const nav = [
  { label:"Visão Geral",    href:"/",               icon:"📊", section:"controle" },
  { label:"Lançamentos",    href:"/lancamentos",    icon:"📋", section:"controle" },
  { label:"Dívidas",        href:"/dividas",        icon:"💳", section:"controle" },
  { label:"Carteira",       href:"/investimentos",  icon:"🥧", section:"invest" },
  { label:"Plano 6 Meses",  href:"/investimentos/plano", icon:"📆", section:"invest" },
];

type Props = {
  userEmail?: string;
  healthPct?: number;
  patrimoniTotal?: number;
  dividendoMensal?: number;
  metaDividendo?: number;
};

export default function Sidebar({ userEmail, healthPct=0, patrimoniTotal=0, dividendoMensal=0, metaDividendo=100 }: Props) {
  const pathname = usePathname();
  const router   = useRouter();
  const sb       = createClient();

  async function logout() {
    await sb.auth.signOut();
    router.push("/auth");
  }

  const progDiv = Math.min(100, metaDividendo > 0 ? (dividendoMensal / metaDividendo) * 100 : 0);

  return (
    <aside className="fixed top-0 left-0 w-56 h-screen bg-[rgba(10,9,20,.97)] border-r border-white/[.06] flex flex-col z-50 backdrop-blur-xl overflow-y-auto">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/[.06]">
        <div className="text-2xl">家計簿</div>
        <div className="text-[9px] text-violet-l tracking-[3px] uppercase mt-0.5">Kakebo Pro</div>
        <div className="font-display text-base font-black bg-gradient-to-r from-white to-violet-l bg-clip-text text-transparent leading-tight">
          Finanças
        </div>
      </div>

      {/* Nav Controle */}
      <div className="px-3 pt-4">
        <div className="text-[8px] text-muted tracking-[2px] uppercase font-bold px-2 mb-2">Controle</div>
        {nav.filter(n => n.section === "controle").map(n => (
          <Link key={n.href} href={n.href}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[11px] font-bold tracking-wide mb-0.5 transition-all
              ${pathname === n.href
                ? "bg-violet/15 text-violet-l border border-violet/25"
                : "text-muted hover:bg-violet/10 hover:text-violet-l"}`}>
            <span className="text-sm w-5 text-center">{n.icon}</span>
            <span>{n.label}</span>
          </Link>
        ))}
      </div>

      {/* Nav Investimentos */}
      <div className="px-3 pt-3">
        <div className="text-[8px] text-muted tracking-[2px] uppercase font-bold px-2 mb-2">Investimentos</div>
        {nav.filter(n => n.section === "invest").map(n => (
          <Link key={n.href} href={n.href}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[11px] font-bold tracking-wide mb-0.5 transition-all
              ${pathname === n.href || (n.href !== "/" && pathname.startsWith(n.href))
                ? "bg-amber-500/15 text-amber-400 border border-amber-500/25"
                : "text-muted hover:bg-amber-500/10 hover:text-amber-400"}`}>
            <span className="text-sm w-5 text-center">{n.icon}</span>
            <span>{n.label}</span>
          </Link>
        ))}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Footer — Saúde + Dividendos */}
      <div className="px-5 py-4 border-t border-white/[.06] space-y-3">
        <div>
          <div className="text-[8px] text-muted tracking-[2px] uppercase mb-1">Saúde Financeira</div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-rose via-amber to-teal transition-all duration-700"
              style={{ width: `${healthPct}%` }} />
          </div>
          <div className="text-xs font-bold text-teal mt-1">{healthPct.toFixed(0)}%</div>
        </div>

        {/* Dividendo vs Meta — THE STAR FEATURE */}
        <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-3">
          <div className="text-[8px] text-amber-400/80 tracking-[2px] uppercase mb-1.5">Dividendos/mês</div>
          <div className="flex items-end justify-between mb-1.5">
            <span className="font-display font-bold text-amber-400 text-sm">{brl(dividendoMensal)}</span>
            <span className="text-[9px] text-muted">/ {brl(metaDividendo)}</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-700"
              style={{ width: `${progDiv}%` }} />
          </div>
          <div className="text-[9px] text-amber-400/70 mt-1">{progDiv.toFixed(1)}% da meta</div>
        </div>

        <div>
          <div className="text-[8px] text-muted tracking-[2px] uppercase">Patrimônio</div>
          <div className="font-display font-bold text-gold text-sm">{brl(patrimoniTotal)}</div>
        </div>

        {/* User */}
        <div className="flex items-center justify-between pt-1 border-t border-white/[.06]">
          <div className="text-[9px] text-muted truncate max-w-[130px]">{userEmail}</div>
          <button onClick={logout}
            className="text-[9px] text-rose hover:text-rose/80 font-bold bg-transparent border-none cursor-pointer">⏏</button>
        </div>
      </div>
    </aside>
  );
}
