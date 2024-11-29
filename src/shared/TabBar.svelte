<script lang="ts">
	type T = $$Generic;

	export let selected: T;
	export let tabs: readonly T[];
</script>
{#each tabs as tab}
{@const active = tab === selected}
{@const select = () => selected = tab}
	<slot name="tab" {tab} {active} {select} />
{/each}