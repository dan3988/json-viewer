import type { Plugin } from "rollup"

interface WatchBase<Mode extends string> {
	mode: Mode;
	path: string;
}

/**
 * Watch a directory for changes and copy its contents to the output directory
 */
interface WatchDir extends WatchBase<"dir"> {
	include?: string[];
	exclude?: string[];
}

/**
 * Use a file to get a list of dependencies and copy them to the output directory
 */
interface WatchConfigFile<Mode extends string, Data> extends WatchBase<Mode> {
	parse(data: Data): Iterable<string>;
}

type WatchConfigText = WatchConfigFile<"text", string>;
type WatchConfigJson = WatchConfigFile<"json", any>;

type WatchInit = WatchDir | WatchConfigJson | WatchConfigText;

interface Copier {
	close(): void;
}

type FileInfo = [path: string, mtimeMs: bigint, watch: fs.StatWatcher];

interface Options {
	outDir: string;
	inputs: WatchInit[];
	log?: boolean | ((message: string) => void);
}

export default function(options: Options): Plugin;