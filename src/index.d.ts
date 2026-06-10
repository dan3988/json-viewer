declare type Fn<TArgs extends any[] = any[], TRet = any, TThis = any> = (this: TThis, ...args: TArgs) => TRet;
declare type Action = () => void;
declare type Func<R = any> = () => R;
declare type ValueChanged<T> = (oldValue: T, newValue: T) => void;
declare type Consumer<T = any> = (value: T) => void;
declare type Converter<T = any, R = any> = (value: T) => R;

declare interface Constructor<TValue, TArgs extends any[] = any[]> {
	readonly prototype: TValue;
	new(...args: TArgs): TValue;
}

declare type Opt<T> = T | undefined | null;

declare type Falsy = false | undefined | null | 0 | 0n | '';

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

// declare interface ChromeBaseEvent<T> {
// 	addListener(callback: T);
// 	removeListener(callback: T);
// }

// declare type ChromeEventMap<T> = { [P in keyof T as T[P] extends ChromeBaseEvent<any> ? P : never]: T[P] extends ChromeBaseEvent<infer E> ? E : never };

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
