<script lang="ts" context="module">
	export type Coords = [x: number | string, y: number | string];

	export interface MenuItemBase {
		name: string;
		type: string;
	}

	export type MenuItem = MenuAction | SubMenu;

	export interface MenuAction extends MenuItemBase {
		type: "action";
		action: () => void;
	}

	export interface SubMenu extends MenuItemBase {
		type: "menu";
		items: ArrayLike<MenuItem>;
	}

	export interface EventMap {
		closed: never;
	}

	const nestedPos = ["100%", "calc(var(--bs-border-width) * -1)"] as const;
	const nestedKey = Symbol("ContextMenu.nested");

	function unwrapPos(pos: Coords | undefined): readonly [string, string] {
		if (pos == null)
			return nestedPos;

		let [x, y] = pos;
		if (typeof x === "number")
			x = x + "px";

		if (typeof y === "number")
			y = y + "px";

		return [x, y];
	}

	export type MenuInit = [name: string, value: Action | MenuInit[]];

	export function addMenuItems(items: MenuItem[], inits: MenuInit[]) {
		for (const [name, value] of inits) {
			const item: MenuItem = Array.isArray(value) ? { name, type: "menu", items: createMenu(value) } : { name, type: "action", action: value }
			items.push(item);
		}
	}

	export function createMenu(inits: MenuInit[]): MenuItem[] {
		const items: MenuItem[] = [];
		addMenuItems(items, inits);
		return items;
	}
</script>
<script lang="ts">
	import { createEventDispatcher, getContext, onDestroy, setContext } from "svelte";
	import dom from "./dom-helper";

	export let pos: Coords | undefined;
	export let items: ArrayLike<MenuItem>;

	let dispatcher: ReturnType<typeof createEventDispatcher<EventMap>> = getContext(nestedKey);
	let isNested = dispatcher == null;
	if (isNested) {
		dispatcher = createEventDispatcher();
		window.addEventListener("click", onWindowClick);
		window.addEventListener("auxclick", onWindowClick);
		onDestroy(() => {
			window.removeEventListener("click", onWindowClick);
			window.removeEventListener("auxclick", onWindowClick);
		});
	}

	setContext(nestedKey, dispatcher);

	let sub = -1;
	let elem: HTMLElement;

	function onWindowClick(evt: MouseEvent) {
		if (!dom.isDescendant(evt.target as any, elem)) {
			window.removeEventListener("click", onWindowClick);
			window.removeEventListener("auxclick", onWindowClick);
			dispatcher("closed");
		}
	}

	function invoke(action: MenuAction["action"]) {
		dispatcher("closed");
		action();
	}

	function onEnter(index: number, evt: MouseEvent) {
		const target = evt.currentTarget;
		if (!(target instanceof HTMLElement))
			return;

		const id = setTimeout(onDelay, 500);

		target.addEventListener("mouseleave", onMouseLeave);

		function onMouseLeave() {
			clearTimeout(id);
		}
		
		function onDelay() {
			target!.removeEventListener("mouseleave", onMouseLeave);
			sub = index;
		}
	}

	function setSub(index: number) {
		sub = index;
	}

	$: [left, top] = unwrapPos(pos);
</script>
<style lang="scss">
	@use "../core.scss" as *;

	.context-menu {
		position: absolute;
		width: 10rem;
		z-index: 100;
		font-size: small;

		> li {
			position: relative;
		}
	}

	.context-menu-item {
		display: flex;
		--context-menu-color: var(--bs-body-color);
		border-style: solid;
		border-width: 0;
		border-color: var(--bs-border-color);
		color: var(--context-menu-color);

		position: relative;

		&.type-menu {
			> .context-menu-label {
				flex: 1 1 0px;
			}

			&:after {
				@include img-mask(bs-icon("chevron-right"));
				content: "";
				flex: 0 0 1rem;
				margin: 0.5rem;
				background-color: var(--context-menu-color);
			}
		}

		&:hover {
			z-index: 1;
			--context-menu-color: var(--bs-emphasis-color);
		}
		
		&:hover,
		&.opened {
			background-color: var(--bs-secondary-bg);
			border-width: var(--bs-border-width);
			margin: calc(var(--bs-border-width) * -1);
		}

		&:hover + &.opened {
			border-top-width: 0;
			margin-top: 0;
		}
	}
</style>
<ul class="root context-menu bg-body-tertiary border" style:left style:top bind:this={elem}>
	{#each items as item, i}
		{#if item.type === "action"}
			<li class="context-menu-item type-{item.type}" role="button" on:click={invoke.bind(undefined, item.action)}>
				<span class="context-menu-label p-1">{item.name}</span>
			</li>
		{:else}
			<li class="context-menu-item type-{item.type}" class:opened={i === sub} role="button" on:click={() => setSub(i)} on:mouseenter={e => onEnter(i, e)}>
				<span class="context-menu-label p-1">{item.name}</span>
				{#if i === sub}
					<svelte:self pos={nestedPos} items={item.items}/>
				{/if}
			</li>
		{/if}
	{/each}
</ul>