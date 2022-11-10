{
	let require = function () {
		throw new Error("not implemented.");
	}

	interface Module {
		[Symbol.toStringTag]: "Module";
		[key: string]: any;
	}

	class ModuleDefinition {
		name: undefined | string;
		readonly #deps: string[];
		readonly #load: Function;
		#loaded: boolean;
		#exports: undefined | Module;

		constructor(name: undefined | string, deps: string[], load: Function) {
			this.name = name;
			this.#deps = deps;
			this.#load = load;
			this.#loaded = false;
		}

		load() {
			if (!this.#loaded) {
				let args: any[] = [];
				let exports: undefined | Module = undefined;

				for (let dep of this.#deps) {
					let value: any;
					switch (dep) {
						case "require":
							value = require;
							break;
						case "exports":
							value = exports = {};
							break;
						default:
							value = loadModule(dep);
							if (value == null)
								throw new TypeError(`Module '${this.name}' depends on '${dep}' which could not be found.`);

							break;
					}

					args.push(value);
				}

				if (exports === undefined) {
					exports = this.#load.apply(undefined, args);
				} else {
					exports[Symbol.toStringTag] = "Module";
					this.#load.apply(undefined, args);
				}

				this.#loaded = true;
				this.#exports = exports;
			}

			return this.#exports!;
		}
	}

	const modules = new Map<string, ModuleDefinition>();
	const nameless: ModuleDefinition[] = [];

	function loadModule(name: string) {
		const def = modules.get(name);
		return def?.load();
	}

	function define(name: any, deps: any, fn: any) {
		if (fn == undefined) {
			const module = new ModuleDefinition(undefined, name, deps);
			nameless.push(module);
		} else {
			const module = new ModuleDefinition(name, deps, fn);
			modules.set(name, module);
		}
	}

	define.amd = true;
	define.execute = <DefineFunction["execute"]>function (names, deps, load): void {
		if (names.length !== nameless.length)
			throw new Error("nameless mismatch");

		for (let i = 0; i < names.length; i++) {
			const name = names[i];
			nameless[i].name = name;
			modules.set(name, nameless[i]);
		}

		if (typeof deps === "string") {
			const module = loadModule(deps);
			if (module == undefined)
				throw new Error(`Module '${deps}' not found.`);
		} else {
			const args = Array<any>(deps.length);
			for (let i = 0; i < deps.length; i++) {
				const name = deps[i];
				const module = loadModule(name);
				if (module == undefined)
					throw new Error(`Module '${name}' not found.`);
	
				args[i] = module;
			}
	
			nameless.length = 0;
			load.apply(undefined, args);
		}
	}

	Object.defineProperty(globalThis, "define", { value: define });
}

declare interface DefineFunction {
	readonly amd: true;
	/**
	 * Executes a module.
	 * @param nameless The names for packages that do not pass in their module name in the call to define
	 * @param module The module to execute
	 */
	execute(nameless: string[], module: string): void;
	/**
	 * Loads the dependent modules and calls {@link fn}.
	 * @param nameless The names for packages that do not pass in their module name in the call to define
	 * @param deps The modules required to execute
	 * @param fn A function that is called with the loaded modules
	 */
	execute(nameless: string[], deps: string[], fn: (...deps: any[]) => void): void;
	/**
	 * Registers a module
	 */
	(deps: string[], load: (...deps: any[]) => any): void;
	(name: string, deps: string[], load: (...deps: any[]) => any): void;
}

declare var define: DefineFunction;