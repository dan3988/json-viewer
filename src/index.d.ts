declare type Fn<TArgs extends any[] = any[], TRet = any, TThis = any> = (this: TThis, ...args: TArgs) => TRet;
declare type Action<T1 = never, T2 = never, T3 = never, T4 = never, T5 = never> = (...args: UntilNever<[T1, T2, T3, T4, T5]>) => void;
declare type Func<TResult, T1 = never, T2 = never, T3 = never, T4 = never, T5 = never> = (...args: UntilNever<[T1, T2, T3, T4, T5]>) => TResult;
declare interface Constructor<TValue, TArgs extends any[] = any[]> {
	readonly prototype: TValue;
	new(...args: TArgs): TValue;
}

declare type Opt<T> = T | undefined | null;

declare type Falsy = false | undefined | null | 0 | 0n | '';

type UntilNever<T extends any[], Prev extends any[] = []> = T extends [never, ...any[]] ? Prev : (T extends [infer Start, ...infer Rest] ? UntilNever<Rest, [...Prev, Start]> : Prev);

declare type Expand<T> = { [P in keyof T]: T[P] };
declare type Except<T, P extends keyof T> = { [K in keyof T as K extends P ? never : K]: T[K] };

declare type Dict<T = any> = Record<string, T>;

declare type ReadOnlyDict<T = any> = Readonly<Dict<T>>;

declare type OneOrMany<T> = T | T[];

declare var JSON5: typeof import("json5");

declare interface OpenFilePickerOptions {
	startIn?: WellKnownDirectory;
}

declare interface SaveFilePickerOptions {
	startIn?: WellKnownDirectory;
}

declare interface Array<T> {
	concat<V>(...items: V[]): (T | V)[];
	with<V>(index: number, value: V): (T | V)[];
}

declare interface NamedCustomEvent<N extends string, T = any> extends CustomEvent<T> {
	readonly type: N;
}

declare type Chrome = typeof chrome;
declare type ChromeEventMap<T> = { [P in keyof T as T[P] extends chrome.events.BaseEvent<any> ? P : never]: T[P] extends chrome.events.BaseEvent<infer E> ? E : never };

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

	declare namespace permissions {
		export interface PermissionsRemovedEvent {
			removeListener(callback: (permissions: Permissions) => void): void;
		}
	
		export interface PermissionsAddedEvent {
			removeListener(callback: (permissions: Permissions) => void): void;
		}
	}
}

declare module "*.svelte" {
	export default import("svelte").SvelteComponentTyped;
}

declare module "jsonpath-plus" {
	export interface JSONPathAllResult {
		path: string,
		value: any,
		parent: null | object,
		parentProperty: null | string,
		hasArrExpr: boolean,
		pointer: string
	}
}

declare type BootstrapIconKey = keyof typeof import("bootstrap-icons/font/bootstrap-icons.json");
