import type { Invalidator, Readable, Subscriber, Unsubscriber } from "svelte/store";
import type { DocumentRequestInfo } from "./types.js";
import { EditAction, EditStack } from "./edit-stack.js";
import { EventHandlers } from "./evt.js";
import { StateController } from "./state.js";
import Linq from "@daniel.pickett/linq-js";
import json from "./json.js";
import JsonPath from "./json-path.js";
import { StoreListeners } from "./store.js";

export interface SelectedNodeList extends Iterable<json.Node>, ReadonlySetLike<json.Node>, Readable<SelectedNodeList> {
	readonly last: null | json.Node;
	reset(values: json.Node[]): void;
	reset(value: json.Node, fromLast?: boolean): void;
	add(value: json.Node, fromLast?: boolean): void;
	remove(value: json.Node): void;
	toggle(value: json.Node, selected?: boolean): boolean;
	clear(): void;
	forEach(callback: (v: json.Node) => void): void;
	map<V>(mapper: (node: json.Node) => V): V[];
}

interface ChangeProps {
	requestInfo: undefined | null | DocumentRequestInfo
	useWebRequest: boolean;
	formatIndent: string;
}

export interface ViewerCommands {
	focusSearch: [];
	saveAs: [];
	scrollTo: [node: json.Node];
	rename: [node: json.Node];
}

export type ViewerCommandHandler<T = ViewerModel> = Fn<[evt: ViewerCommandEvent], void, T>;

export type ViewerCommandEvent = { [P in keyof ViewerCommands]: { command: P, args: ViewerCommands[P] } }[keyof ViewerCommands];

function serializeForCopy(node: json.Node, indent: undefined | string, escapeValues?: boolean) {
	if (!escapeValues && node.isValue()) {
		return String(node.value);
	} else {
		return JSON.stringify(node, undefined, indent);
	}
}

type PathInit = string | JsonPath | readonly JsonPath.Segment[];

export class ViewerModel {
	readonly #root: json.Node;
	readonly #state: StateController<ChangeProps>;
	readonly #command: EventHandlers<this, [evt: ViewerCommandEvent]>;
	readonly #selected = new _SelectedNodeList;
	readonly #edits: EditStack;

	get root() {
		return this.#root;
	}

	get selected() {
		return this.#selected;
	}

	get state() {
		return this.#state.state;
	}

	get requestInfo() {
		return this.#state.getValue("requestInfo");
	}

	set requestInfo(v) {
		this.#state.setValue("requestInfo", v);
	}

	get formatIndent() {
		return this.#state.getValue("formatIndent");
	}

	set formatIndent(v) {
		this.#state.setValue("formatIndent", v);
	}

	get useWebRequest() {
		return this.#state.getValue("useWebRequest");
	}

	set useWebRequest(v) {
		this.#state.setValue("useWebRequest", v);
	}

	get command() {
		return this.#command.event;
	}

	get edits() {
		return this.#edits;
	}

