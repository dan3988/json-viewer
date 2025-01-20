<script lang="ts" context="module">
	import type { ListValidator } from "./ListEditor.svelte";
	import type ImmutableArray from "../immutable-array";

	class SettingListValidator implements ListValidator {
		readonly #validation: [] | [RegExp, string];

		constructor()
		constructor(regex: RegExp, message: string)
		constructor(...args: [] | [RegExp, string]) {
			this.#validation = args;
		}

		validate(items: ImmutableArray<string>, index: number, item: string): string | undefined {
			const existing = items.indexOf(item);
			if (existing >= 0 && existing != index)
				return "Duplicate";

			if (this.#validation.length) {
				const [regex, msg] = this.#validation;
				regex.lastIndex = 0;
				if (!regex.test(item))
					return msg;
			}
		}
	}

	const mimeValidator = new SettingListValidator();
	const hostValidator = new SettingListValidator(/^(([a-z0-9]|[a-z0-9][a-z0-9\-]*[a-z0-9])\.)*([a-z0-9]|[a-z0-9][a-z0-9\-]*[a-z0-9])(:\d{1,5})?$/gi, "Invalid hostname");
</script>
<script lang="ts">
	import type preferences from "../preferences-lite";
	import type EditorModel from "./editor";
	import ListEditor from "./ListEditor.svelte";

	export let model: EditorModel<preferences.lite.Bag>;

	$: ({ changed, props: { mimes, whitelist, blacklist } } = model);
</script>
<div class="root">
	<div class="layout">
		<div class="input-group grp-mimes list" class:dirty={$changed.includes('mimes')}>
			<ListEditor title="MIME Types" help="A list of mime types that the extension will try to parse as JSON." validator={mimeValidator} bind:items={$mimes}/>
		</div>
		<div class="input-group grp-whitelist list" class:dirty={$changed.includes('whitelist')}>
			<ListEditor title="Whitelist" help="A list of hosts to automatically load the extension for." validator={hostValidator} bind:items={$whitelist}/>
		</div>
		<div class="input-group grp-whitelist list" class:dirty={$changed.includes('blacklist')}>
			<ListEditor title="Blacklist" help="A list of hosts to not load the extension for." validator={hostValidator} bind:items={$blacklist}/>
		</div>
	</div>
</div>
<style lang="scss">
	$breakpoint-sm: 500px;
	$breakpoint-lg: 960px;

	@media only screen and (max-width: $breakpoint-lg) {
		.root {
			--content-flex: 1 1 20rem;
			--flex-direction: column;
		}
	}

	@media only screen and (min-width: $breakpoint-lg) {
		.root {
			--content-flex: 1 1 0;
			--flex-direction: row;
		}
	}

	.root {
		display: flex;
		overflow: hidden;
		padding: var(--padding);
		gap: var(--padding);
		flex: 1 1 0;
	}

	.layout {
		display: flex;
		overflow: hidden;
		flex: 1 1 0;
		flex-direction: var(--flex-direction);
		gap: var(--padding);
	}

	.list {
		flex: var(--content-flex);
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
</style>