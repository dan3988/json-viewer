<script lang="ts" context="module">
	import { noop } from "../util";
	import * as svelte from "svelte";

	const key = Symbol('JsonInsert.InserterManager');

	export class InserterManager {
		static createScope() {
			const instance = new InserterManager();
			svelte.setContext(key, instance);
			return instance;
		}

		static get current(): InserterManager {
			const value: InserterManager | undefined = svelte.getContext(key);
			if (!value)
				throw new TypeError('No InserterManager in context');

			return value;
		}

		readonly #blockers = new Set<Element>();
		readonly #handlers = new Map<Element, InserterRegistration>();
		#boundMouseMove: (evt: MouseEvent) => void;
		#active: InserterRegistration | null = null;
		#lockCount = 0;

		constructor() {
			this.#boundMouseMove = this.#onMouseMove.bind(this);
			this.blocker = this.blocker.bind(this);
		}

		blocker(target: HTMLElement) {
			const blockers = this.#blockers;
			const destroy = Set.prototype.delete.bind(blockers, target);
			blockers.add(target);
			return { destroy };
		}

		lock() {
			if (++this.#lockCount === 1) {
				this.#updateActive(null);
			}
		}

		unlock() {
			this.#lockCount--;
		}

		#updateActive(reg: InserterRegistration | null) {
			const active = this.#active;
			if (active === reg) {
				return;
			}

			this.#active = reg;
			active?.setActive?.(false);
			reg?.setActive?.(true);
		}

		#onMouseMove(evt: MouseEvent) {
			if (this.#lockCount) {
				return;
			}

			const elements = document.elementsFromPoint(evt.clientX, evt.clientY);
			for (const element of elements) {
				if (this.#blockers.has(element))
					break;

				const reg = this.#handlers.get(element);
				if (reg)
					return this.#updateActive(reg);
			}

			this.#updateActive(null);
		}

		#renderHitbox(reg: InserterRegistration, target: HTMLElement) {
			const mousemove = this.#boundMouseMove;
			const handlers = this.#handlers;
			if (!handlers.size) {
				window.addEventListener('mousemove', mousemove);
			}

			function destroy() {
				handlers.delete(target);
				if (!handlers.size) {
					window.removeEventListener('mousemove', mousemove);
				}
			}

			handlers.set(target, reg);

			return { destroy };
		}

		register(): InserterRegistration {
			return new InserterManager.#InserterRegistration(this);
		}

		static readonly #InserterRegistration = class implements InserterRegistration {
			readonly #owner: InserterManager;
			#locked = false;

			setActive: (this: void, active: boolean) => void = noop;

			constructor(owner: InserterManager) {
				this.#owner = owner;
				this.hitbox = this.hitbox.bind(this);
			}

			hitbox(target: HTMLElement) {
				return this.#owner.#renderHitbox(this, target);
			}

			lock() {
				this.#locked = true;
				this.#owner.#updateActive(this);
				this.#owner.#lockCount++;
			}

			unlock(evt?: MouseEvent): void {
				if (this.#locked) {
					this.#locked = false;
					const open = !(--this.#owner.#lockCount);
					if (evt && open) {
						this.#owner.#onMouseMove(evt);
					} else {
						this.#owner.#updateActive(null);
					}
				}
			}
		}
	}

	export interface InserterRegistration {
		setActive: Opt<(this: void, active: boolean) => void>;

		hitbox(this: void, target: HTMLElement): { destroy(): void };
		lock(): void;
		unlock(evt?: MouseEvent): void;
	}
</script>
<script lang="ts">
	import type json from "../json";
	import Button from "../components/button";
    import { slide } from "svelte/transition";

	export let insert: (type: json.AddType) => void;

	const manager = InserterManager.current;
	const reg = manager.register();

	reg.setActive = setActive;

	svelte.onDestroy(() => {
		reg.setActive = null;
		reg.unlock();
	});

	let active = false;
	let open = false;

	function setActive(value: boolean) {
		active = value;
	}

	let focusTarget: HTMLElement;

	function doInsert(type: json.AddType) {
		open = false;
		reg?.unlock();
		focusTarget.blur();
		insert(type);
	}

	function onFocusOut(evt: FocusEvent) {
		if (!focusTarget.contains(evt.relatedTarget as Node | null)) {
			collapse();
		}
	}

	function collapse(evt?: MouseEvent) {
		open = false;
		reg?.unlock(evt);
	}

	function expand() {
		open = true;
		focusTarget.focus();
		reg?.lock();
	}
</script>
<div class="root" class:active class:open>
	<div class="hitbox" use:reg.hitbox></div>
	<div class="separator"></div>
	<div class="expander" tabindex="0" on:focusout={onFocusOut} bind:this={focusTarget}>
		<Button icon="plus-lg" title="Insert" action={open ? collapse : expand}></Button>
		{#if open}
			<!-- <div class="menu-wrapper" transition:slide={{ axis: 'x', duration: 250 }}> -->
			<div class="menu-wrapper" transition:slide={{ axis: 'x', duration: 150 }}>
				<div class="menu-root btn-group">
					<Button title="Object" icon="braces" action={() => doInsert('object')} />
					<Button title="Array" icon="list" action={() => doInsert('array')} />
					<Button title="Value" icon="fonts" action={() => doInsert('value')} />
				</div>
			</div>
		{/if}
	</div>
</div>
<style lang="scss">
	@use "src/core.scss" as *;

	$width: 10em;
	$left: 1em;

	.root {
		opacity: 0;
		--btn-scale: 0.6;

		&.open {
			--btn-scale: 1;
		}

		&.active {
			opacity: 1;
		}
	}

	.hitbox {
		z-index: -1;
		position: absolute;
		inset: -0.6em 0;
	}

	.separator {
		position: absolute;
		top: calc(50% - 1px);
		height: 1px;
		left: $left;
		width: $width;
		background-color: var(--jv-tertiary-border);
	}

	.expander, .menu-root {
		> :global(.btn) {
			--bs-btn-padding-x: #{$pad-med};
			--bs-btn-padding-y: #{$pad-med};
			font-size: inherit;
		}
	}

	.expander {
		display: flex;
		gap: #{$pad-med};
		z-index: 3;
		position: absolute;
		left: $width + $left;
		top: 50%;
		translate: 0 -50%;
		transition: scale .15s ease-in-out;
		scale: var(--btn-scale, 1);
		transform-origin: left center;
	}

	.menu-wrapper {
		left: 0;
		transform-origin: center left;
	}

	.menu-root {
		position: relative;
		z-index: 3;
	}
</style>
