<script lang="ts">
	import InvoiceList from '$lib/components/invoices/InvoiceList.svelte';
	import InvoiceForm from '$lib/components/invoices/InvoiceForm.svelte';

	// --- Data from +page.server.ts load function ---
	let { data, form } = $props();

	let showForm = $state(false);
</script>

<svelte:head>
	<title>Invoices | InvoiceFlow</title>
</svelte:head>

<div class="mx-auto max-w-5xl space-y-6 p-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold text-foreground">Invoices</h1>
		<button
			onclick={() => (showForm = !showForm)}
			class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
		>
			{showForm ? 'Cancel' : 'New Invoice'}
		</button>
	</div>

	{#if form?.success}
		<div class="rounded-md bg-success/10 px-4 py-3 text-sm text-success">
			Invoice created successfully.
		</div>
	{/if}

	{#if data.error}
		<div class="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
			{data.error}
		</div>
	{/if}

	{#if showForm}
		<div class="rounded-lg border border-border bg-card p-6">
			<h2 class="mb-4 text-lg font-semibold text-card-foreground">Create Invoice</h2>
			<InvoiceForm errors={form?.errors ?? {}} />
		</div>
	{/if}

	<InvoiceList invoices={data.invoices} />
</div>
