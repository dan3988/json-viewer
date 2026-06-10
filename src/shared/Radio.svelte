<script lang="ts" module>
	const defaultConverter: Converter = v => v;
</script>
<script lang="ts">
    import { Snippet } from 'svelte';

	type T = $$Generic;
	type V = $$Generic;

	interface Props {
		value?: V;
		items: T[];
		converter?: Converter<T, V>;
		label?: Snippet<[item: T, id: string]>;
	}

	let {
		value = $bindable(),
		items,
		converter = defaultConverter,
		label,
	}: Props = $props();
</script>
{#each items as item, i}
	{@const id = crypto.randomUUID().slice(-12)}
	{@const v = converter(item)}
	<input {id} class="btn-check" type="radio" value={v} checked={value === v} onchange={() => value = v} />
	{#if label}
		{@render label(item, id)}
	{:else}
		<label class="btn btn-base" for={id}>{v}</label>
	{/if}
{/each}