
fileUpdatedListeners = {
	inited: false,
	fileUis: [],

	add: function(fileUi, callback)
	{
		fileUpdatedListeners.fileUis.push({ ui: fileUi, callback: callback, modDate: new Date() });
		fileUi.addEventListener("change", fileUpdatedListeners.onFileUiChanged);
		if (!fileUpdatedListeners.inited)
		{
			window.addEventListener("focus", fileUpdatedListeners.onPageFocused);
			fileUpdatedListeners.onPageFocused();
			onFileUpdated.inited = true;
		}
	},

	onPageFocused: function()
	{
		const fileUis = fileUpdatedListeners.fileUis;
		for (let i = 0; i < fileUis.length; i++)
		{
			if (fileUis[i].ui.files.length > 0)
			{
				const newModDate = new Date(fileUis[i].ui.files[0].lastModified);
				if (newModDate.getTime() != fileUis[i].modDate.getTime())
				{
					fileUis[i].callback(fileUis[i].ui.files[0]);
					fileUis[i].modDate = newModDate;
				}
			}
		}
	},

	onFileUiChanged: function(evt)
	{
		const fileUis = fileUpdatedListeners.fileUis;
		for (let i = 0; i < fileUis.length; i++)
		{
			if (fileUis[i].ui == evt.target)
			{
				fileUis[i].callback(fileUis[i].ui.files[0]);
				fileUis[i].modDate = new Date(fileUis[i].ui.files[0].lastModified);
			}
		}
	}
};
