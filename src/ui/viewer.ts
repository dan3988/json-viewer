import JsonViewer from "./JsonViewer.svelte";
import { JsonToken } from "./json"
import { ViewerModel } from "./viewer-model";

const pre = document.querySelector("pre");
pre.remove();
const json = JSON.parse(pre.innerText);
const root = JsonToken.create(json);
const model = new ViewerModel(root);

new JsonViewer({
	target: document.body,
	props: { model }
})
