export type Lancamento = {
  id: number; mes: number; cat: string; descricao: string;
  valor: number; status: 'Pago' | 'Pendente'; ano: number; obs?: string;
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
