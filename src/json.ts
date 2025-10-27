import { EventHandlers, type IEvent } from "./evt";
import Linq from "@daniel.pickett/linq-js";
import JsonPath from "./json-path";
import Store from "./store";
import ArrayLikeProxy, { type ReadOnlyArrayLike, type ReadOnlyArrayLikeProxyHandler } from "./array-like-proxy";
import debug from "./debug";

let id = 0;

const unproxyKey = Symbol("json.unproxy");
const emptyIterator: IterableIterator<never> = Linq.empty()[Symbol.iterator]();

export function json(value: any): Node {
	if (value === null) {
		return new JValue(null, 'null');
	}

	if (Array.isArray(value)) {
		return new JArray(value);
	}

	const t = typeof value;
	switch (t) {
		case 'object':
			return new JObject(value);
		case 'string':
		case 'number':
		case 'boolean':
			return new JValue(value, t);
		default:
			throw new TypeError('JSON value cannot be of type "' + t + '"');
	}
}

abstract class Node<C extends json.Key = json.Key> implements json.Node<C> {
	readonly id = ++id;

	parent: JContainer<any> | null = null;
	key: json.Key | null = null;
	next: Node | null = null;
	previous: Node | null = null;

	#path: JsonPath | null = null;
	get path() {
		if (this.parent == null) {
			return JsonPath.root;
		}

		if (this.#path == null) {
			const p: json.Key[] = [];
			this.#buildPath(p);
			this.#path = new JsonPath(p);
		}

		return this.#path;
	}

	abstract get isExpandedStore(): Store<boolean>;
	abstract get isExpanded(): boolean;

	abstract get type(): json.NodeType;
	abstract get subtype(): json.NodeSubType;
	abstract get value(): any;

	abstract get first(): null | Node;
	abstract get last(): null | Node;
	abstract get count(): number;

	abstract getKeys(): IterableIterator<C>;
	abstract get(key: C): Node | null;

	abstract [Symbol.iterator](): IterableIterator<Node>;

	abstract clone(): Node<C>;
	abstract toRaw(): any;

	abstract equals(other: json.Node): boolean;

	toJSON() {
		return this.value;
	}

	abstract setExpanded(expanded: boolean, recursive?: boolean): void;
	abstract toggleExpanded(): undefined | boolean;

	toString(indent?: string): string {
		return JSON.stringify(this, undefined, indent);
	}

	/** @internal */
	_removed() {
		this.key = null;
		this.parent = null;
		this.next = null;
		this.previous = null;
		this.#path = null;
	}

	/** @internal */
	_setParent<K extends json.Key>(parent: JContainer<K>, key: K) {
		this.parent = parent;
		this.key = key;
	}

	/** @internal */
	_setNext(node: null | Node): null | Node {
		const r = this.next;
		this.next = node;
		node && (node.previous = this);
		return r;
	}

	/** @internal */
	_setPrevious(node: null | Node): null | Node {
		const r = this.previous;
		this.previous = node;
		node && (node.next = this);
		return r;
	}

	remove(): boolean {
		const { parent } = this;
		if (!parent)
			return false;

		parent._remove(this);
		parent._fireChanged();
		return true;
	}

	replace(node: Node): boolean {
		const { parent } = this;
		if (!parent)
			return false;

		node = parent._takeOwnership(node, this.key);
		parent._replaced(node, this);
		parent._fireChanged();
		return true;
	}

	isContainer(): this is json.Container {
		return false;
	}

	isObject(): this is json.Object {
		return false;
	}

	isArray(): this is json.Array {
		return false;
	}

	isValue(): this is json.Value {
		return false;
	}

	#buildPath(p: json.Key[]) {
		if (this.parent) {
			this.parent.#buildPath(p);
			p.push(this.key as json.Key);
		} else {
			p.push('$');
		}
	}
}

const nodeClass = Node;

abstract class JContainer<C extends json.Key = json.Key> extends Node<C> implements json.Container<C> {
	readonly #onChanged = new EventHandlers<any, []>();
	readonly #isExpanded = Store.controller(false);

	readonly type = 'container';

	get onChanged() {
		return this.#onChanged.event;
	}

	get isExpandedStore() {
		return this.#isExpanded.store;
	}

	get isExpanded() {
		return this.#isExpanded.value;
	}

