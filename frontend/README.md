# Centavo Frontend 🪙

Aplicación web / Dashboard para los usuarios de Centavo. Construida con React, TypeScript y Vite.

## 🚀 Inicio Rápido

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo (puerto 3000)
npm run dev

# Compilar para producción
npm run build
```

## 🧱 Estructura de Código

- `src/components/`: Componentes modulares y reutilizables en PascalCase (Navbar, SummaryCards, TransactionList, EmptyState).
- `src/pages/`: Páginas principales (LoginPage, DashboardPage).
- `src/context/`: Estado global de autenticación (`AuthContext`).
- `src/hooks/`: Hooks personalizados (`useAuth`, `useTransactions`).
- `src/services/`: Capa desacoplada para llamadas a la API (`api.ts`, `authService.ts`, `transactionsService.ts`).
- `src/styles/`: Design tokens y estilos globales (`variables.css`, `global.css`).
- `src/types/`: Interfaces y definiciones de TypeScript (`auth.ts`, `transaction.ts`).
