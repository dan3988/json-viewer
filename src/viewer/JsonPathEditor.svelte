<script lang="ts" context="module">
	import type { JsonProperty } from "../json";

	export interface EventMap {
		"finished": JsonProperty | null;
		"cancelled": void;
	}
</script>
<script lang="ts">
	import type { ViewerModel } from "../viewer-model";
	import { createEventDispatcher, tick } from "svelte";
	import dom from "./dom-helper";

	export let model: ViewerModel;

	$: ({ selected } = model.bag.readables);

	const dispatcher = createEventDispatcher<EventMap>();

	let _target: HTMLElement;

	function _focus() {
		dom.setCaret(_target, 0, true);
	}

	function _unfocus() {
		getSelection()?.removeAllRanges();
	}

	export function focus() {
		tick().then(_focus);
	}

	function render(target: HTMLElement, selected: null | JsonProperty) {
		_target = target;

		function update(newValue: null | JsonProperty, first?: boolean) {
			if (first || selected !== newValue) {
				selected = newValue;

				if (selected == null) {
					target.innerText = "";
				} else {
					target.innerText = selected.path.join("/");
				}
			}
		}

		const unsub = target.subscribe({
			focusout() {
				dispatcher("cancelled");
			},
			input() {

			},
			keypress(evt) {
				if (evt.key === "Esc") {
					if (dispatcher("cancelled"))
						_unfocus();
				} else if (evt.key === "Enter") {
					evt.preventDefault();
					const path = _target.innerText;
					const resolved = model.resolve(path);
					if (dispatcher("finished", resolved, { cancelable: true }))
						_unfocus();
				}
			}
		});

		update(selected, true);

		return {
			update,
			destroy() {
				target.innerHTML = "";
				unsub();
			},
		};
	}
</script>
<style lang="scss">
	@use "../core.scss" as *;

	.root {
		outline: none;
	}
</style>
<div class="root" tabindex="-1" role="textbox" contenteditable="true" use:render={$selected}></div>