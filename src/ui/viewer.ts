import JsonViewer from "./JsonViewer.svelte";
import { JsonToken } from "./json"

const pre = document.querySelector("pre");
pre.remove();
const json = JSON.parse(pre.innerText);
const root = JsonToken.create(json);

new JsonViewer({
	target: document.body,
	props: {
		root
	}
})
