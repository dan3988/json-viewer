<script lang="ts" module>
	export type MenuAlign = 'left' | 'right';

	export type SizeValue = undefined | string;
	export type Size = SizeValue | [width: SizeValue, height: SizeValue];

	function unwrapSize(size: undefined | Size): [string?, string?] {
		if (size == undefined)
			return [];

		if (Array.isArray(size))
			return size;

		return [size, size];
	}
</script>
<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		alignment?: MenuAlign;
		initialMenuSize?: Size;
		menuShown?: boolean;
		minMenuSize?: Size;
		maxMenuSize?: Size;
		menuCollapseWidth?: number;
		children: Snippet;
		menu: Snippet;
	}

	let {
		alignment = 'left',
		initialMenuSize,
		menuShown = $bindable(false),
		minMenuSize,
		maxMenuSize,
		menuCollapseWidth = 150,
		children,
		menu,
	}: Props = $props();

	const [initialMenuWidth, initialMenuHeight] = $derived(unwrapSize(initialMenuSize));
	const [minMenuWidth, minMenuHeight] = $derived(unwrapSize(minMenuSize));
	const [maxMenuWidth, maxMenuHeight] = $derived(unwrapSize(maxMenuSize));
	const resizeDirection = $derived(alignment === 'right' ? 1 : -1);

	let menuElement: HTMLElement;

	function resizeBegin(startPos: number, startSize: number, evtProp: "x" | "y", styleProp: "width" | "height", direction: number = 1) {
		function onMove(evt: MouseEvent) {
			const pos = Math.max(0, startSize + (startPos - evt[evtProp]) * -direction);
			menuShown = pos >= menuCollapseWidth;
			menuElement.style[styleProp] = pos + "px";
		}

		function onEnd(evt: MouseEvent) {
			document.off("mousemove", onMove);

			let size: string | number = Math.max(0, startSize + (startPos - evt[evtProp]) * -direction);
			if (size < menuCollapseWidth) {
				const v = menuElement.getAttribute("data-remember-" + evtProp);
				if (v != null)
					menu.style[styleProp] = v + "px";
			} else {
				menuElement.setAttribute("data-remember-" + evtProp, String(size));
				menuElement.style[styleProp] = size + "px";
			}
		}

		document.on("mousemove", onMove);
		document.once("mouseup", onEnd);
	}

	function onGrabberHMouseDown(evt: MouseEvent) {
		resizeBegin(evt.x, menuElement.clientWidth, "x", "width", resizeDirection);
	}

	function onGrabberVMouseDown(evt: MouseEvent) {
		resizeBegin(evt.y, menuElement.clientHeight, "y", "height");
	}
</script>
<style lang="scss">
	@use "../core.scss" as *;

	.root {
		display: grid;
		overflow: hidden;

		$break: 900px;
		$gap-h: 5rem;

		@media only screen and (max-width: $break) {
			grid-template-columns: 1fr;
			grid-template-rows: auto auto 1fr;
			grid-template-areas: "menu" "resize" "content";

			> .p-menu {
				width: unset !important;
				height: var(--menu-init-height);
				min-height: var(--menu-min-height);
				max-height: var(--menu-max-height);
			}

			> .gripper-h {
				display: none;
			}
		}
		
		@media only screen and (min-width: $break) {
			grid-template-rows: 1fr auto;
			grid-template-columns: 1fr;
			max-height: 100vh;

			&[data-menu-align="left"] {
				grid-template-columns: auto auto 1fr;
				grid-template-areas: "menu resize content";

				> .gripper-v {
					display: none;
				}
			}

			&[data-menu-align="right"] {
				grid-template-columns: 1fr auto auto;
				grid-template-areas: "content resize menu";
			}

			> .p-menu {
				width: var(--menu-init-width);
				height: unset !important;
				min-width: var(--menu-min-width);
				max-width: var(--menu-max-width);
			}

			> .gripper-v {
				display: none;
			}
		}

		&[data-menu-shown="false"] {
			> .gripper,
			> .p-menu {
				display: none;
			}
		}
	}

	.gripper {
		grid-area: resize;
		user-select: none;
	}

	.gripper-v {
		cursor: ns-resize;
		height: 5px;
	}

	.gripper-h {
		cursor: ew-resize;
		width: 5px;
	}

	.p-menu {
		grid-area: menu;
	}

	.p-content {
		grid-area: content;
	}

	.slot-wrapper {
		position: relative;
	}
</style>
<div
	class="root"
	data-menu-align={alignment}
	data-menu-shown={menuShown}
	style:--menu-min-height={minMenuHeight}
	style:--menu-max-height={maxMenuHeight}
	style:--menu-min-width={minMenuWidth}
	style:--menu-max-width={maxMenuWidth}
	style:--menu-init-height={initialMenuHeight}
	style:--menu-init-width={initialMenuWidth}>
	<div class="slot-wrapper p-content">
		{@render children()};
	</div>
	<div class="slot-wrapper p-menu" bind:this={menuElement}>
		{@render menu()};
	</div>
	<div class="gripper gripper-h" onmousedown={onGrabberHMouseDown}></div>
	<div class="gripper gripper-v" onmousedown={onGrabberVMouseDown}></div>
</div>