	set isExpanded(value) {
		this.#isExpanded.value = value;
	}

	abstract get subtype(): json.ContainerType;

	first: null | Node = null;
	last: null | Node = null;

	abstract clone(): JContainer<C>;
	abstract removeAll(): boolean;

	/** @internal */
	_takeOwnership(node: json.Node, key: C): Node {
		let n = node as Node;
		if (n.parent)
			n = n.clone();
	
		n._setParent(this, key);
		return n;
	}

	_remove(child: Node): void {
		if (child.parent !== this)
			throw new TypeError('child does not belong to this node.');

		const key = child.key as C;
		if (child.previous) {
			child.previous._setNext(child.next);
		} else {
			this.first = child.next;
		}

		if (child.next) {
			child.next._setPrevious(child.previous);
		} else {
			this.last = child.next;
		}

		child._removed();
		this._delete(key);
	}

	abstract _delete(key: C): void;

	/** @internal */
	_fireChanged() {
		this.#onChanged.fire(this);
	}

	protected _appended(child: Node, before?: Node): void {
		if (before) {
			const last = before._setPrevious(child);
			if (last) {
				last._setNext(child);
			} else {
				this.first = child;
			}
		} else {
			if (this.last) {
				this.last._setNext(child);
			} else {
				this.first = child;
			}

			this.last = child;
		}
	}

	/** @internal */
	_replaced(child: Node, existing: Node) {
		const { next, previous } = existing;
		if (previous) {
			previous._setNext(child);
		} else {
			this.first = child;
		}

		if (next) {
			next._setPrevious(child);
		} else {
			this.last = child;
		}

		existing._removed();
	}

	toggleExpanded(): boolean {
		const store = this.#isExpanded;
		return store.value = !store.value;
	}

	setExpanded(expanded: boolean, recursive?: boolean) {
		this.#isExpanded.value = expanded;
		if (!recursive)
			return;

		const stack: Iterator<Node>[] = [];
		let cur: Iterator<Node> = this[Symbol.iterator]()
		while (true) {
			let r = cur.next();
			if (r.done) {
				let last = stack.pop();
				if (last == null)
					return;

				cur = last;
			} else if (r.value.isContainer()) {
				r.value.isExpanded = expanded && r.value.count > 0;
				const it = r.value[Symbol.iterator]();
				stack.push(it);
			}
		}
	}

	getKeys(): IterableIterator<C> {
		return new NodeIterator(this, 0);
	}

	[Symbol.iterator](): IterableIterator<Node> {
		return new NodeIterator(this, 1);
	}

	protected abstract _sameType(other: json.Node): other is JContainer;

	equals(other: json.Node): boolean {
		if (this === other)
			return true;

		if (this.subtype !== other.subtype)
			return false;

		if (!this._sameType(other))
			return false;

		const x = new NodeIterator(this, 1);
		const y = new NodeIterator(other, 1);
		
		while (true) {
			const xr = x.next();
			const yr = y.next();
			if (xr.done || yr.done)
				break;

			if (xr.value.key !== yr.value.key)
				return false;

			if (!xr.value.equals(yr.value))
				return false;
		}

		return true;
	}

	isContainer(): this is json.Container<C> {
		return true;
	}
}

