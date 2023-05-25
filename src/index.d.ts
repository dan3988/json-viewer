declare type Fn<TArgs extends any[] = any[], TRet = any, TThis = any> = (this: TThis, ...args: TArgs) => TRet;
declare type Action = () => void;
declare interface Constructor<TValue, TArgs extends any[] = any[]> {
	readonly prototype: TValue;
	new(...args: TArgs): TValue;
}

declare type Dict<T = any> = Record<string, T>;

declare var JSON5: typeof import("json5");

declare interface Array<T> {
	at(index: number): undefined | T
}
