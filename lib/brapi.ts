export type CotacaoResult = {
  symbol: string;
  regularMarketPrice: number;
  regularMarketChangePercent: number;
  dividendsData?: { cashDividends?: { paymentDate: string; rate: number }[] };
};

export async function getCotacoes(tickers: string[]): Promise<CotacaoResult[]> {
  if (!tickers.length) return [];
  const token = process.env.BRAPI_TOKEN || 'demo';
  const symbols = tickers.join(',');
  try {
    const res = await fetch(
      `https://brapi.dev/api/quote/${symbols}?token=${token}&fundamental=false`,
      { next: { revalidate: 300 } } // cache 5 min
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.results || [];
  } catch {
    return [];
  }
}
