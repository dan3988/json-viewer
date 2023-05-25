export interface MessageBase {
	type: string;
}

export interface LoadMessage extends MessageBase {
	type: "loadme";
}

export interface CheckMessage extends MessageBase {
	type: "checkme"
	contentType: string;
}

export interface RememberMessage extends MessageBase {
	type: "remember";
	autoload: boolean;
}

export type WorkerMessage = LoadMessage | CheckMessage | RememberMessage;

export interface IndentStyle {
	name: string;
	indents: number;
}

export type IndentStyles = Record<string, IndentStyle>;

declare module "*.svelte" {
	export default import("svelte").SvelteComponentTyped;
}