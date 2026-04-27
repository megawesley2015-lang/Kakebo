export type Lancamento = {
  id: number;
  mes: number;
  cat: string;
  descricao: string;
  valor: number;
  status: 'Pago' | 'Pendente';
  ano: number;
  obs?: string;
  compra_id?: string;
  parcela_num?: number;
  parcelas_total?: number;
};
export type Divida = {
  id: number; credor: string; descricao: string;
  valor: number; status: 'Pago' | 'Pendente';
};
export type Ativo = {
  id: number; ticker: string; nome: string;
  tipo: string; subtipo: string;
  cotas: number; cotas_alvo: number; cotacao: number;
  invest: number; atual: number; dy: number; dpa: number;
  div_mensal: number; inst?: string; obs?: string;
  cotacao_realtime?: number;
};
export type Aporte = {
  id: number; mes: number; ano: number; ativo_id: number;
  valor: number; cotas_compradas: number; rend: number; obs?: string;
  ativo?: Ativo;
};
export type Meta = {
  id: number; nome: string; tipo: string;
  atual: number; objetivo: number; aporte_mes: number;
  prazo?: string; descricao?: string;
};
export type Config = { salario: number };
export type Alerta = {
  id: number;
  ticker: string;
  tipo: 'abaixo' | 'acima';
  preco_alvo: number;
  ativo: boolean;
  disparado: boolean;
};
export type Orcamento = {
  id: number;
  categoria: string;
  limite: number;
  mes: number;
  ano: number;
};
export type AgendaDividendo = {
  id: number;
  ticker: string;
  mes: number;
  ano: number;
  data_ex?: string;
  data_pag?: string;
  valor_dpa: number;
  cotas: number;
};
export type Movimentacao = {
  id: number;
  data: string;
  ticker: string;
  tipo: string;
  quantidade: number;
  preco: number;
  valor: number;
  hash: string;
  instituicao?: string;
  importado_em?: string;
};
export type MovParsed = {
  data: string;
  ticker: string;
  tipo: 'compra' | 'venda' | 'bonificacao' | 'fracao_ganho' | 'fracao_perda' | 'dividendo' | 'jcp';
  quantidade: number;
  preco: number;
  valor: number;
  hash: string;
  instituicao?: string;
};
