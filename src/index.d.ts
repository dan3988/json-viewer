declare type Fn<TArgs extends any[] = any[], TRet = any, TThis = any> = (this: TThis, ...args: TArgs) => TRet;
declare type Action<T1 = never, T2 = never, T3 = never, T4 = never, T5 = never> = (...args: UntilNever<[T1, T2, T3, T4, T5]>) => void;
declare type Func<TResult, T1 = never, T2 = never, T3 = never, T4 = never, T5 = never> = (...args: UntilNever<[T1, T2, T3, T4, T5]>) => TResult;
declare interface Constructor<TValue, TArgs extends any[] = any[]> {
	readonly prototype: TValue;
	new(...args: TArgs): TValue;
}

type UntilNever<T extends any[], Prev extends any[] = []> = T extends [never, ...any[]] ? Prev : (T extends [infer Start, ...infer Rest] ? UntilNever<Rest, [...Prev, Start]> : Prev);

declare type Expand<T> = { [P in keyof T]: T[P] };
declare type Except<T, P extends keyof T> = { [K in keyof T as K extends P ? never : K]: T[K] };

declare type Dict<T = any> = Record<string, T>;
declare type OneOrMany<T> = T | T[];

declare var JSON5: typeof import("json5");

declare interface Array<T> {
	at(index: number): undefined | T
}

declare interface NamedCustomEvent<N extends string, T = any> extends CustomEvent<T> {
	readonly type: N;
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

declare module "espree" {
	export interface EcmaFeatures {
		jsx?: boolean;
		globalReturn?: boolean;
		impliedScript?: boolean;
	}

	export interface EcmaVersions {
		"ES5": 3;
		"ES6": 5;
		"2015": 6;
		"2016": 7;
		"2017": 8;
		"2018": 9;
		"2019": 10;
		"2020": 11;
		"2021": 12;
		"2022": 13;
		"2023": 14;
		"2024": 15;
	}

	export type EcmaVersion = EcmaVersions[keyof EcmaVersions] | "latest";

	export interface ParseOptions {
		range?: boolean;
		loc?: boolean;
		comment?: boolean;
		tokens?: boolean;
		sourceType?: "script" | "module" | "commonjs";
		ecmaVersion?: EcmaVersion;
		ecmaFeatures?: EcmaFeatures;
	}

	export function parse(code: string, options: ParseOptions): import("estree").Program;
}