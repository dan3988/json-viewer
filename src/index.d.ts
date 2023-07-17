declare type Fn<TArgs extends any[] = any[], TRet = any, TThis = any> = (this: TThis, ...args: TArgs) => TRet;
declare type Action<T1 = never, T2 = never, T3 = never, T4 = never, T5 = never> = (...args: UntilNever<[T1, T2, T3, T4, T5]>) => void;
declare type Func<TResult, T1 = never, T2 = never, T3 = never, T4 = never, T5 = never> = (...args: UntilNever<[T1, T2, T3, T4, T5]>) => TResult;
declare interface Constructor<TValue, TArgs extends any[] = any[]> {
	readonly prototype: TValue;
	new(...args: TArgs): TValue;
}

type UntilNever<T extends any[], Prev extends any[] = []> = T extends [never, ...any[]] ? Prev : (T extends [infer Start, ...infer Rest] ? UntilNever<Rest, [...Prev, Start]> : Prev);

declare type Expand<T> = { [P in keyof T]: T[P] };

declare type Dict<T = any> = Record<string, T>;
declare type OneOrMany<T> = T | T[];

declare var JSON5: typeof import("json5");

declare interface Array<T> {
	at(index: number): undefined | T
}

declare namespace chrome {
	declare namespace runtime {
		declare interface BrowserInfo {
			name: string;
			vendor: string;
			version: string;
			buildID: string;
		}

		declare var getBrowserInfo: undefined | (() => Promise<BrowserInfo>);
	}
}

declare module "*.svelte" {
	export default import("svelte").SvelteComponentTyped;
}