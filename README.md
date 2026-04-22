# 家計簿 Kakebo Pro

Controle financeiro pessoal com rastreamento automático de dividendos.

## Setup

1. `cp .env.local.example .env.local`
2. `npm install`
3. `npm run dev`

## Deploy Vercel

1. Push para GitHub
2. Importar projeto no vercel.com
3. Adicionar variáveis de ambiente

## Banco de dados (Supabase)

Execute `migration_cotas.sql` no SQL Editor do Supabase.

## Funcionalidades

- ✅ Auth (email + Google OAuth)
- ✅ Lançamentos com CRUD completo
- ✅ Dividendos calculados automaticamente ao registrar compras
- ✅ Metas dinâmicas que atualizam conforme dividendos crescem
- ✅ Cotações em tempo real via brapi.dev
- ✅ Plano 6 Meses de FIIs
- ✅ PWA instalável
