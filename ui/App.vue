<script lang="ts">
import { defineComponent } from "vue";
import { JsonToken } from "./json"
import JsonContainer from "./components/JsonContainer.vue";
import JsonValue from "./components/JsonValue.vue";

export default defineComponent({
    props: {
        root: {
            type: JsonToken,
            required: true,
        }
    },
    components: { JsonContainer, JsonValue }
})
</script>
<template>
	<div v-if="root.is('container')">
		<JsonContainer :token="root"/>
	</div>
	<div v-if="root.is('value')">
		<JsonValue :token="root"/>
	</div>
</template>