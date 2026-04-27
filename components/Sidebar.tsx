"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { brl } from "@/lib/dividends";

type Props = {
  userEmail?: string;
  healthPct?: number;
  patrimoniTotal?: number;
  dividendoMensal?: number;
  metaDividendo?: number;
};

const NAV = [
  { section: "Controle", items: [
    { label: "Visão Geral",    href: "/",            icon: "📊" },
    { label: "Lançamentos",    href: "/lancamentos", icon: "📋" },
    { label: "Dívidas",        href: "/dividas",     icon: "💳" },
    { label: "Orçamento",      href: "/orcamento",   icon: "📆" },
    { label: "Relatório PDF",  href: "/relatorio",   icon: "📄" },
  ]},
  { section: "Investimentos", items: [
    { label: "Importar B3",    href: "/importar",            icon: "📤" },
    { label: "Carteira",       href: "/investimentos",       icon: "🥧" },
    { label: "Ranking",        href: "/ranking",             icon: "🏆" },
    { label: "Agenda Div.",    href: "/agenda",              icon: "📅" },
    { label: "Simulador",      href: "/simulador",           icon: "📊" },
    { label: "DRIP",           href: "/drip",                icon: "♻️" },
    { label: "Plano 6 Meses",  href: "/investimentos/plano", icon: "📆" },
  ]},
  { section: "Alertas", items: [
    { label: "Alertas Preço",  href: "/alertas",             icon: "🔔" },
  ]},
];

export default function Sidebar({
  userEmail, healthPct = 0, patrimoniTotal = 0,
  dividendoMensal = 0, metaDividendo = 100,
}: Props) {
  const pathname = usePathname();
  const router   = useRouter();
  const sb       = createClient();

  async function logout() {
    await sb.auth.signOut();
    router.push("/auth");
  }

  const progDiv = Math.min(100, metaDividendo > 0 ? (dividendoMensal / metaDividendo) * 100 : 0);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside className="fixed top-0 left-0 w-56 h-screen bg-[rgba(10,9,20,.97)] border-r border-white/[.06] flex flex-col z-50 backdrop-blur-xl overflow-y-auto">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-white/[.06] shrink-0">
        <div className="text-2xl">家計簿</div>
        <div className="text-[9px] text-violet-l tracking-[3px] uppercase mt-0.5">Kakebo Pro</div>
        <div className="font-display text-base font-black bg-gradient-to-r from-white to-violet-l bg-clip-text text-transparent">
          Finanças
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-2">
        {NAV.map(group => (
          <div key={group.section} className="px-3 mb-2">
            <div className="text-[8px] text-muted tracking-[2px] uppercase font-bold px-2 py-2">
              {group.section}
            </div>
            {group.items.map(n => (
              <Link key={n.href} href={n.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[11px] font-bold tracking-wide mb-0.5 transition-all no-underline
                  ${isActive(n.href)
                    ? "bg-violet/15 text-violet-l border border-violet/25"
                    : "text-muted hover:bg-violet/10 hover:text-violet-l border border-transparent"}`}>
                <span className="text-sm w-5 text-center shrink-0">{n.icon}</span>
                <span>{n.label}</span>
              </Link>
            ))}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-white/[.06] shrink-0 space-y-2.5">
        <div>
          <div className="text-[8px] text-muted tracking-[2px] uppercase mb-1">Saúde Financeira</div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-rose via-amber to-teal transition-all"
              style={{ width: `${healthPct}%` }} />
          </div>
          <div className="text-xs font-bold text-teal mt-1">{healthPct.toFixed(0)}%</div>
        </div>
        <div className="rounded-xl p-2.5"
          style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.15)" }}>
          <div className="text-[8px] text-amber tracking-[2px] uppercase mb-1">Dividendos/mês</div>
          <div className="flex items-end justify-between mb-1">
            <span className="font-display font-bold text-amber text-sm">{brl(dividendoMensal)}</span>
            <span className="text-[9px] text-muted">/{brl(metaDividendo)}</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all"
              style={{ width: `${progDiv}%`, background: "linear-gradient(90deg, #d97706, #f59e0b)" }} />
          </div>
          <div className="text-[9px] text-amber/60 mt-0.5">{progDiv.toFixed(1)}%</div>
        </div>
        <div>
          <div className="text-[8px] text-muted tracking-[2px] uppercase">Patrimônio</div>
          <div className="font-display font-bold text-gold text-sm">{brl(patrimoniTotal)}</div>
        </div>
        <div className="flex items-center justify-between pt-1 border-t border-white/[.06]">
          <div className="text-[9px] text-muted truncate max-w-[130px]">{userEmail}</div>
          <button onClick={logout}
            className="text-[9px] text-rose hover:text-rose/80 font-bold bg-transparent border-none cursor-pointer">
            ⏏
          </button>
        </div>
      </div>
    </aside>
  );
}
