import type { Plugin } from "rollup"

export interface WatchBase<Mode extends string> {
	mode: Mode;
	path: string;
}

/**
 * Watch a directory for changes and copy its contents to the output directory
 */
export interface WatchDir extends WatchBase<"dir"> {
	recursive?: boolean;
	include?: string[];
	exclude?: string[];
}

/**
 * Use a file to get a list of dependencies and copy them to the output directory
 */
export interface WatchConfigFile<Mode extends string, Data> extends WatchBase<Mode> {
	parse(data: Data): Iterable<string>;
}

export type WatchConfigText = WatchConfigFile<"text", string>;
export type WatchConfigJson = WatchConfigFile<"json", any>;

export type WatchInit = WatchDir | WatchConfigJson | WatchConfigText;

export interface Copier {
	close(): void;
}

export interface Options {
	outDir: string;
	inputs: WatchInit[];
	log?: boolean | ((message: string) => void);
	archive?: {
		fileName: string;
		format?: "zip" | "tgz"
	}
}

export function copyLibs(options: Options): Plugin;
export default copyLibs;