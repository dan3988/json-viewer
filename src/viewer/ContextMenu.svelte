<script lang="ts" context="module">
	export type Coords = [x: number | string, y: number | string];

	export interface MenuItemBase {
		name: string;
		type: string;
	}

	export type MenuItem = MenuAction | SubMenu;

	export interface MenuAction extends MenuItemBase {
		type: "action";
		action: Action;
	}

	export interface SubMenu extends MenuItemBase {
		type: "menu";
		items: ArrayLike<MenuItem>;
	}

	export interface EventMap {
		closed: void;
	}

	export interface MenuBuilder {
		item(name: string, action: Action): this;
		menu(name: string, build: Action<MenuBuilder>): this;
		menu(name: string): SubMenuBuilder<this>;

		build(): MenuItem[];
	}

	export interface SubMenuBuilder<TParent extends MenuBuilder> extends MenuBuilder {
		end(): TParent;
	}

	class MenuBuilderImpl implements MenuBuilder {
		#items: MenuItem[];

		constructor() {
			this.#items = [];
		}

		build(): MenuItem[] {
			const items = this.#items;
			this.#items = [];
			return items;
		}

		item(name: string, action: Action<never, never, never, never, never>): this {
			this.#items.push({ type: "action", name, action });
			return this;
		}

		menu(name: string, build: Action<MenuBuilder>): this;
		menu(name: string): SubMenuBuilder<this>;
		menu(name: string, build?: Action<MenuBuilder>): this | SubMenuBuilder<this> {
			const builder = new SubMenuBuilderImpl(this);
			const items = builder.#items;
			this.#items.push({ type: "menu", name, items });
			if (build != null) {
				build(builder);
				return this;
			} else {
				return builder;
			}
		}
	}

	class SubMenuBuilderImpl<TParent extends MenuBuilderImpl> extends MenuBuilderImpl implements SubMenuBuilder<TParent> {
			readonly #parent: TParent;

			constructor(parent: TParent) {
				super();
				this.#parent = parent;
			}

			end(): TParent {
				return this.#parent;
			}
		}

	const nestedPos = ["100%", "0"] as const;
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

	export function menuBuilder() {
		return new MenuBuilderImpl();
	}
</script>
<script lang="ts">
	import { createEventDispatcher, getContext, onDestroy, setContext } from "svelte";
	import { slide } from "svelte/transition";
	import dom from "./dom-helper";

	export let pos: Coords | undefined;
	export let items: ArrayLike<MenuItem>;

	let dispatcher: ReturnType<typeof createEventDispatcher<EventMap>> = getContext(nestedKey);
	let isRoot = dispatcher == null;
	if (isRoot) {
		dispatcher = createEventDispatcher();

		const unsub = document.subscribe({
			click: onWindowClick,
			auxclick: onWindowClick
		});

		onDestroy(unsub);
	}

	setContext(nestedKey, dispatcher);

	let sub = -1;
	let elem: HTMLElement;

	function onWindowClick(evt: MouseEvent) {
		if (!dom.isDescendant(evt.target as any, elem))
			dispatcher("closed");
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
		const unsub = target.subscribe("mouseleave", onMouseLeave);

		function onMouseLeave() {
			clearTimeout(id);
		}
		
		function onDelay() {
			unsub();
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
		--context-menu-color: var(--bs-body-color);
		display: flex;
		color: var(--context-menu-color);
		position: relative;

		&.type-menu {
			> .context-menu-label {
				flex: 1 1 0px;
			}

			> .bi {
				flex: 0 0 1rem;
				margin: 0.5rem;
				color: var(--context-menu-color);
			}
		}

		&:hover {
			z-index: 1;
			--context-menu-color: var(--bs-emphasis-color);
		}
		
		&:hover,
		&.opened {
			background-color: var(--jv-tertiary-border);
		}

		&:hover + &.opened {
			border-top-width: 0;
			margin-top: 0;
		}
	}
</style>
<ul class="root context-menu bg-body-tertiary border" style:left style:top bind:this={elem} transition:slide={{ duration: 150 }}>
	{#each items as item, i}
		{#if item.type === "action"}
			<li class="context-menu-item type-{item.type}" role="button" on:click={invoke.bind(undefined, item.action)}>
				<span class="context-menu-label p-1">{item.name}</span>
			</li>
		{:else}
			<li class="context-menu-item type-{item.type}" class:opened={i === sub} role="button" on:click={() => setSub(i)} on:mouseenter={e => onEnter(i, e)}>
				<span class="context-menu-label p-1">{item.name}</span>
				{#if item.type === "menu"}
					<span class="bi bi-chevron-right"></span>
				{/if}
				{#if i === sub}
					<svelte:self pos={nestedPos} items={item.items}/>
				{/if}
			</li>
		{/if}
	{/each}
</ul>