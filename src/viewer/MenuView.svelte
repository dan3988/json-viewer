<script lang="ts" context="module">
	export enum MenuAlign {
		Left,
		Right
	}

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
	export let alignment: MenuAlign = MenuAlign.Left;
	export let initialMenuSize: undefined | Size = undefined;
	export let menuShown = false;
	export let minMenuSize: undefined | Size = undefined;
	export let maxMenuSize: undefined | Size = undefined;
	export let menuCollapseWidth = 150;

	$: [initialMenuWidth, initialMenuHeight] = unwrapSize(initialMenuSize);
	$: [minMenuWidth, minMenuHeight] = unwrapSize(minMenuSize);
	$: [maxMenuWidth, maxMenuHeight] = unwrapSize(maxMenuSize);
	$: align = MenuAlign[alignment].toLowerCase() as "left" | "right";

	let menu: HTMLElement;

	function resizeBegin(startPos: number, startSize: number, evtProp: "x" | "y", styleProp: "width" | "height", direction: number = 1) {
		function onMove(evt: MouseEvent) {
			const pos = Math.max(0, startSize + (startPos - evt[evtProp]) * -direction);
			menuShown = pos >= menuCollapseWidth;
			menu.style[styleProp] = pos + "px";
		}

		function onEnd(evt: MouseEvent) {
			document.off("mousemove", onMove);

			let size: string | number = Math.max(0, startSize + (startPos - evt[evtProp]) * -direction);
			if (size < menuCollapseWidth) {
				const v = menu.getAttribute("data-remember-" + evtProp);
				if (v != null)
					menu.style[styleProp] = v + "px";
			} else {
				menu.setAttribute("data-remember-" + evtProp, String(size));
				menu.style[styleProp] = size + "px";
			}
		}

		document.on("mousemove", onMove);
		document.once("mouseup", onEnd);
	}

	function onGrabberHMouseDown(evt: MouseEvent) {
		resizeBegin(evt.x, menu.clientWidth, "x", "width", ((alignment * -2) + 1));
	}

	function onGrabberVMouseDown(evt: MouseEvent) {
		resizeBegin(evt.y, menu.clientHeight, "y", "height");
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

		&[data-menu-shown="true"] {
			> .menu-btn {
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
	data-menu-align={align}
	data-menu-shown={menuShown}
	style:--menu-min-height={minMenuHeight}
	style:--menu-max-height={maxMenuHeight}
	style:--menu-min-width={minMenuWidth}
	style:--menu-max-width={maxMenuWidth}
	style:--menu-init-height={initialMenuHeight}
	style:--menu-init-width={initialMenuWidth}>
	<div class="slot-wrapper p-content">
		<slot/>
	</div>
	<div class="slot-wrapper p-menu" bind:this={menu}>
		<slot name="menu"/>
	</div>
	<div class="gripper gripper-h" on:mousedown={onGrabberHMouseDown}/>
	<div class="gripper gripper-v" on:mousedown={onGrabberVMouseDown}/>
</div>