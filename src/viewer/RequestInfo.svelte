<script lang="ts">
	import type ViewerModel from "../viewer-model";

	export let model: ViewerModel;

	$: info = model.requestInfo;
</script>
<style lang="scss">
	.root {
		grid-template-columns: min(33%, 20rem) 1fr;
		grid-auto-flow: row;
		grid-column-gap: .5rem;

		> * {
			grid-column: 1 / -1;
		}
	}

	.mono {
		font-family: monospace;
	}

	.list span {
		text-overflow: ellipsis;
		overflow: hidden;
		white-space: nowrap;
	}

	.pairs {
		display: contents;
	}

	.header-key {
		text-align: right;
		color: var(--col-json-key-fg);
	}

	.header-val {
		color: var(--col-json-str-fg);
	}
</style>
{#if info}
	<div class="root d-grid">
		<div class="mono status pairs flex-column text-body-emphasis">
			<span class="header-key">Status</span>
			<span class="header-val">{info.statusText}</span>
			<span class="header-key">Initiated</span>
			<span class="header-val">{new Date(info.startTime)}</span>
			<span class="header-key">Duration</span>
			<span class="header-val">{info.endTime - info.startTime}</span>
		</div>
		<span class="h5 title border-bottom py-2">Request Headers</span>
		<ul class="list pairs mono">
			{#each info.requestHeaders as [key, value]}
				<li class="pairs">
					<span class="header-key name">{key}</span>
					<span class="header-val">{value}</span>
				</li>
			{/each}
		</ul>
		<span class="h5 title border-bottom py-2">Response Headers</span>
		<ul class="list pairs mono">
			{#each info.responseHeaders as [key, value]}
				<li class="pairs">
					<span class="header-key name" title={key}>{key}</span>
					<span class="header-val" title={value}>{value}</span>
				</li>
			{/each}
		</ul>
	</div>
{/if}