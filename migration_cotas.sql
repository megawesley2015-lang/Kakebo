-- Adicionar coluna cotas_compradas na tabela aportes
ALTER TABLE aportes ADD COLUMN IF NOT EXISTS cotas_compradas NUMERIC(14,4) DEFAULT 0;
-- Verificar
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'aportes' AND table_schema = 'public';
