# SKILL: Recharts
> Module ID: `ui-recharts` | Domaine: Frontend / Data Viz | Stack: Next.js (Client only)

## Install
```bash
npm install recharts
```

## Exports clés
- `ResponsiveContainer` — wrapper obligatoire pour dimensions fluides
- `BarChart` / `LineChart` / `AreaChart` — charts cartésiens
- `PieChart` + `Pie` + `Cell` — camembert
- `XAxis` / `YAxis` / `CartesianGrid` / `Tooltip` / `Legend` — anatomie chart
- `useTheme` (shadcn) — pour les couleurs CSS variables

## Pattern principal — AreaChart responsive avec thème
```tsx
'use client'

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

const data = [
  { month: "Jan", revenue: 4200 },
  { month: "Fév", revenue: 7800 },
  { month: "Mar", revenue: 5600 },
]

export function RevenueChart() {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
        <YAxis tickFormatter={(v) => `${v}€`} tick={{ fontSize: 12 }} />
        <Tooltip
          formatter={(value: number) => [`${value}€`, "Revenus"]}
          contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }}
        />
        <Area type="monotone" dataKey="revenue" stroke="#3B82F6" fill="url(#colorRevenue)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
```

## Patterns secondaires

**BarChart groupé :**
```tsx
<ResponsiveContainer width="100%" height={300}>
  <BarChart data={data}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="name" />
    <YAxis />
    <Tooltip />
    <Legend />
    <Bar dataKey="pv" fill="#3B82F6" radius={[4, 4, 0, 0]} />
    <Bar dataKey="uv" fill="#10B981" radius={[4, 4, 0, 0]} />
  </BarChart>
</ResponsiveContainer>
```

**PieChart avec labels personnalisés :**
```tsx
const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444"]
<PieChart>
  <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value">
    {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
  </Pie>
  <Tooltip />
</PieChart>
```

**Custom Tooltip :**
```tsx
const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-popover p-3 shadow-md">
      <p className="font-medium">{label}</p>
      <p className="text-sm text-muted-foreground">{payload[0].value}€</p>
    </div>
  )
}
```

## Gotchas
- **`'use client'` obligatoire** — Recharts utilise des hooks et le DOM. Ne jamais rendre en Server Component.
- **`ResponsiveContainer` obligatoire** — sans lui, le chart a une hauteur 0. `height={300}` ou `height="100%"` avec un parent dimensionné.
- **Couleurs** : utiliser des valeurs HEX ou HSL directes (pas les classes Tailwind) dans les props SVG.
- **`margin`** : prévoir `left: 0` ou une valeur > 0 sinon le YAxis est coupé.
- **SSR** : si le composant est importé dans un Server Component, wrapper avec `dynamic(() => import(...), { ssr: false })`.

## À NE PAS FAIRE
- Ne pas passer `width="100%"` à `BarChart` directement — c'est `ResponsiveContainer` qui gère ça
- Ne pas utiliser `className` sur les éléments SVG Recharts (XAxis, YAxis...) pour les couleurs — utiliser les props `stroke`, `fill`
- Ne pas oublier `dataKey` sur chaque `Bar`, `Line`, `Area` — chart vide sinon
- Ne pas utiliser dans une carte sans hauteur définie sur le parent