	constructor(root: json.Node) {
		this.#root = root;
		this.#state = new StateController<ChangeProps>({
			requestInfo: undefined,
			useWebRequest: false,
			formatIndent: ""
		});

		this.#command = new EventHandlers();
		this.#edits = new EditStack();
		this.#edits.onCommit.addListener(this.#onCommit.bind(this));
		this.#edits.onRevert.addListener(this.#onRevert.bind(this));
	}

	#onCommit({ commitTarget: t }: EditAction) {
		t && this.setSelected(t, false, true);
	}

	#onRevert({ revertTarget: t }: EditAction) {
		t && this.setSelected(t, false, true);
	}

	execute<K extends keyof ViewerCommands>(command: K, ...args: ViewerCommands[K]) {
		const handlers = this.#command;
		if (handlers.hasListeners)
			handlers.fire(this, <any>{ command, args });
	}

	formatValue(node: json.Node, minify?: boolean, escapeValues?: boolean) {
		const indent = minify ? undefined : this.formatIndent;
		return serializeForCopy(node, indent, escapeValues);
	}
	
	formatValues(values: Iterable<json.Node>, minify?: boolean) {
		const indent = minify ? undefined : this.formatIndent;
		return Linq(values)
			.select(p => serializeForCopy(p, indent, true))
			.joinText(minify ? "," : ",\r\n");
	}

	resolve(path: PathInit): json.Node | undefined {
		let segments: readonly JsonPath.Segment[];
		if (typeof path === 'string') {
			({ segments } = JsonPath.parse(path));
		} else if ('length' in path) {
			segments = path;
		} else {
			({ segments } = path);
		}

		let i = 0;
		let baseProp: json.Node;
		if (segments[0] !== "$") {
			const selected = this.#selected.last;
			if (selected == null)
				return;

			baseProp = selected;
		} else if (segments.length === 1) {
			return this.#root;
		} else {
			i++;
			baseProp = this.#root;
		}
	
		for (let curr = baseProp; curr.isContainer(); ) {
			const key = segments[i];
			const child = curr.get(key);
			if (child == null)
				break;

			if (++i === segments.length)
				return child;

			curr = child;
		}
	}

	select(path: string | readonly (number | string)[]) {
		const node = this.resolve(path);
		if (node == null)
			return false;

		this.#selected.add(node);
	}

	#onSelected(selected: json.Node, expand: boolean, scrollTo: boolean) {
		if (expand)
			for (let p: null | json.Node = selected; p != null; p = p.parent)
				if (p.isContainer())
					p.isExpanded = true;

		if (scrollTo)
			this.execute("scrollTo", selected);
	}

	setSelected(selected: json.Node, expand: boolean, scrollTo: boolean) {
		this.#selected.reset(selected);
		this.#onSelected(selected, expand ?? false, scrollTo ?? false);
	}
}

export default ViewerModel;

class _SelectedNodeList implements SelectedNodeList {
	readonly #listeners = new StoreListeners<SelectedNodeList>;
	#list: json.Node[] = [];
	#set = new Set<json.Node>;

	get size() {
		return this.#set.size;
	}

	get last() {
		return this.#list.at(-1) ?? null;
	}

	constructor() {
	}

	subscribe(run: Subscriber<SelectedNodeList>, invalidate?: Invalidator<SelectedNodeList> | undefined): Unsubscriber {
		const unsub = this.#listeners.listen(run, invalidate);
		run(this);
		return unsub;
	}

	[Symbol.iterator]() {
		return this.#set[Symbol.iterator]();
	}

	keys() {
		return this.#set[Symbol.iterator]();
	}

	has(value: json.Node): boolean {
		return this.#set.has(value);
	}

	map<V>(mapper: (node: json.Node) => V): V[] {
		return this.#list.map(mapper);
	}

	forEach(callback: (v: json.Node) => void) {
		this.#list.forEach(callback, this);
	}

	clear(): void {
		if (this.#set.size) {
			this.#set.clear();
			this.#list.length = 0;
			this.#listeners.fire(this);
		}
	}

	reset(values: json.Node[]): void;
	reset(value: json.Node, fromLast?: boolean): void;
	reset(value: json.Node | json.Node[], fromLast?: boolean): void {
		let list = this.#list;
		let selected: Set<json.Node>;

		if (Array.isArray(value)) {
			list = [...value];
			selected = new Set(value);
		} else if (fromLast && list.length) {
			const last = list.at(-1)!;
			const props = getNodesBetween(last, value).toArray();
			list = props;
			list.push(last);
			selected = new Set(props);
			selected.add(last);
		} else {
			list = [value];
			selected = new Set();
			selected.add(value);
		}

		this.#set = selected;
		this.#list = list;
		this.#listeners.fire(this);
	}

