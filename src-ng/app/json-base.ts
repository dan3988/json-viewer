export interface JsonParentInfo {
	readonly root: IJsonContainer;
	readonly node: IJsonContainer;
	readonly prop: IJsonProperty;
}

export interface IJsonContainer<TKey extends number | string = number | string> extends IJsonToken {
	get(key: TKey): undefined | IJsonToken;
	getProp(key: TKey): undefined | IJsonProperty<TKey>;

	keys(): Iterable<TKey>;
	values(): Iterable<IJsonToken>;
	props(): Iterable<IJsonProperty<TKey>>;
}

export interface IJsonProperty<TKey extends number | string = number | string> {
	readonly key: TKey;
	readonly value: IJsonToken;
}

export type JsonTokenType = "object" | "array" | "string" | "number" | "boolean" | "null";

export interface IJsonToken {
	readonly parent: undefined | JsonParentInfo;
	readonly type: JsonTokenType;
}