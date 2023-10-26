export interface MessageBase {
	type: string;
}

export interface LoadMessage extends MessageBase {
	type: "loadme";
}

export interface HeadersMessage extends MessageBase {
	type: "headers";
}

export interface CheckMessage extends MessageBase {
	type: "checkme"
	contentType: string;
}

export interface RememberMessage extends MessageBase {
	type: "remember";
	autoload: boolean;
}

export type DocumentHeader = readonly [name: string, value: string];

export interface DocumentRequestInfo {
	status: number;
	statusText: string;
	startTime: number;
	endTime: number;
	requestHeaders: DocumentHeader[];
	responseHeaders: DocumentHeader[];
}

export type WorkerMessage = LoadMessage | CheckMessage | RememberMessage | HeadersMessage;

type ToCustom<T> = { [P in keyof T]: CustomEvent<T[P]> };

export interface PopupEvents<T> {
	canceled: void;
	confirmed: T;
}

export type PopupCustomEvents<T> = ToCustom<PopupEvents<T>>