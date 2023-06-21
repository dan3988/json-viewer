<script lang="ts" context="module">
	export type NamedRadioItem<T> = [value: T, text: string];
	export type RadioItem<T> = T | NamedRadioItem<T>;

	function fixItems<T>(items: RadioItem<T>[]): NamedRadioItem<T>[] {
		const arr = Array(items.length);
		for (let i = 0; i < items.length; i++) {
			const item = items[i];
			arr[i] = Array.isArray(item) ? item : [i, item];
		}

		return arr;
	}
</script>
<script lang="ts">
	let _class: string = "";
	let _value: undefined | T = undefined;

	type T = $$Generic;

	export { _class as class, _value as value };
	export let items: RadioItem<T>[];
	export let selectedValue: undefined | T = undefined;
	export let id: string = crypto.randomUUID();

	$: console.log(selectedValue)
	$: _fixedItems = fixItems(items);
</script>
{#each _fixedItems as [value, text], i}
	<!-- <button class={clazz} type="button">{text}</button> -->
	<input id={id + "-" + i} class="btn-check" type="radio" name={id} {value} checked={_value === value} on:change={() => _value = value}/>
	<label for={id + "-" + i} class={_class}>{text}</label>
{/each}