import * as rl from "rollup";
import * as fs from "node:fs";
import * as path from "node:path";
import { createFilter } from "@rollup/pluginutils";

const r = { recursive: true };
/** @type {{ bigint: true }} */
const bi = { bigint: true };

/** 
 * @template {string} T
 * @typedef WatchBase
 * @property {string} path;
 * @property {T} mode;
 */

/**
 * @typedef WatchDirBase
 * @property {string[]} include
 * @property {string[]} exclude
 */

/**
 * Watch a directory for changes and copy its contents to the output directory
 * @typedef {WatchBase<"dir"> & WatchDirBase} WatchDir
 */
 
/**
 * @typedef WatchConfigTextBase
 * @property {(text: string) => string[]} parse
 * 
 * @typedef {WatchBase<"text"> & WatchConfigTextBase} WatchConfigText
 */

/**
 * @typedef WatchConfigJsonBase
 * @property {(text: any) => string[]} parse
 * 
 * @typedef {WatchBase<"json"> & WatchConfigJsonBase} WatchConfigJson
 */

/**
 * Use a file to get a list of dependencies and copy them to the output directory
 * @typedef {WatchConfigText | WatchConfigJson} WatchConfigFile
 */

/**
 * @typedef {WatchDir | WatchConfigFile} Watch
 */

/**
 * @typedef {[path: string, mtimeMs: bigint, watch: fs.StatWatcher]} FileInfo
 */

/**
 * @typedef Watcher
 * @prop {() => void} close
 */

/**
 * @param {Watch[]} inputs 
 * @param {string} outDir 
 * @param {boolean} watch 
 * @param {(msg: string, ...ags: any[]) => void} log
 * @returns {Watcher | undefined}
 */
function copyFiles(inputs, outDir, watch, log) {
	/** @type {(() => void)[]} */
	const dispose = [];
	/** @type {fs.FSWatcher[]} */
	const dirs = [];

	for (const input of inputs) {
		const dirName = path.relative(".", input.path);
		if (input.mode === "dir") {
			const filter = createFilter(input.include, input.exclude);
			for (const file of fs.readdirSync(input.path)) {
				if (filter(file)) {
					const src = path.join(input.path, file);
					const dst = path.join(outDir, dirName, file);
					fs.cpSync(src, dst, r);
				}
			}

			if (watch) {
				const watcher = fs.watch(input.path, r, (event, file) => {
					if (filter(file)) {
						log?.('File %s "%s": "%s"', event, input.path, file);
						const src = path.join(input.path, file);
						const dst = path.join(outDir, dirName, file);
						if (!fs.existsSync(src)) {
							fs.rmSync(dst, r);
						} else {
							fs.cpSync(src, dst, r);
						}
					}
				});

				dispose.push(() => watcher.close());
			}
		} else {
			const isJson = input.mode === "json";
			/** @type {Map<string, FileInfo>} */
			const copied = new Map();
			const update = () => {
				let data = fs.readFileSync(input.path, { encoding: "utf8" });
				if (isJson)
					data = JSON.parse(data);

				const parsed = input.parse(data);
				const uncopied = new Map(copied);

				for (const file of parsed) {
					const modif = fs.lstatSync(file, bi);
					let fileInfo = copied.get(file);
					if (fileInfo == undefined) {
						const resolved = path.join(outDir, file);
						const watcher = watch && fs.watchFile(file, bi, (stat) => {
							log?.('File change "%s" -> "%s"', file, fileInfo[0]);
							fs.cpSync(file, fileInfo[0]);
							fileInfo[1] = stat.mtimeMs;
						});

						fileInfo = [resolved, modif.mtimeMs, watcher];
					} else if (fileInfo[1] !== modif.mtimeMs) {
						fileInfo[1] = modif.mtimeMs;
					} else {
						uncopied.delete(file);
						continue;
					}
					
					fs.cpSync(file, fileInfo[0], r);
					copied.set(file, fileInfo);
					uncopied.delete(file);
				}

				for (const [key, [file, _modif, watch]] of uncopied) {
					copied.delete(key);
					watch.unref();
					fs.rmSync(file);
				}
			}

			if (watch) {
				const w = fs.watchFile(input.path, () => {
					log?.('Input file change detected: "%s"', input.path);
					update();
				});

				dispose.push(() => {
					w.unref();
					copied.forEach(v => v[2].unref());
				});
			}

			update();
		}
	}

	if (!watch)
		return;
		
	function close() {
		dispose.forEach(v => v());
	}

	return { close };
}

class Watcher2 {
	/** @type {fs.StatWatcher[]} */
	#files;
	/** @type {fs.FSWatcher[]} */
	#dirs;
	#log;

	/**
	 * @param {string} outDir
	 * @param {(msg: string, ...ags: any[]) => void} log
	 * @param {Watch[]} inputs 
	 */
	constructor(outDir, log, inputs) {
		this.#files = [];
		this.#dirs = [];
		this.#log = log;
	}

	close() {
		this.#files.forEach(v => v.unref());
		this.#dirs.forEach(v => v.close());
	}
}

/**
 * @typedef Options
 * @property {string} outDir
 * @property {Watch[]} inputs
 */

/**
 * @param {Options} options
 * @returns {rl.Plugin}
 */
export function copyLibs(options) {
	const { outDir, inputs } = options;
	const watch = !!process.env.ROLLUP_WATCH;
	/** @type {Watcher} */
	let watcher;
	

	return {
		name: "rollup-plugin-copy-libs",
		buildEnd() {
			watcher ??= copyFiles(inputs, outDir, watch, console.log);
		}
	}
}

export default copyLibs;