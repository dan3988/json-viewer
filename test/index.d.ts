/// <reference path="../src/index.d.ts" />

declare module globalThis {
	declare var expect: typeof import("chai")["expect"];
	declare var should: typeof import("chai")["should"];
	declare var assert: typeof import("chai")["assert"];
}