class JObject extends JContainer<string> implements json.Object {
	static readonly #proxyHandler: ProxyHandler<JObject> = {
		has(target, p) {
			return typeof p === "string" ? target.#map.has(p) : p === Symbol.toPrimitive;
		},
		ownKeys(target) {
			const keys: (string | symbol)[] = [...target.getKeys()];
			keys.push(Symbol.toPrimitive);
			return keys;
		},
		getOwnPropertyDescriptor(target, p) {
			const value = target.#reflectGet(p, true);
			if (value === undefined)
				return;

			return {
				configurable: true,
				enumerable: value[1],
				value: value[0]
			}
		},
		getPrototypeOf() {
			return Object.prototype;
		},
		get(target, p) {
			return p === unproxyKey ? target : target.#reflectGet(p);
		},
		defineProperty() {
			return false;
		},
		isExtensible() {
			return false;
		},
	}

	readonly #map = new Map<string, Node>();

	readonly subtype = "object";
	readonly value: ReadOnlyDict;

	get count() {
		return this.#map.size;
	}

	constructor(value?: Dict) {
		super();
		this.value = new Proxy(this, JObject.#proxyHandler);

		if (value)
			this.#setAll(Linq.fromObject(value).select(([key, value]) => [key, json(value)] as const));
	}

	#reflectGet(key: string | symbol, wrap: true): undefined | [value: any, enumerable: boolean]
	#reflectGet(key: string | symbol, wrap?: false): any 
	#reflectGet(key: string | symbol, wrap?: boolean): any {
		if (typeof key === "string") {
			const cont = this.#map.get(key);
			if (cont == null)
				return undefined;

			return wrap ? [cont.value, true] : cont.value;
		} else if (key === Symbol.toPrimitive) {
			return wrap ? [Object.prototype.toString, false] : Object.prototype.toString;
		}
	}

	setAll(nodes: Iterable<[string, json.Node]>) {
		this.#setAll(nodes) && this._fireChanged();
	}

	#setAll(nodes: Iterable<[string, json.Node]>): boolean {
		const map = this.#map;
		const oldLength = map.size;
		this.#removeAll();

		const it = nodes[Symbol.iterator]();
		let r = it.next();
		if (!r.done) {
			let key = r.value[0];
			let node = this._takeOwnership(r.value[1], key);

			this.first = node;

			while (true) {
				map.set(key, node);

				if ((r = it.next()).done)
					break;

				key = r.value[0];
				const next = this._takeOwnership(r.value[1], key);
				node._setNext(next);
				node = next;
			}

			this.last = node;
		}

		// list was empty before and after change
		return !!(oldLength + map.size);
	}

	#removeAll(): boolean {
		if (this.#map.size === 0)
			return false;

		for (const child of this.#map.values())
			child._removed();

		this.#map.clear();
		this.first = null;
		this.last = null;
		this._fireChanged();
		return true;
	}

	removeAll(): boolean {
		const changed = this.#removeAll();
		changed && this._fireChanged();
		return changed;
	}

	protected _sameType(other: json.Node): other is JObject {
		return other.isObject();
	}

	_delete(key: string): void {
		this.#map.delete(key);
	}

	toMap(): Map<string, json.Node> {
		return new Map(this.#map);
	}

	toRaw(): Dict {
		const result: Dict = {};
		for (const node of this)
			result[node.key!] = node.toRaw();

		return result;
	}

	clone(): JObject {
		const clone = new JObject();
		clone.#setAll(this.#map.entries());
		return clone;
	}

	isObject(): this is JObject {
		return true;
	}

	get(key: string): Node | null {
		return this.#map.get(key) ?? null;
	}

	set(key: string, node: Node): void {
		node = this._takeOwnership(node, key);
		const existing = this.#map.get(key);
		if (existing) {
			this._replaced(node, existing);
		} else {
			this._appended(node);
		}

		this.#map.set(key, node);
		this._fireChanged();
	}

	sort(compare?: (a: string, b: string) => number): void {
		if (!this.#map.size) 
			return;

		const keys = [...this.#map.keys()].sort(compare);
		let node = this.#map.get(keys[0])!;
		node.previous = null;
		this.first = node;

		for (let i = 1; i < keys.length; i++) {
			const next = this.#map.get(keys[i])!;
			node._setNext(next);
			node = next;
		}

		node.next = null;
		this.last = node;
		this._fireChanged();
	}

	rename(from: string, to: string): boolean {
		const current = this.#map.get(from);
		if (!current)
			return false;

		const existing = this.#map.get(to);
		if (existing) {
			this._remove(existing);
		}

		current.key = to;
		this.#map.delete(from);
		this.#map.set(to, current);
		this._fireChanged();
		return true;
	}

	insertBefore(key: string, node: Node, sibling?: Node) {
		this.#insert(key, node, sibling, false);
	}

	insertAfter(key: string, node: Node, sibling?: Node) {
		this.#insert(key, node, sibling, true);
	}

	#insert(key: string, node: Node, sibling: undefined | null | Node, after: boolean) {
		const [start, setNext, setPrev] = after 
			? ['last', '_setNext', '_setPrevious'] as const
			: ['first', '_setPrevious', '_setNext'] as const;

		if (sibling) {
			if (sibling === node)
				throw new TypeError("Property cannot be a sibling of itself.");

			if (sibling.parent !== this)
				throw new TypeError("Sibling poperty must be a child of this container.");
		} else if (!(sibling = this[start])) {
			node = this._takeOwnership(node, key);
			this.first = node;
			this.last = node;
			this.#map.set(key, node);
			this._fireChanged();
			return;
		}

		node = this._takeOwnership(node, key);

		if (key === sibling.key) {
			this.#map.set(key, node);
			this._replaced(node, sibling);
			this._fireChanged();
			return;
		}

		const existing = this.#map.get(key);
		if (existing) {
			this._remove(existing);
		}

		this.#map.set(key, node);
		const next = sibling[setNext](node);
		if (next) {
			next[setPrev](node);
		} else {
			this[start] = node;
		}

		this._fireChanged();
	}
}

class JArray extends JContainer<number> implements json.Array {
	static readonly #proxyHandler: ReadOnlyArrayLikeProxyHandler<JArray, any> = {
		getAt(self, index) {
			return self.#list[index].value;
		},
		getLength(self) {
			return self.#list.length;
		},
		getIterator(self) {
			return self.#proxyIterator;
		},
		getters: {
			[unproxyKey]: (self) => self,
		}
	}

	readonly #list: Node[] = [];

	readonly subtype = "array";
	readonly value: ReadOnlyArrayLike<any>;

	get count() {
		return this.#list.length;
	}

	constructor(value?: any[]) {
		super();
		this.value = new ArrayLikeProxy(this, JArray.#proxyHandler);
		this.value[Symbol.iterator]();

		if (value && value.length)
			this.#setAll(value.map(json));
	}

	*#proxyIterator() {
		for (const child in this)
			yield child;
	}

	setAll(nodes: Iterable<Node>) {
		this.#setAll(nodes) && this._fireChanged();
	}

	#setAll(nodes: Iterable<Node>): boolean {
		const list = this.#list;
		const oldLength = list.length;
		this.#removeAll();

		const it = nodes[Symbol.iterator]();
		let r = it.next();
		if (!r.done) {
			let node = this._takeOwnership(r.value, 0);
			let i = 0;

			this.first = node;

			while (true) {
				list.push(node);

				if ((r = it.next()).done)
					break;

				const next = this._takeOwnership(r.value, ++i);
				node._setNext(next);
				node = next;
			}

			this.last = node;
		}

		// list was empty before and after change
		return !!(oldLength + list.length);
	}

	#removeAll(): boolean {
		if (this.#list.length === 0)
			return false;

		for (const child of this.#list)
			child._removed();

		this.#list.length = 0;
		this.first = null;
		this.last = null;
		return true;
	}

	protected _sameType(other: json.Node): other is JArray {
		return other.isArray();
	}

	_delete(key: number): void {
		const list = this.#list;
		list.splice(key, 1);
		for (; key < list.length; key++)
			list[key].key = key;
	}

	removeAll(): boolean {
		const changed = this.#removeAll();
		changed && this._fireChanged();
		return changed;
	}

	toArray(): json.Node[] {
		return [...this.#list];
	}

	toRaw() {
		const result: any[] = []
		for (const node of this.#list)
			result.push(node.toRaw());

		return result;
	}

	clone(): JArray {
		const clone = new JArray();
		clone.#setAll(this.#list);
		return clone;
	}

	isArray(): this is JArray {
		return true;
	}

	get(key: number): Node | null {
		return this.#list[key];
	}

	/**
	 * Append a property and add null properties between the last property in this array and the index of the given property
	 */
	#addWithGap(end: number, node: Node) {
		const items = this.#list;
		let last = this.last;
		let i = items.length;

		if (!last) {
			last = new JValue(null, 'null');
			last._setParent(this, i);
			this.first = last;
			i++;
		}

		for (; i < end; i++) {
			const gap = new JValue(null, 'null');
			items.push(gap);
			gap._setParent(this, i);
			gap._setPrevious(last);
			last = gap;
		}

		node._setPrevious(last);
		items.push(node);
		this.last = node;
		//this.#changed.fire(this, "addedRange", range);
	}
	
	add(node: Node, index?: number): void {
		if (index! < 0)
			throw new TypeError("Index must be greater than or equal to 0");

		const items = this.#list;
		index ??= items.length;
		node = this._takeOwnership(node, index);

		if (index <= items.length) {
			const next = items[index];
			items.splice(index, 0, node);
			this._appended(node, next);

			while (++index < items.length)
				items[index].key = index;
		} else if (index) {
			this.#addWithGap(index, node);
		}

		this._fireChanged();
	}
}

type ValueChangedEventArg = [oldValue: json.ValueType, newValue: json.ValueType];

const falseStore = Store.const(false);

class JValue extends Node<never> implements json.Value {
	readonly #onChanged = new EventHandlers<this, ValueChangedEventArg>();
	#value: json.ValueType;
	#valueType: json.ValueTypeOf;

	readonly type = 'value';

	get isExpandedStore() {
		return falseStore;
	}

	get isExpanded() {
		return false;
	}

	get onChanged() {
		return this.#onChanged.event;
	}

	get subtype() {
		return this.#valueType;
	}

	get value() {
		return this.#value;
	}

	set value(value) {
		const oldValue = this.#value;
		if (oldValue !== value) {
			if (value === null) {
				this.#value = null;
				this.#valueType = "null";
			} else {
				const t = typeof value;
				if (t === "string" || t === "number" || t === "boolean") {
					this.#value = value;
					this.#valueType = t;
				} else {
					throw new TypeError('JSON value cannot be of type "' + t + '"');
				}
			}

			this.#onChanged.fire(this, oldValue, value);
		}
	}

	get count() {
		return 0;
	}

	get first() {
		return null;
	}

	get last() {
		return null;
	}

	constructor(value: json.ValueType, valueType?: json.ValueTypeOf) {
		super();
		this.#value = value;
		this.#valueType = valueType ?? (value === null ? 'null' : <any>typeof value);
	}

	equals(other: json.Node): boolean {
		return other.isValue() && this.#value === other.value;
	}

	setExpanded(): void {
	}

	toggleExpanded(): undefined {
		return undefined;
	}

	getKeys(): IterableIterator<never> {
		return emptyIterator;
	}

	[Symbol.iterator](): IterableIterator<never> {
		return emptyIterator;
	}

	get(): null {
		return null;
	}

	isValue(): this is JValue {
		return true;
	}

	toRaw() {
		return this.#value;
	}

	clone(): JValue {
		return new JValue(this.#value, this.#valueType);
	}
}

type NodeIteratorRow<P extends json.Key> = readonly [key: P, node: Node];

class NodeIterator<P extends json.Key, K extends keyof NodeIteratorRow<P>> implements IterableIterator<NodeIteratorRow<P>[K]> {
	readonly #returns: K;
	readonly #container: JContainer<P>;
	#current: null | Node;

	constructor(container: JContainer<P>, returns: K) {
		this.#returns = returns;
		this.#container = container;
		this.#current = null;
	}

	next(): IteratorResult<NodeIteratorRow<P>[K]> {
		let next: null | Node
		if (this.#current == null) {
			next = this.#container.first;
		} else {
			next = this.#current.next;
		}

		this.#current = next;
		if (next == null) {
			return { done: true, value: undefined };
		} else {
			const value = ([next.key as P, next] as const)[this.#returns];
			return { value };
		}
	}

	[Symbol.iterator](): this {
		return this;
	}
}

export namespace json {
	export function unproxy(value: any): Node | undefined {
		return Reflect.get(value, unproxyKey);
	}

	export interface ValueMap {
		'string': string;
		'number': number;
		'boolean': boolean;
		'null': null;
	}

	export interface NodeTypeMap {
		'container': ContainerType;
		'value': ValueTypeOf;
	}

	export type NodeType = keyof NodeTypeMap;
	export type NodeSubType = NodeTypeMap[NodeType];
	
	export type ContainerType = 'array' | 'object';

	export type ValueTypeOf = keyof ValueMap;
	export type ValueType = ValueMap[ValueTypeOf];

	export type Key = string | number;

	interface NodeConstructor extends Function {
		readonly prototype: Node;
	}

	export const Node: NodeConstructor = nodeClass;

	export interface Node<C extends Key = Key> extends Iterable<Node> {
		readonly id: number;
		readonly key: Key | null;
		readonly path: JsonPath;
		readonly parent: Container | null;
		readonly next: Node | null;
		readonly previous: Node | null;
		readonly first: Node | null;
		readonly last: Node | null;
		readonly count: number;
		readonly type: NodeType;
		readonly subtype: NodeSubType;
		readonly value: unknown;

		readonly isExpandedStore: Store<boolean>;
		readonly isExpanded: boolean;

		toggleExpanded(): undefined | boolean;
		setExpanded(expanded: boolean, recursive?: boolean): void;

		isContainer(): this is Container;
		isObject(): this is Object;
		isArray(): this is Array;
		isValue(): this is Value;

		toRaw(): any;
		toJSON(): any;
		toString(indent?: string): string;

		getKeys(): IterableIterator<C>;
		get(key: C): Node | null;

		remove(): boolean;
		replace(node: Node): boolean;

		clone(): Node<C>;

		equals(other: Node): boolean;
	}

	interface ValueConstructor extends NodeConstructor {
		readonly prototype: Value;
		new(value: ValueType): Value;
	}

	export const Value: ValueConstructor = JValue;

	export interface Value extends Node<never> {
		readonly onChanged: IEvent<this, ValueChangedEventArg>;
		value: ValueType;
		readonly type: 'value';
		readonly subtype: ValueTypeOf;

		toggleExpanded(): undefined;

		toRaw(): ValueType;
		toJSON(): ValueType;
		clone(): Value;

		get(): null;
	}

	interface ContainerConstructor extends NodeConstructor {
		readonly prototype: Container;
	}

	export const Container: ContainerConstructor = JContainer;

	export interface Container<C extends Key = Key> extends Node<C> {
		readonly onChanged: IEvent<this, []>;
		readonly type: 'container';
		readonly subtype: ContainerType;
		isExpanded: boolean;

		toggleExpanded(): boolean;

		clone(): Container<C>;
		removeAll(): boolean;
	}

	interface ObjectConstructor extends ContainerConstructor {
		readonly prototype: Object;
		new(value?: Dict): Object;
	}

	export const Object: ObjectConstructor = JObject;

	export interface Object extends Container<string> {
		readonly subtype: 'object';
		readonly value: ReadOnlyDict;

		toMap(): Map<string, Node>;
		toRaw(): Dict;
		toJSON(): ReadOnlyDict;
		clone(): Object;

		setAll(nodes: ReadonlyMap<string, Node>): void;
		sort(compare?: (a: string, b: string) => number): void;
		rename(from: string, to: string): boolean;
		set(key: string, node: Node): void;
		insertAfter(key: string, node: Node, sibling?: null | Node): void;
		insertBefore(key: string, node: Node, sibling?: null | Node): void;
	}

	interface ArrayConstructor extends ContainerConstructor {
		readonly prototype: Array;
		new(value?: any[]): Array;
	}

	export const Array: ArrayConstructor = JArray;

	export interface Array extends Container<number> {
		readonly subtype: 'array';
		readonly value: ReadOnlyArrayLike<any>;

		toArray(): Node[];
		toRaw(): any[];
		toJSON(): ReadOnlyArrayLike<any>;
		clone(): Array;

		setAll(nodes: Iterable<Node>): void;
		add(node: Node, index?: number): void;
	}
}

export default json;

const colors = {
	type: '#9AD9FE',
	string: '#CE9278',
	number: '#B3CDA7',
	boolean: '#5799D6',
	object: '#5799D6',
}

function renderType(obj: any) {
	return debug.text(obj.constructor.name).color(colors.type);
}

function renderJson(value: any) {
	const color = (colors as any)[typeof value];
	const text = JSON.stringify(value);
	return debug.text(text).color(color);
}

class NodeRenderer extends debug.ClassRenderer<Node> {
	constructor() {
		super(Node);
	}

	header(obj: Node): debug.Component {
		const text = debug.text`${renderType(obj)}(`;

		if (obj.isValue()) {
			text.add(renderJson(obj.value));
		} else {
			text.add(debug.text(obj.count).color(colors.number));
		}

		return text.add`)`;
	}

	hasBody(): boolean {
		return true;
	}

	body(obj: Node): debug.Component {
		const list = debug.list();

		const meta = Object.create(null);
		meta.path = obj.path.toString();

		for (const key of ['key', 'parent', 'next', 'previous'] as const)
			meta[key] = obj[key];

		list.addRow`meta: ${debug.object(meta)}`;

		for (const child of obj)
			list.addRow`${renderJson(child.key)}: ${debug.object(child)}`;

		return list;
	}
}

debug.register(new NodeRenderer);
