<script lang="ts" context="module">
	import { getContext, setContext } from "svelte";
	import Store, { StoreController } from "../../store";

	const key = Symbol('Menu.MenuController');

	export abstract class MenuController {
		static ofContext(): MenuController {
			return getContext(key);
		}

		static setContext(controller: MenuController) {
			setContext(key, controller);
		}

		abstract addItem(): IMenuActionController;

		abstract addList(): IMenuListController;
	}

	class RootMenuController extends MenuController {
		readonly #entries: StoreController<MenuItemController[]>;
		readonly #invalidate: VoidFunction;

		constructor(entries: StoreController<MenuItemController[]>) {
			super();
			this.#entries = entries;
			this.#invalidate = StoreController.prototype.update.bind(this.#entries, v => v);
		}

		#addEntry<T extends MenuItemController>(ctor: new(entries: MenuItemController[], invalidate: VoidFunction) => T) {
			const entry = new ctor(this.#entries.value, this.#invalidate);
			this.#entries.value.push(entry);
			this.#invalidate();
			return entry;
		}

		addItem(): IMenuActionController {
			return this.#addEntry(MenuActionController);
		}

		addList(): IMenuListController {
			return this.#addEntry(MenuListController);
		}
	}

	abstract class BaseMenuItemController<T extends 'action' | 'list' = any> implements IBaseMenuItemController {
		readonly #invalidate: VoidFunction;
		readonly #entries: MenuItemController[];

		title = '';
		icon = '';

		constructor(readonly type: T, entries: MenuItemController[], invalidate: VoidFunction) {
			this.#entries = entries;
			this.#invalidate = invalidate;
			this.onDestroyed = this.onDestroyed.bind(this);
		}

		onDestroyed(): void {
			const i = this.#entries.indexOf(this as any);
			if (i >= 0) {
				this.#entries.splice(i, 1);
				this.#invalidate();
			}
		}
	}

	class MenuActionController extends BaseMenuItemController<'action'> implements IMenuActionController {
		keepOpen = false;
		action: VoidFunction = Function.prototype as any;

		constructor(entries: MenuItemController[], invalidate: VoidFunction) {
			super('action', entries, invalidate);
		}
	}

	class MenuListController extends BaseMenuItemController<'list'> implements IMenuListController {
		readonly #invalidate: VoidFunction;
		readonly #children: MenuActionController[] = [];

		get children(): readonly IMenuActionController[] {
			return this.#children;
		}

		constructor(entries: MenuItemController[], invalidate: VoidFunction) {
			super('list', entries, invalidate);
			this.#invalidate = invalidate;
		}

		addItem(): IMenuActionController {
			const entry = new MenuActionController(this.#children, this.#invalidate)
			this.#children.push(entry);
			this.#invalidate();
			return entry;
		}

		addList(): IMenuListController {
			throw new TypeError('Cannot add a nested list item.');
		}
	}

	export interface IBaseMenuItemController {
		readonly type: 'action' | 'list';
		icon: string;
		title: string;

		onDestroyed(): void;
	}

	export type MenuItemController = IMenuActionController | IMenuListController;

	export interface IMenuActionController extends IBaseMenuItemController {
		readonly type: 'action';
		keepOpen: boolean;
		action: VoidFunction;
	}

	export interface IMenuListController extends IBaseMenuItemController, MenuController {
		readonly type: 'list';
		readonly children: readonly IMenuActionController[];
	}

	class Timeout {
		static #execute(self: Timeout, callback: VoidFunction) {
			self.#id = 0;
			callback();
		}

		readonly #delay: number;
		#id = 0;

		constructor(delay: number) {
			this.#delay = delay;
		}

		cancel(): boolean {
			if (this.#id) {
				clearTimeout(this.#id);
				return true;
			} else {
				return false;
			}
		}

		schedule(callback: VoidFunction) {
			this.#id && clearTimeout(this.#id);
			this.#id = setTimeout(Timeout.#execute, this.#delay, this, callback) as any;
		}
	}
</script>
<script lang="ts">
	export let title: string;
	export let close: VoidFunction;

	const entries = Store.controller<MenuItemController[]>([]);
	const controller = new RootMenuController(entries);

	MenuController.setContext(controller);

	let activePrimary: MenuItemController | null = null;
	let activeSub: MenuItemController | null = null;
	let expanded: IMenuListController | null = null;
	let enterTimeout = new Timeout(250);
	let leaveTimeout = new Timeout(500);

	function onClick(entry: MenuItemController) {
		if (entry.type === 'action') {
			entry.keepOpen || close();
			entry.action();
		}
	}

	function onMouseLeave(entry: MenuItemController) {
		if (!enterTimeout.cancel() && activePrimary === entry) {
			leaveTimeout.schedule(() => {
				expanded = null;
				activePrimary = null;
				activeSub = null;
			})
		}
	}

	function onMouseEnter(entry: MenuItemController) {
		if (leaveTimeout.cancel() && expanded === entry) {
			return;
		}

		expanded = null;
		activePrimary = entry;
		activeSub = null;

		if (entry.type === 'list') {
			const list = entry;
			enterTimeout.schedule(() => expanded = list);
		}
	}

	function onNestedMouseEnter(entry: MenuItemController) {
		activeSub = entry;
	}
</script>
<div class="menu-root bg-body-tertiary border rounded">
	<span class="title">{(activeSub ?? activePrimary)?.title ?? title}</span>
	<ul class="menu-list">
		{#each $entries as entry}
			{@const { icon } = entry}
			{@const role = entry.type === 'action' ? 'button' : 'menu'}
			<li on:mouseenter={() => onMouseEnter(entry)} on:mouseleave={() => onMouseLeave(entry)}>
				<span class="btn {icon && `bi-${icon}`}" class:open={expanded === entry} {role} on:click={() => onClick(entry)} />
				{#if expanded == entry}
					<div class="floating-menu">
						<ul class="menu-list bg-body-tertiary border rounded">
							{#each expanded.children as entry}
								{@const { icon } = entry}
								<li on:mouseenter={() => onNestedMouseEnter(entry)}>
									<span class="btn {icon && `bi-${icon}`}" role="menuitem" on:click={() => onClick(entry)} />
								</li>
							{/each}
						</ul>
					</div>
				{/if}
			</li>
		{/each}
	</ul>
	<slot />
</div>
<style lang="scss">
	@use "../../core.scss" as *;

	.title {
		padding: $pad-med;
		font-size: 1rem;
	//	font-weight: 500;
	}

	.menu-list {
		display: flex;
		flex-direction: row;
		padding: $pad-med;
		gap: $pad-med;

		> li {
			position: relative;
			display: flex;
			flex-direction: row;
			align-items: center;
		}
	}

	.floating-menu {
		position: absolute;
		left: calc((var(--bs-border-width) + $pad-med) * -1);
		top: 100%;
		padding-top: $pad-med * 2;
	}

	.btn {
		border: none;
		--bs-btn-hover-bg: var(--jv-tertiary-hover-bg);
		--bs-btn-active-bg: var(--jv-tertiary-active-bg);
		--bs-btn-disabled-bg: var(--jv-tertiary-disabled-bg);
		--bs-btn-hover-color: var(--jv-tertiary-hover-text);
		--bs-btn-active-color: var(--jv-tertiary-active-text);
		--bs-btn-disabled-color: var(--jv-tertiary-disabled-text);

		&.open:not(:hover) {
			color: var(--bs-btn-active-color);
			background-color: var(--bs-btn-active-bg);
			border-color: var(--bs-btn-active-border-color);
		}
	}
</style>
