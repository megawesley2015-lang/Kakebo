import type { Ativo, Meta } from '@/types';

/** Calcula dividendo mensal total da carteira */
export function calcDividendoMensal(ativos: Ativo[]): number {
  return ativos.reduce((sum, a) => sum + (a.cotas * a.dpa), 0);
}

/** Calcula progresso da meta de dividendos (%) */
export function calcProgressoMeta(dividendoAtual: number, meta: Meta): number {
  if (meta.objetivo <= 0) return 0;
  return Math.min(100, (dividendoAtual / meta.objetivo) * 100);
}

/** Projeta quantos meses para atingir a meta com aporte mensal */
export function calcMesesParaMeta(
  dividendoAtual: number,
  metaObjetivo: number,
  aporteMensal: number,
  ativos: Ativo[]
): number {
  if (dividendoAtual >= metaObjetivo) return 0;
  if (aporteMensal <= 0) return 999;

  // Ordena ativos por DY para simular compra inteligente
  const sorted = [...ativos].filter(a => a.cotacao > 0 && a.dy > 0)
    .sort((a, b) => b.dy - a.dy);
  if (!sorted.length) return 999;

  let divAtual = dividendoAtual;
  let meses = 0;

  while (divAtual < metaObjetivo && meses < 120) {
    const melhor = sorted[meses % sorted.length];
    const cotasCompradas = aporteMensal / melhor.cotacao;
    divAtual += cotasCompradas * melhor.dpa;
    meses++;
  }
  return meses;
}

/** Formata valor em BRL */
export const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
