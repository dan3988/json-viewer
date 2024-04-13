import preferences from "../preferences-lite.js";
import ThemeTracker from "../theme-tracker";
import Settings from "./Settings.svelte";
import EditorModel from "./editor.js";

const tracker = new ThemeTracker(document.documentElement);
const bag = await preferences.lite.manager.get();
const model = new EditorModel(bag);

new Settings({
	target: document.body,
	props: {
		model,
		tracker
	}
});