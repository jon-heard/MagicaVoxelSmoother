
fileUpdatedListeners = {
	inited: false,
	listeners: [],
	fileType: Object.freeze({ FILE_SELECTOR: 1, NATIVE_FILE: 2, UNKNOWN: 3 }),

	add: function(file, callback)
	{
		// Init system if not already inited
		if (!fileUpdatedListeners.inited)
		{
			window.addEventListener("focus", fileUpdatedListeners.onPageFocused);
			fileUpdatedListeners.onPageFocused();
			fileUpdatedListeners.inited = true;
		}

		// Work out the type
		let fileType = fileUpdatedListeners.fileType.UNKNOWN;
		if (file instanceof HTMLInputElement)
		{
			fileType = fileUpdatedListeners.fileType.FILE_SELECTOR;
		}
		else if (file instanceof FileSystemFileHandle)
		{
			fileType = fileUpdatedListeners.fileType.NATIVE_FILE;
		}

		// Add the listener
		fileUpdatedListeners.listeners.push({ file: file, callback: callback, modDate: new Date(), type: fileType });

		// React to user changing the selected file
		if (fileType == fileUpdatedListeners.fileType.FILE_SELECTOR)
		{
			file.addEventListener("change", fileUpdatedListeners.onFileChanged);
		}
		else if(fileType == fileUpdatedListeners.fileType.NATIVE_FILE)
		{
			fileUpdatedListeners.onPageFocused();
		}
	},

	isFileReady: function(listener)
	{
		switch (listener.type)
		{
			case fileUpdatedListeners.fileType.FILE_SELECTOR:
				return (listener.file.files.length > 0);
			case fileUpdatedListeners.fileType.NATIVE_FILE:
				return true;
			case fileUpdatedListeners.fileType.UNKNOWN:
				return false;
		}
	},

	getLastModified: async function(listener)
	{
		switch (listener.type)
		{
			case fileUpdatedListeners.fileType.FILE_SELECTOR:
				return new Date(listener.file.files[0].lastModified)
			case fileUpdatedListeners.fileType.NATIVE_FILE:
				let file = await listener.file.getFile();
				return new Date(file.lastModified)
			case fileUpdatedListeners.fileType.UNKNOWN:
				return null;
		}
	},

	getJsFile: async function(listener)
	{
		switch (listener.type)
		{
			case fileUpdatedListeners.fileType.FILE_SELECTOR:
				return listener.file.files[0];
			case fileUpdatedListeners.fileType.NATIVE_FILE:
				let file = await listener.file.getFile();
				return file;
			case fileUpdatedListeners.fileType.UNKNOWN:
				return null;
		}
	},

	onPageFocused: async function()
	{
		const listeners = fileUpdatedListeners.listeners;
		for (let i = 0; i < listeners.length; i++)
		{
			if (fileUpdatedListeners.isFileReady(listeners[i]))
			{
				const newModDate = await fileUpdatedListeners.getLastModified(listeners[i]);
				if (newModDate.getTime() != listeners[i].modDate.getTime())
				{
					listeners[i].callback(await fileUpdatedListeners.getJsFile(listeners[i]));
					listeners[i].modDate = newModDate;
				}
			}
		}
	},

	onFileChanged: function(evt)
	{
		const listeners = fileUpdatedListeners.listeners;
		for (let i = 0; i < listeners.length; i++)
		{
			if (listeners[i].file == evt.target)
			{
				listeners[i].callback(listeners[i].file.files[0]);
				listeners[i].modDate = new Date(listeners[i].file.files[0].lastModified);
			}
		}
	}
};
