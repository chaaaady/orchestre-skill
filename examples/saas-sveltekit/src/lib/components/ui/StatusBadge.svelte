<script lang="ts">
	import type { InvoiceStatusValue } from '$lib/schemas/invoice';

	// --- R2: Pure UI, data via props ---
	// --- Svelte 5 runes ---
	let { status }: { status: InvoiceStatusValue } = $props();

	const variants: Record<InvoiceStatusValue, string> = {
		draft: 'bg-muted text-muted-foreground',
		sent: 'bg-primary/10 text-primary',
		paid: 'bg-success/10 text-success',
		overdue: 'bg-destructive/10 text-destructive',
		cancelled: 'bg-muted text-muted-foreground line-through'
	};

	const labels: Record<InvoiceStatusValue, string> = {
		draft: 'Draft',
		sent: 'Sent',
		paid: 'Paid',
		overdue: 'Overdue',
		cancelled: 'Cancelled'
	};
</script>

<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {variants[status]}">
	{labels[status]}
</span>
