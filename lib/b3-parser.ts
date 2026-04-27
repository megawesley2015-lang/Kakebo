import * as XLSX from 'xlsx';
import type { MovParsed } from '@/types';

function classificar(mov: string, entSaida: string): MovParsed['tipo'] | null {
  const m = (mov || '').trim();
  const e = (entSaida || '').trim();

  if (m === 'Transferência - Liquidação') {
    return e === 'Credito' ? 'compra' : 'venda';
  }
  if (m === 'Bonificação em Ativos' && e === 'Credito') return 'bonificacao';
  if (m === 'Fração em Ativos') {
    return e === 'Credito' ? 'fracao_ganho' : 'fracao_perda';
  }
  if (m === 'Leilão de Fração' && e === 'Credito') return 'fracao_ganho';
  if (m === 'Dividendo' && e === 'Credito') return 'dividendo';
  if (m === 'Juros Sobre Capital Próprio' && e === 'Credito') return 'jcp';

  return null;
}

function extrairTicker(produto: string): string | null {
  if (!produto) return null;
  const match = String(produto).match(/^([A-Z0-9]+)/);
  return match ? match[1] : null;
}

function parseDate(data: any): string | null {
  if (data instanceof Date) {
    return data.toISOString().slice(0, 10);
  }
  if (typeof data === 'string') {
    const match = data.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  }
  if (typeof data === 'number') {
    const d = new Date((data - 25569) * 86400 * 1000);
    return d.toISOString().slice(0, 10);
  }
  return null;
}

function parseNumero(v: any): number {
  if (v === null || v === undefined || v === '' || v === '-') return 0;
  if (typeof v === 'number') return v;
  const s = String(v).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function gerarHash(data: string, ticker: string, tipo: string, qtd: number, valor: number): string {
  return `${data}|${ticker}|${tipo}|${qtd.toFixed(4)}|${valor.toFixed(2)}`;
}

export function parsarArquivoB3(buffer: ArrayBuffer): MovParsed[] {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows: any[] = XLSX.utils.sheet_to_json(ws, { raw: false, defval: null });

  const resultados: MovParsed[] = [];

  for (const row of rows) {
    const entSaida = row['Entrada/Saída'] || row['Entrada/Saida'];
    const mov = row['Movimentação'] || row['Movimentacao'];
    const produto = row['Produto'];
    const instituicao = row['Instituição'] || row['Instituicao'];

    const tipo = classificar(mov, entSaida);
    if (!tipo) continue;

    const ticker = extrairTicker(produto);
    if (!ticker) continue;

    const data = parseDate(row['Data']);
    if (!data) continue;

    const quantidade = parseNumero(row['Quantidade']);
    const preco = parseNumero(row['Preço unitário']);
    let valor = parseNumero(row['Valor da Operação']);

    if (valor === 0 && quantidade > 0 && preco > 0) {
      valor = quantidade * preco;
    }

    if (quantidade === 0 && valor === 0) continue;

    const hash = gerarHash(data, ticker, tipo, quantidade, valor);

    resultados.push({ data, ticker, tipo, quantidade, preco, valor, hash, instituicao });
  }

  resultados.sort((a, b) => a.data.localeCompare(b.data));
  return resultados;
}

export function agruparPorTicker(movs: MovParsed[]): Record<string, MovParsed[]> {
  const agrupado: Record<string, MovParsed[]> = {};
  for (const m of movs) {
    if (!agrupado[m.ticker]) agrupado[m.ticker] = [];
    agrupado[m.ticker].push(m);
  }
  return agrupado;
}
