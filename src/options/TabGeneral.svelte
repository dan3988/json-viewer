<script lang="ts" module>
	const indents = [
		["Tab", "\t"],
		["Space", " "]
	];
</script>
<script lang="ts">
	import type preferences from "../preferences-lite";
	import type EditorModel from "./editor";
	import NumberEditor from "../shared/NumberEditor.svelte";

	interface Props {
		model: EditorModel<preferences.lite.Bag>;
	}

	const { model }: Props = $props();
	const { enabled, indentChar, indentCount, useHistory, useWebRequest } = $derived(model.props);
</script>
<div class="root">
	<div class="input-group">
		<label class="input-group-text flex-fill align-items-start gap-1">
			<input class="form-check-input" type="checkbox" bind:checked={$enabled}/>
			Enabled
		</label>
	</div>
	<div class="input-group">
		<label class="input-group-text flex-fill align-items-start gap-1">
			<input class="form-check-input" type="checkbox" bind:checked={$useHistory}/>
			Use History
		</label>
	</div>
	<div class="input-group">
		<label class="input-group-text flex-fill align-items-start gap-1">
			<input class="form-check-input" type="checkbox" bind:checked={$useWebRequest}/>
			Show Request Headers
		</label>
	</div>
	<div class="input-group grp-indent">
		<span class="input-group-text">Clipboard Indent</span>
		<NumberEditor class="form-control" bind:value={$indentCount} type="integer" min={1} max={10}/>
		<select class="form-select" bind:value={$indentChar}>
			{#each indents as [key, value]}
				<option value={value}>{key}</option>
			{/each}
		</select>
	</div>
</div>
<style lang="scss">
	.root {
		max-width: 500px;
		padding: var(--padding);
		display: flex;
		gap: var(--padding);
		flex-direction: column;
	}

	.input-group-text {
		flex: 0 0 9.5rem;
	}
</style>