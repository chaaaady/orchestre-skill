# SKILL: shadcn/ui — Patterns Avancés
> Module ID: `ui-shadcn-advanced` | Domaine: Frontend / UI | Stack: Next.js + Tailwind + RHF

## Install
```bash
# shadcn est déjà init. Ajouter les composants avancés :
npx shadcn@latest add data-table command sheet form combobox
npm install @tanstack/react-table
```

## Exports clés
- `DataTable` — table triable/filtrable avec TanStack
- `Combobox` — select avec recherche intégrée
- `CommandDialog` — palette de commandes
- `Sheet` — drawer latéral (modals mobile)
- `Form` + `FormField` + `FormItem` + `FormMessage` — forms RHF intégrés

## Pattern principal — DataTable
```tsx
// columns.tsx
import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { ArrowUpDown } from "lucide-react"

export const columns: ColumnDef<Payment>[] = [
  {
    accessorKey: "status",
    header: "Statut",
    cell: ({ row }) => <Badge>{row.getValue("status")}</Badge>,
  },
  {
    accessorKey: "amount",
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting()}>
        Montant <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("amount"))
      return <div className="font-medium">{formatCurrency(amount)}</div>
    },
  },
]

// page.tsx
<DataTable columns={columns} data={payments} />
```

## Patterns secondaires

**Form avec RHF (pattern shadcn natif) :**
```tsx
const form = useForm<z.infer<typeof schema>>({
  resolver: zodResolver(schema),
  defaultValues: { email: "" },
})

<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)}>
    <FormField control={form.control} name="email" render={({ field }) => (
      <FormItem>
        <FormLabel>Email</FormLabel>
        <FormControl><Input {...field} /></FormControl>
        <FormMessage />
      </FormItem>
    )} />
    <Button type="submit">Envoyer</Button>
  </form>
</Form>
```

**Combobox avec recherche :**
```tsx
// Utilise Command en interne. Pattern Popover + Command.
<Popover open={open} onOpenChange={setOpen}>
  <PopoverTrigger asChild>
    <Button variant="outline" role="combobox">
      {value ? options.find(o => o.value === value)?.label : "Sélectionner..."}
      <ChevronsUpDown className="ml-2 h-4 w-4" />
    </Button>
  </PopoverTrigger>
  <PopoverContent className="p-0">
    <Command>
      <CommandInput placeholder="Rechercher..." />
      <CommandList>
        <CommandEmpty>Aucun résultat.</CommandEmpty>
        <CommandGroup>
          {options.map(o => (
            <CommandItem key={o.value} value={o.value} onSelect={() => { setValue(o.value); setOpen(false) }}>
              <Check className={cn("mr-2 h-4 w-4", value === o.value ? "opacity-100" : "opacity-0")} />
              {o.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  </PopoverContent>
</Popover>
```

**Sheet pour modals mobile :**
```tsx
<Sheet>
  <SheetTrigger asChild><Button>Ouvrir</Button></SheetTrigger>
  <SheetContent side="bottom" className="h-[80vh]">
    <SheetHeader><SheetTitle>Titre</SheetTitle></SheetHeader>
    {/* Contenu du form */}
  </SheetContent>
</Sheet>
```

## Gotchas
- **Form shadcn = wrapper RHF** — ne pas utiliser `useForm` en dehors du composant `<Form>`. Tout passe par `form.control`.
- **DataTable** : les colonnes doivent être définies hors du composant render (sinon recreations infinies).
- **CommandDialog** : `open` state géré en dehors, trigger clavier via `useEffect` + `event.key`.
- **Sheet `side="bottom"`** : préférer à `Dialog` pour les actions sur mobile.

## À NE PAS FAIRE
- Ne pas utiliser `register()` de RHF directement si tu utilises `<Form>` shadcn — utiliser `field` via `render`
- Ne pas mettre `ColumnDef` inline dans le composant render (référence instable = bug de tri)
- Ne pas utiliser `Dialog` pour les actions destructives sur mobile — `Sheet` est plus ergonomique
- Ne pas passer `data` undefined à DataTable — toujours `data={items ?? []}`
