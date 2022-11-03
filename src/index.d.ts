declare type Fn<TArgs extends any[] = any[], TRet = any, TThis = void> = (this: TThis, ...args: TArgs) => TRet;
declare interface Constructor<TValue, TArgs extends any[] = any[]> {
	readonly prototype: TValue;
	new(...args: TArgs): TValue;
}

declare interface Array<T> {
	at(index: number): undefined | T
}