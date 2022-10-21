type MimeObject<B extends string, T extends readonly string[]> = { readonly [P in T[number]]: `${B}/${P}` }

function createMimeObject<B extends string, T extends readonly string[]>(type: B, ...subTypes: T): MimeObject<B, T> {
	const obj: any = {};
	for (let subType of subTypes)
		Object.defineProperty(obj, subType, {
			configurable: false,
			writable: false,
			enumerable: true,
			value: `${type}/${subType}`
		});

	return obj;
}

export var mime = {
	text: createMimeObject('text', 'css', 'html', 'javascript', 'plain', 'xml'),
	application: createMimeObject('application', 'gzip', 'java-archive', 'json', 'msword', 'octet-stream', 'ogg', 'pdf', 'vnd.ms-excel', 'vnd.ms-powerpoint', 'vnd.openxmlformats-officedocument.presentationml.presentation', 'vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'vnd.openxmlformats-officedocument.wordprocessingml.document', 'vnd.rar', 'xml', 'zip'),
	audio: createMimeObject('audio', '3gp', 'aac', 'midi', 'mpeg', 'ogg', 'wav', 'webm', 'x-midi'),
	image: createMimeObject('image', 'bmp', 'gif', 'jpeg', 'png', 'svg+xml', 'tiff', 'vnd.microsoft.icon', 'webp'),
	video: createMimeObject('video', '3gp', 'mp4', 'mpeg', 'ogg', 'webm', 'x-msvideo'),
	multipart: createMimeObject('multipart', 'byteranges', 'form-data')
};
