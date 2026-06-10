<script lang="ts">
	import type { Snippet } from 'svelte';

	type T = $$Generic;

	interface Props {
		selected: T;
		tabs: readonly T[];
		tab: Snippet<[tab: T, active: boolean, select: Action]>
	}

	let {
		selected = $bindable(),
		tabs,
		tab: tabSnippet
	}: Props = $props();
</script>
{#each tabs as tab}
	{@const active = tab === selected}
	{@const select = () => selected = tab}
	{@render tabSnippet(tab, active, select)}
{/each}