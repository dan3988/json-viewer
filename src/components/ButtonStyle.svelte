<script lang="ts" context="module">
	import type { Readable } from 'svelte/store';
	import type { ButtonStyle } from './button';
	import Store from '../store';
	import { getContext, setContext } from 'svelte';

	const key = Symbol('ButtonStyle');

	export class ButtonTheme {
		static #default = new this('base');
		static #defaultStore = Store.const(this.#default);

		static get current(): Readable<ButtonTheme> {
			return getContext(key) ?? ButtonTheme.#defaultStore;
		}

		constructor(readonly style: ButtonStyle) {}
	}
</script>
<script lang="ts">
	export let style: ButtonStyle;

	const store = Store.controller<ButtonTheme>();

	$: $store = new ButtonTheme(style);

	setContext(key, store);
</script>
<slot/>