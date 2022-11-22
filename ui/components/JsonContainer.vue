<script lang="ts">
import { defineComponent } from "vue";
import { JsonContainer as _JsonContainer } from "../json"
import JsonContainer from "./JsonContainer.vue";
import JsonValue from "./JsonValue.vue";

export default defineComponent({
    props: {
        token: {
            type: _JsonContainer,
            required: true,
        }
    },
})
</script>
<template>
	<div class="json-container json-{{ token.subtype }}">
		<ul v-if="token" v-for="prop in token.props()">
			<li class="json-prop">
				<span class="json-key">{{ prop.key }}</span>
				<div class="json-value for-{{ prop.value.subtype }}">
					<div v-if="prop.value.is('container')">
						<JsonContainer :token="token"/>
					</div>
					<div v-if="prop.value.is('value')">
						<JsonValue :token="token"/>
					</div>
				</div>
			</li>
		</ul>
	</div>
</template>