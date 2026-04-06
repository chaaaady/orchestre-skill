<script lang="ts">
	import { enhance } from '$app/forms';

	// --- R2: Pure UI with form enhancement ---
	let { errors = {} }: { errors?: Record<string, string> } = $props();

	let lineItemCount = $state(1);

	function addLineItem(): void {
		lineItemCount += 1;
	}

	function removeLineItem(): void {
		if (lineItemCount > 1) lineItemCount -= 1;
	}
</script>

<form method="POST" action="?/create" use:enhance class="space-y-6">
	<div class="grid gap-4 sm:grid-cols-2">
		<div>
			<label for="client_name" class="block text-sm font-medium text-foreground">
				Client Name
			</label>
			<input
				id="client_name"
				name="client_name"
				type="text"
				required
				class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
			/>
			{#if errors.client_name}
				<p class="mt-1 text-xs text-destructive">{errors.client_name}</p>
			{/if}
		</div>

		<div>
			<label for="client_email" class="block text-sm font-medium text-foreground">
				Client Email
			</label>
			<input
				id="client_email"
				name="client_email"
				type="email"
				required
				class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
			/>
			{#if errors.client_email}
				<p class="mt-1 text-xs text-destructive">{errors.client_email}</p>
			{/if}
		</div>
	</div>

	<div>
		<label for="due_date" class="block text-sm font-medium text-foreground">Due Date</label>
		<input
			id="due_date"
			name="due_date"
			type="date"
			required
			class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
		/>
	</div>

	<fieldset class="space-y-3">
		<legend class="text-sm font-medium text-foreground">Line Items</legend>
		{#each Array(lineItemCount) as _, i}
			<div class="grid grid-cols-[1fr_80px_100px] gap-2">
				<input
					name="line_items[{i}].description"
					placeholder="Description"
					required
					class="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
				/>
				<input
					name="line_items[{i}].quantity"
					type="number"
					min="1"
					placeholder="Qty"
					required
					class="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
				/>
				<input
					name="line_items[{i}].price"
					type="number"
					min="0"
					step="0.01"
					placeholder="Price"
					required
					class="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
				/>
			</div>
		{/each}
		<div class="flex gap-2">
			<button
				type="button"
				onclick={addLineItem}
				class="rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
			>
				+ Add item
			</button>
			{#if lineItemCount > 1}
				<button
					type="button"
					onclick={removeLineItem}
					class="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-destructive"
				>
					Remove last
				</button>
			{/if}
		</div>
	</fieldset>

	<div>
		<label for="notes" class="block text-sm font-medium text-foreground">Notes (optional)</label>
		<textarea
			id="notes"
			name="notes"
			rows="2"
			class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
		></textarea>
	</div>

	<button
		type="submit"
		class="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring"
	>
		Create Invoice
	</button>
</form>
