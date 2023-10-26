<script lang="ts">
	import type { PopupEvents } from "../types";
	import type { ComponentConstructorOptions, ComponentProps, SvelteComponent } from "svelte";
	import { createEventDispatcher } from "svelte";
	import Popup from "./Popup.svelte";

	type Component = $$Generic<SvelteComponent>;
	type Props = ComponentProps<Component>;

	export let component: new(options: ComponentConstructorOptions<Props>) => Component;
	export let props: Props;
	export let title: string = "";
	export let width: undefined | number = undefined;
	export let height: undefined | number = undefined;

	const dispatcher = createEventDispatcher<PopupEvents<void>>();

	function onCancel() {
		dispatcher("canceled");
	}

	function onConfirm() {
		dispatcher("confirmed");
	}
</script>
<Popup {title} {width} {height} on:canceled={onCancel} on:confirmed={onConfirm}>
	<svelte:component this={component} {...props} />
</Popup>