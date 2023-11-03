import { StateController, type State } from "./state.js";
import settings from "./settings.js";

const enum WatchTypes {
	None,
	Local = 1,
	Sync = 2,
	Both = 3
}

export async function settingsBag<const K extends (keyof settings.Settings)[]>(...settingNames: K): Promise<State<{ [P in K[number]]: settings.Settings[P] }>> {
	let watch = WatchTypes.None;
	
	for (const key of settingNames) {
		const s = settings.getSetting(key, true);
		watch |= s.synced ? WatchTypes.Sync : WatchTypes.Local;

		if (watch == WatchTypes.Both)
			break;
	}

	const values = await settings.get(...settingNames);
	const bag = new StateController(values);

	function handler(changes: Dict<chrome.storage.StorageChange>) {
		let count = 0;
		let values: any = {};

		for (const key in changes) {
			if (bag.keys.has(key)) {
				values[key] = changes[key].newValue;
				count++;
			}
		}

		if (count)
			bag.setValues(values);
	}

	if ((watch & WatchTypes.Local) != 0)
		chrome.storage.local.onChanged.addListener(handler);

	if ((watch & WatchTypes.Sync) != 0)
		chrome.storage.sync.onChanged.addListener(handler);

	return bag.state;
}

export default settingsBag;