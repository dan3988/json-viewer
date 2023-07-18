/// <reference path="./index.d.ts" />
import chai from "chai";

globalThis.expect = chai.expect;
globalThis.assert = chai.assert;
globalThis.should = chai.should;

await import("./json.js");
