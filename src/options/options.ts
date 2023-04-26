import settings from "../settings";
import ThemeTracker from "../theme-tracker";
import Settings from "./Settings.svelte";
import EditorModel from "./editor";

const tracker = new ThemeTracker(document.documentElement);
const bag = await settings.get();
const model = new EditorModel(bag);
const themesUrl = chrome.runtime.getURL("/res/themes.json");
const indentStyles = await fetch(themesUrl).then(v => v.json());

new Settings({
	target: document.body,
	props: {
		model,
		tracker,
		indentStyles
	}
});