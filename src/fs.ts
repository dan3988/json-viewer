async function nativeSaveFile(blob: Blob, options: SaveFilePickerOptions) {
	let result: FileSystemFileHandle;
	try {
		result = await showSaveFilePicker(options);
	} catch (e) {
		return false;
	}

	const w = await result.createWritable();
	try {
		await w.write(blob);
	} finally {
		await w.close();
	}

	return true;
}

async function nativeOpenFile(options: OpenFilePickerOptions) {
	let result: FileSystemFileHandle;
	try {
		[result] = await showOpenFilePicker(options);
	} catch (e) {
		return null;
	}

	return await result.getFile();
}

function toAccept(type: fs.FileType): FilePickerAcceptType {
	const { extension, mimeType, description } = type;
	return {
		description,
		accept: {
			[mimeType]: extension as any
		}
	};
}

export namespace fs {
	export interface FileType {
		description?: string;
		mimeType: `${string}/${string}`;
		extension: string;
	}

	export const FileTypes = {
		text: { mimeType: 'text/plain', extension: '.txt' },
		json: { mimeType: 'application/json', extension: '.json' },
	} satisfies Dict<FileType>;

	type FileTypeKey = keyof typeof FileTypes;

	export async function saveFile(data: string | Blob, suggestedName: string, type: FileTypeKey | FileType): Promise<boolean> {
		const fileType = typeof type === 'string' ? FileTypes[type] : type;
		const blob = typeof data === 'string' ? new Blob([data]) : data;
		if (typeof window.showSaveFilePicker !== 'undefined') {
			return nativeSaveFile(blob, {
				suggestedName,
				startIn: 'downloads',
				types: [ toAccept(fileType) ]
			});
		}

		const anchor = document.createElement('a');
		anchor.download = suggestedName + fileType.extension;
		anchor.href = URL.createObjectURL(blob);
		anchor.click();
		return Promise.resolve(true);
	}

	export async function openFile(type: FileTypeKey | FileType): Promise<File | null> {
		const fileType = typeof type === 'string' ? FileTypes[type] : type;

		if (typeof window.showOpenFilePicker !== 'undefined') {
			return nativeOpenFile({
				startIn: 'downloads',
				types: [ toAccept(fileType) ]
			});
		}

		return new Promise((resolve) => {
			const input = document.createElement('input');
			input.type = 'file';
			input.accept = fileType.extension;
			input.addEventListener('cancel', () => resolve(null));
			input.addEventListener('input', () => resolve(input.files![0] ?? null));
			input.click();
		});
	}
}

export default fs;