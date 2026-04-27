import type { Ativo } from "@/types";

export function brl(v: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency", currency: "BRL",
  }).format(Number(v) || 0);
}

export function calcDividendoMensal(ativos: Ativo[]): number {
  return ativos.reduce((sum, a) => sum + Number(a.cotas) * Number(a.dpa), 0);
}

export function calcProgressoMeta(divAtual: number, meta: number): number {
  if (!meta || meta <= 0) return 0;
  return Math.min(100, (divAtual / meta) * 100);
}

export function calcMesesParaMeta(
  divAtual: number,
  metaObj: number,
  aporteMes: number,
  ativos: Ativo[]
): number {
  if (divAtual >= metaObj) return 0;
  if (aporteMes <= 0) return 999;

  const candidatos = [...ativos]
    .filter(a => Number(a.cotacao) > 0 && Number(a.dpa) > 0)
    .sort((a, b) => Number(b.dy) - Number(a.dy));

  if (candidatos.length === 0) return 999;

  let divSimulado = divAtual;
  let meses = 0;
  const maxMeses = 240;

  while (divSimulado < metaObj && meses < maxMeses) {
    const melhor = candidatos[0];
    const cotasCompradas = Math.floor(aporteMes / Number(melhor.cotacao));
    if (cotasCompradas <= 0) break;
    divSimulado += cotasCompradas * Number(melhor.dpa);
    meses++;
  }

  return meses >= maxMeses ? 999 : meses;
}
