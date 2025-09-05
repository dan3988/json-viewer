<script lang="ts" context="module">
	const repeatDelay = 500;
	const repeatInterval = 100;
</script>
<script lang="ts">
	import Button from "./button";
	import Icon from "./Icon.svelte";
	import { onDestroy } from "svelte";

	export let style: Button.Style | undefined = undefined;
	export let icon: BootstrapIconKey | "" = "";
	export let title: boolean | string = true;
	export let repeat = false;
	export let action: EventHandler<void, MouseEvent> | Falsy = undefined;
	export let text: string | undefined = undefined;

	const theme = Button.ThemeData.current;

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

	$: tooltip = (typeof title === "boolean" ? (title ? text : undefined) : title) ?? "";
	$: clazz = style ?? $theme.style;
</script>
<button
	class="btn btn-{clazz} d-flex gap-2"
	class:disabled={!action}
	title={tooltip}
	aria-label={tooltip}
	on:click={onClick}
	on:mousedown={onMouseDown}
	on:mouseup={cancel}
	on:mouseleave={cancel}>
	{#if icon}
		<Icon {icon} />
	{/if}
	<slot>{text ?? ""}</slot>
</button>
