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

type ToCustom<T> = { [P in keyof T]: CustomEvent<T[P]> };

export interface PopupEvents<T> {
	canceled: void;
	confirmed: T;
}

export type PopupCustomEvents<T> = ToCustom<PopupEvents<T>>