<script lang="ts" module>
	const repeatDelay = 500;
	const repeatInterval = 100;
</script>
<script lang="ts">
	import type { ButtonStyle } from "../button.js";
	import ButtonThemeData from "./theme";
	import Icon from "../Icon.svelte";
	import { onDestroy, type Snippet } from "svelte";

	interface Props {
		style?: ButtonStyle | undefined;
		icon?: BootstrapIconKey | "";
		title?: boolean | string;
		repeat?: boolean;
		action?: EventHandler<void, MouseEvent> | Falsy;
		text?: string;
		children?: Snippet;
	}

	const {
		style,
		icon = '',
		title = true,
		repeat = false,
		action,
		text,
		children,
	}: Props = $props();

	const theme = ButtonThemeData.current;
	const tooltip = $derived((typeof title === "boolean" ? (title ? text : undefined) : title) ?? "");
	const clazz = $derived(style ?? $theme.style);

	let timeout = 0;
	let isClick = true;

	function onClick(evt: MouseEvent) {
		isClick && action && action(evt);
	}

	function onMouseDown(evt: MouseEvent) {
		isClick = true;
		if (repeat && action) {
			isClick = true;
			timeout = window.setTimeout(hold, repeatDelay, action, evt, repeatInterval);
		}
	}

	function hold(action: EventHandler<void, MouseEvent>, evt: MouseEvent, delay: number) {
		isClick = false;
		action(evt);
		timeout = window.setTimeout(hold, delay, action, evt, delay);
	}

	function cancel() {
		if (timeout) {
			window.clearTimeout(timeout);
			timeout = 0;
		}
	}

	onDestroy(() => cancel?.());
</script>
<button
	class="btn btn-{clazz} d-flex gap-2"
	class:disabled={!action}
	title={tooltip}
	aria-label={tooltip}
	onclick={onClick}
	onmousedown={onMouseDown}
	onmouseup={cancel}
	onmouseleave={cancel}>
	{#if icon}
		<Icon {icon} />
	{/if}
	{#if children}
		{@render children()}
	{:else if text}
		{text}
	{/if}
</button>
