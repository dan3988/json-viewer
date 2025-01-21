<script lang="ts">

	type T = $$Generic;
	type V = $$Generic;

	export let value: undefined | V = undefined;
	export let items: T[];
	export let converter: (item: T) => V = i => i as any;
</script>
{#each items as item, i}
	{@const id = crypto.randomUUID().slice(-12)}
	{@const v = converter(item)}
	<input {id} class="btn-check" type="radio" value={v} checked={value === v} on:change={() => value = v} />
	<slot name="label" {item} {id}>
		<label class="btn btn-base" for={id}>{v}</label>
	</slot>
{/each}