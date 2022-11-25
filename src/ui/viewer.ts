import JsonViewer from "./JsonViewer.svelte";
import { JsonToken } from "./json"
import { ViewerModel } from "./viewer-model";

// @ts-ignore
const parse = typeof jsonic === "function" ? jsonic : JSON.parse;
const pre = document.querySelector("pre");
const json = parse(pre.innerText);
pre.remove();
const root = JsonToken.create(json);
const model = new ViewerModel(root);

new JsonViewer({
	target: document.body,
	props: { model }
})
