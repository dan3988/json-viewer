<script lang="ts">
import { defineComponent } from "vue";
import { JsonValue } from "../json"

export default defineComponent({
	props: {
		token: {
			type: JsonValue,
			required: true,
		}
	}
})
</script>
<template>
	<span class="json-value json-{{ token.subtype }}">{{ token.value }}</span>
</template>