import { mount } from "svelte";
import preferences from "../preferences-lite.js";
import Settings from "./Settings.svelte";
import EditorModel from "./editor.js";

const bag = await preferences.lite.manager.getEntries();
const model = new EditorModel(bag);

mount(Settings, {
	target: document.body,
	props: { model }
});