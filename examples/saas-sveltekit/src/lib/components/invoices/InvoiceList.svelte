<script lang="ts">
	import type { Invoice } from '$lib/schemas/invoice';
	import StatusBadge from '$lib/components/ui/StatusBadge.svelte';

	// --- R2: Pure UI, data via props (no fetch, no query) ---
	// --- R5: Feature-scoped, only imports from ui/ ---
	let { invoices }: { invoices: Invoice[] } = $props();

	function formatCurrency(cents: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD'
		}).format(cents / 100);
	}

	function formatDate(date: Date): string {
		return new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		}).format(new Date(date));
	}
</script>

{#if invoices.length === 0}
	<div class="flex flex-col items-center justify-center rounded-lg border border-dashed border-border p-12 text-center">
		<p class="text-muted-foreground">No invoices yet. Create your first one.</p>
	</div>
{:else}
	<div class="overflow-hidden rounded-lg border border-border">
		<table class="w-full text-sm">
			<thead class="bg-muted/50">
				<tr>
					<th class="px-4 py-3 text-left font-medium text-muted-foreground">Client</th>
					<th class="px-4 py-3 text-left font-medium text-muted-foreground">Amount</th>
					<th class="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
					<th class="px-4 py-3 text-left font-medium text-muted-foreground">Due</th>
					<th class="px-4 py-3 text-left font-medium text-muted-foreground">Created</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-border">
				{#each invoices as invoice (invoice.id)}
					<tr class="hover:bg-muted/30 transition-colors">
						<td class="px-4 py-3">
							<div class="font-medium text-foreground">{invoice.client_name}</div>
							<div class="text-xs text-muted-foreground">{invoice.client_email}</div>
						</td>
						<td class="px-4 py-3 font-medium text-foreground">
							{formatCurrency(invoice.total_cents)}
						</td>
						<td class="px-4 py-3">
							<StatusBadge status={invoice.status} />
						</td>
						<td class="px-4 py-3 text-muted-foreground">{invoice.due_date}</td>
						<td class="px-4 py-3 text-muted-foreground">{formatDate(invoice.created_at)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
