export interface MessageBase {
	type: string;
}

export interface LoadMessage extends MessageBase {
	type: "loadme";
}

export interface RequestInfoMessage extends MessageBase {
	type: "requestInfo";
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

export type WorkerMessage = LoadMessage | CheckMessage | RememberMessage | RequestInfoMessage;

export interface PopupProps<T = unknown> {
	oncancel?: Action;
	onconfirm?: Consumer<T>;
}
