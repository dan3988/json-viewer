import { State } from "./state";

export default function toRune<T extends Dict>(store: State<T>): T;
export default function toRune<T extends Dict, K extends keyof T>(store: State<T>, ...keys: K[]): Pick<T, K>;
export default function toRune(store: State<any>, ...rest: string[]): any {
	const keys = rest.length ? rest : store.keys;
	const rune = $state<any>({});
	const unsubscribers: Action[] = [];
	for (const key of keys) {
		const property = store.props[key];
		const unsub = property.listen(v => rune[key] = v);
		rune[key] = property.value;
		unsubscribers.push(unsub);
	}

	return rune;
}