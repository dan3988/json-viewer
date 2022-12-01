<script lang="ts">
	import type { JsonValue } from "./json";

	export let token: JsonValue;

	function getNode(value: any) {
		if (value === null || typeof value !== "string") {
			const text = String(value);
			return document.createTextNode(text);
		} else {
			const text = JSON.stringify(value);
			if (value.startsWith("http://") || value.startsWith("https://")) {
				const a = document.createElement("a");
				a.href = value;
				a.textContent = text;
				return a;
			} else {
				return document.createTextNode(text);
			}
		}
	}

	function render(target: HTMLElement, value: any): SvelteActionReturnType {
		let e = getNode(value);
		target.appendChild(e);
		return {
			destroy() {
				e.remove();
			},
			update(newValue) {
				if (value !== newValue) {
					value = newValue;
					const next = getNode(value);
					e.replaceWith(next);
					e = next;
				}
			}
		}
	}
</script>
<style lang="scss">
	@import "./core.scss";

	.json-value {
		white-space: nowrap;
	}
	
	.json-string {
		color: var(--col-json-str-fg);
	}
	
	.json-number {
		color: var(--col-json-num-fg);
	}
	
	.json-boolean {
		color: var(--col-json-bln-fg);
	}
	
	.json-null {
		color: var(--col-json-null-fg);
	}
</style>
{#if token}
<span class="json-value json-{token.subtype}" use:render={token.value}></span>
{/if}