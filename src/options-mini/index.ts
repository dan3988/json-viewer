import Popup from "./Popup.svelte";
import { WritableStore, WritableStoreImpl } from "../store";

async function watch<T extends Dict>(defaults: T): Promise<{ [P in keyof T]: WritableStore<T[P]> }> {
	const values = await chrome.storage.local.get(defaults);
	const stores: any = {};
	for (const [key, value] of Object.entries(values)) {
		const store = new WritableStoreImpl(value);
		store.listen(v => chrome.storage.local.set({ [key]: v }));
		stores[key] = store;
	}

	return stores;
}

//const { scheme, darkMode, enabled, customSchemes } = await watch('scheme', 'darkMode', 'enabled', 'customSchemes');
const { scheme, darkMode, enabled, customSchemes } = await watch({
	scheme: 'default',
	darkMode: <boolean | null>null,
	enabled: true,
	customSchemes: {},
});

new Popup({
	target: document.body,
	props: {
		scheme,
		darkMode,
		enabled,
		customSchemes
	}
});