	add(value: json.Node, fromLast?: boolean) {
		let changed = 0;
		let set = this.#set;
		let list = this.#list;

		if (fromLast && list.length) {
			const last = list.at(-1)!;
			for (const node of getNodesBetween(last, value)) {
				if (set.has(node))
					continue;

				set.add(node);
				list.push(node);
				changed++;
			}
		} else if (!set.has(value)) {
			set.add(value);
			list.push(value);
			changed++;
		}

		if (changed)
			this.#listeners.fire(this);
	}

	remove(node: json.Node): void {
		if (!this.#set.delete(node))
			return;

		const i = this.#list.indexOf(node);
		if (i >= 0)
			this.#list.splice(i, 1);

		this.#listeners.fire(this);
	}

	toggle(node: json.Node, selected?: boolean) {
		const currentlySelected = this.#set.has(node);
		if (selected == null || selected != currentlySelected) {
			selected ??= !currentlySelected;

			if (selected) {
				this.add(node);
			} else {
				this.remove(node);
			}
		}

		return selected;
	}
}

function * getAllParents(node: json.Node) {
	let p: null | json.Node = node;
	while (true) {
		if ((p = p.parent) == null)
			break;

		yield p;
	}
}

/**
 * Checks if a property follows or preceeds another. This function assumes that both properties have the same parent
 * @param origin The beginning property
 * @param other The property to look for
 * @param ifTrue The value to return if the property appears after the origin
 * @param ifFalse The value to return if the property appears before the origin
 */
function isFollowing<const V>(origin: json.Node, other: json.Node, ifTrue: V, ifFalse: V): V;
function isFollowing(origin: json.Node, other: json.Node): boolean;
function isFollowing(origin: json.Node, other: json.Node, ifTrue: any = true, ifFalse: any = false): any {
	let p: null | json.Node = origin;
	while (true) {
		if ((p = p.next) == null)
			return ifFalse;

		if (p === other)
			return ifTrue;
	}
}

function getSharedParentIndex(a: json.Node[], b: json.Node[]): number {
	let result = -1;

	for (let i = 0, l = Math.min(a.length, b.length); i < l; i++) {
		const x = a[i];
		const y = b[i];

		if (x !== y)
			break;

		result = i;
	}

	return result;
}

/**
 * Iterate the properties between 2 given properties.
 * @param origin
 * @param other
 */
 function * getNodesBetween(origin: json.Node, other: json.Node) {
	if (origin === other)
		return;

	//if the properties have the same parent, we can just yield the properties between the two and return.
	if (origin.parent == other.parent) {
		const key = isFollowing(origin, other, "next", "previous");
		let p = origin;
		do {
			yield p = p[key]!;
		} while (p !== other)

		return;
	}

	const originParents = [...getAllParents(origin)].reverse();
	const otherParents = [...getAllParents(other)].reverse();

	let sharedParentIndex = getSharedParentIndex(originParents, otherParents);
	if (sharedParentIndex < 0)
		return;

	originParents.push(origin);
	otherParents.push(other);
	sharedParentIndex++;

	const originParent = originParents[sharedParentIndex];
	const otherParent = otherParents[sharedParentIndex];
	const [begin, moveNext] = isFollowing(originParent, otherParent, ["first", "next"], ["last", "previous"]);

	//for each parent between the origin and the shared parent, yield all properties until the start / end of the container
	for (let i = originParents.length; ; ) {
		let p = originParents[--i];
		yield p;
		if (i === sharedParentIndex)
			break;

		while (true) {
			if ((p = p[moveNext]!) == null)
				break;

			yield p;
		}
	}

	//now do the opposite, yield all properties from the start / end of each container from the shared parent to the target property
	let p = originParent;
	while (true) {
		let target = otherParents[sharedParentIndex];
		if (p !== target) {
			while (true) {
				let sibling = p[moveNext];
				if (sibling == null)
					return;

				yield (p = sibling);

				if (p === target)
					break;
			}
		}

		if (++sharedParentIndex === otherParents.length)
			break;

		yield p = target[begin]!;
	}
}