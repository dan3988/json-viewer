/// <reference path="rollup-plugin-copy-libs.d.ts" />
import * as rl from "rollup";
import * as fs from "node:fs";
import * as path from "node:path";
import { createFilter } from "@rollup/pluginutils";
import chalk from "chalk-template";
import archiver from "archiver";

const r = { recursive: true };
/** @type {{ bigint: true }} */
const bi = { bigint: true };

/** @typedef {(text: TemplateStringsArray, ...placeholders: unknown[]) => void} LogImpl */
/** @typedef {[path: string, mtimeMs: bigint, watch: fs.StatWatcher]} FileInfo */

/**
 * @param {import("./rollup-plugin-copy-libs").WatchInit[]} inputs 
 * @param {string} outDir 
 * @param {boolean} watch 
 * @param {LogImpl} log
 * @returns {import("./rollup-plugin-copy-libs").Copier | undefined}
 */
function copyFiles(inputs, outDir, watch, log) {
	/** @type {(() => void)[]} */
	const dispose = [];

	for (const input of inputs) {
		if (input.mode === "dir") {
			const { include, exclude, output = path.relative(".", input.path) } = input;
			const filter = createFilter(include, exclude, {
				resolve: false
			});

			for (const file of fs.readdirSync(input.path)) {
				if (filter(file)) {
					const src = path.join(input.path, file);
					const dst = path.join(outDir, output, file);
					fs.cpSync(src, dst, r);
				}
			}

			if (watch) {
				const watcher = fs.watch(input.path, r, (event, file) => {
					if (filter(file)) {
						log && log`{greenBright File ${event}} {green "${input.path}"} {yellow "${file}"}`;
						const src = path.join(input.path, file);
						const dst = path.join(outDir, output, file);
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
							log && log`{greenBright File change} {green "${input.path}"} {yellow "${file}"}`;
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
					log && log`{greenBright Input file change detected} {green "${input.path}"}`;
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

/**
 * @type {import("./rollup-plugin-copy-libs")["copyLibs"]}
 */
export function copyLibs(options) {
	const { outDir, inputs, log, archive } = options;
	const watch = !!process.env.ROLLUP_WATCH;
	/** @type {Copier} */
	let watcher;
	/** @type {LogImpl} */
	let logImpl;
	if (log)
		logImpl = LogImpl.bind(typeof log === "function" ? log : console.log);

	return {
		name: "rollup-plugin-copy-libs",
		closeBundle() {
			if (archive) {
				let { fileName, format = "zip" } = archive;
				if (!fileName.includes("."))
					fileName += "." + format;

				const output = fs.createWriteStream(fileName);
				const zip = archiver(format);
				zip.pipe(output);
				zip.directory(outDir, false);
				return zip.finalize();
			}
		},
		buildEnd() {
			watcher ??= copyFiles(inputs, outDir, watch, logImpl);
		}
	}
}

function LogImpl(text, ...placeholders) {
	const msg = chalk(text, ...placeholders);
	this(msg);
}

export default copyLibs;