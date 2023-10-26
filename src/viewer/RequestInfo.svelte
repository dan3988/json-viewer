<script lang="ts" context="module">
	import type { DocumentRequestInfo, DocumentHeader } from "../types.d.ts"

	function wrapHeaders(info: undefined | DocumentRequestInfo): [title: string, headers: DocumentHeader[]][] {
		return info ? [["Request Headers", info.requestHeaders], ["Response Headers", info.responseHeaders]] : [];
	}
</script>
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
		{#each wrapHeaders(info) as [title, values]}
			<span class="h5 title border-bottom py-2">{title}</span>
			<ul class="list pairs mono">
				{#each values as [key, value]}
					<li class="header pairs">
						<span class="copy-btn btn btn-cust-light" role="button" title="Copy"></span>
						<span class="row-key" title={key}>{key}</span>
						<span class="row-val" title={value}>{value}</span>
					</li>
				{/each}
			</ul>
		{/each}
	</div>
{/if}