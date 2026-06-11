<script lang="ts" module>
	import type { PopupProps } from '../types';
	import * as svelte from "svelte";
	import Store from '../store';

	export class OverlayController {
		static get current(): OverlayController {
			return svelte.getContext(controllerKey);
		}

		readonly #stack: PopupInfo[] = [];
		readonly #current = Store.controller<PopupInfo>();

		get current() {
			return this.#current.store;
		}

		constructor() {
		}

		show<TComp extends svelte.Component<PopupProps<TResult>>, TResult>(comp: TComp, props: svelte.ComponentProps<TComp>): Promise<TResult>;
		show<TComp extends svelte.Component<PopupProps<TResult>>, TResult>(comp: TComp, props: svelte.ComponentProps<TComp>, confirm: (result: TResult) => boolean): Promise<void>;
		show<TResult>(comp: svelte.Component, props: Dict, confirm?: (result: TResult) => boolean) {
			const stack = this.#stack;
			const store = this.#current;
			return new Promise<TResult | void>(resolve => {
				let complete: Consumer<TResult>;
				if (confirm) {
					complete = (result) => confirm(result) && close();
				} else {
					complete = close;
				}

				function close(result?: TResult) {
					store.value = stack.pop();
					resolve(result);
				}

				store.value && stack.push(store.value);
				store.value = [comp, props, complete, close];
			});
		}
	}

	type PopupInfo<C extends svelte.Component<PopupProps<R>> = any, R = any> = [
		clazz: C,
		props: svelte.ComponentProps<C>,
		completion: Consumer<R>,
		cancel: Action
	];

	const controllerKey = Symbol('Overlay.controller');

	function setController(controller: OverlayController) {
		svelte.setContext(controllerKey, controller);
	}
</script>
<script lang="ts">

	interface Props {
		controller?: OverlayController;
		children?: svelte.Snippet;
	}

	const {
		controller,
		children,
	}: Props = $props();

	const ownController = $derived(controller ?? new OverlayController());
	const { current } = $derived(ownController);

	$effect.pre(() => setController(ownController));
</script>
<div class="root">
	{@render children?.()}
	{#if $current}
		{@const [Popup, props, onconfirm, oncancel] = $current}
		<Popup {...props} {onconfirm} {oncancel} />
	{/if}
</div>
