<script lang="ts">
	import type { JsonValue } from "./json";

	export let token: JsonValue;

	function render(target: HTMLElement, value: any): SvelteActionReturnType {
		let e: Text | HTMLAnchorElement;
		if (value === null) {
			e = document.createTextNode("null");
		} else {
			switch (typeof value) {
				case "number":
				case "boolean":
					e = document.createTextNode(String(value));
					break;
				case "string": {
					const text = JSON.stringify(value);
					if (value.startsWith("http://") || value.startsWith("https://")) {
						e = document.createElement("a");
						e.href = value;
						e.textContent = text;
					} else {
						e = document.createTextNode(text);
					}
					break;
				}
			}
		}

		target.appendChild(e);
		return {
			destroy() {
				e.remove();
			},
			update(...args) {
				debugger;
			}
		}
	}
</script>
<style lang="scss">
	@import "./core.scss";
	
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