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
