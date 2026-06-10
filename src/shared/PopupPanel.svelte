<script lang="ts">
	import type * as svelte from "svelte";
	import type { PopupProps } from "../types";
	import Popup from "./Popup.svelte";

	type TComponent = $$Generic<svelte.Component>;

	interface Props extends PopupProps<void> {
		component: TComponent;
		props: svelte.ComponentProps<TComponent>;
		title?: string;
		width?: number;
		height?: number;
	}

	const {
		component: Component,
		props,
		title = "",
		width,
		height,
		oncancel,
		onconfirm,
	}: Props = $props();
</script>
<Popup {title} {width} {height} {oncancel} {onconfirm}>
	<Component {...props} />
</Popup>