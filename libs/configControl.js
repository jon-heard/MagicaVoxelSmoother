
let configState = { useBuggySmooths: false, paletteFile: null, cellConfigs: {} };

let configControlTool = 0;
let configControlSelector = null;
let configControlSelectorOffset = null;
let configControlHighlightedVoxels = [];
let infoUi;
let configControlClickingSelector = null;

function initConfigControl()
{
	document.getElementById("configControlTool").addEventListener("change", function(evt)
	{
		configControlTool = evt.target.value;
		updateConfigControlTool();
	});
	document.getElementById("view").addEventListener("mousemove", configControl_onMouseHover);
	document.getElementById("view").addEventListener("mousedown", configControl_onMouseDown);
	document.getElementById("view").addEventListener("mouseup", configControl_onMouseUp);
	document.getElementById("view").addEventListener("mouseleave", function()
	{
		configControlSelector = null;
	});
	infoUi = document.getElementById("footContent");
}

function setConfigState(state)
{
	configState = state;
	updateConfigControlTool();
}

function updateConfigControlTool()
{
	configControlHighlightedVoxels = [];
	if (configControlTool != 0)
	{
		for (let key in configState.cellConfigs)
		{
			if (configState.cellConfigs[key] & configControlTool)
			{
				configControlHighlightedVoxels.push(JSON.parse(key));
			}
		}
	}
}

function configControl_onMouseHover(evt)
{
	if (!voxData) { return; }
	let ray = getRayFromScreenCoordinates(evt.layerX, evt.layerY);
	let info = "&nbsp;";
	configControlSelector = null;
	let i = 0;
	let rayStage = 0; // stages of ray passage (before model, within model, after model)
	while (rayStage != 2 && (rayStage > 0 || i < 500))
	{
		if (configControlSelector) { break; }
		let rayIteration = vec3.create();
		vec3.scaleAndAdd(rayIteration, ray.start, ray.dir, i);
		for (let i = 0; i < voxData.models.length; i++)
		{
			// Model
			const model = voxData.models[i];

			// Ray iteration
			const rayIterationForModel = vec3.clone(rayIteration);
			vec3.add(rayIterationForModel, rayIterationForModel, model.centerOffset);
			vec3.round(rayIterationForModel, rayIterationForModel);

			// Cell of ray iteration
			const cell = getCell(model, rayIterationForModel);
			const cellState = getCellState(cell, true);

			// Stages of ray passage (before model, within model, after model)
			if (rayStage == 0 && cellState != CellState.INVALID || rayStage == 1 && cellState == CellState.INVALID)
			{
				rayStage++;
			}

			if (cellState != null && ((configControlTool == 2 && cellState == CellState.VOXEL) || (configControlTool != 2 && (cellState == CellState.VOXEL || cellState == CellState.SMOOTH))))
			{
				if (configControlTool == 2 || (cellState == CellState.VOXEL && cell.voxel.enabled))
				{
					configControlSelector = cell.voxel;
				}
				else if (cell.smooths.length > 0)
				{
					configControlSelector = cell.smooths[0];
					for (let i = 0; i < cell.smooths.length; i++)
					{
						if (cell.smooths[i].enabled)
						{
							configControlSelector = cell.smooths[i];
							break;
						}
					}
				}
				if (configControlSelector)
				{
					configControlSelectorOffset = vec3.clone(model.centerOffset);
					vec3.scale(configControlSelectorOffset, configControlSelectorOffset, -1);
					info = "Model: " + i + " &nbsp; " +
					       "Position: " + configControlSelector[0] + ", " + configControlSelector[1] + ", " + configControlSelector[2] + " &nbsp " +
					       "Type: " + (configControlSelector.type==CellState.VOXEL ? "voxel" : configControlSelector.type==CellState.SMOOTH ? "smooth" : "???");
				}
			}
		}
		i++;
	}
	infoUi.innerHTML = info;
}

function configControl_onMouseDown(evt)
{
	if (evt.button == 0)
	{
		configControlClickingSelector = configControlSelector;
	}
}

function configControl_onMouseUp(evt)
{
	if (evt.button == 0 && configControlTool != 0 && configControlSelector != null && configControlClickingSelector == configControlSelector)
	{
		configControlClickingSelector = null;
		let key = JSON.stringify([ configControlSelector[0], configControlSelector[1], configControlSelector[2] ]);
		if (configState.cellConfigs.hasOwnProperty(key) && configState.cellConfigs[key] & configControlTool)
		{
			configState.cellConfigs[key] &= ~configControlTool;
			if (!configState.cellConfigs[key])
			{
				delete configState.cellConfigs[key];
			}
		}
		else
		{
			configState.cellConfigs[key] |= configControlTool;
		}
		let cell = getCell(voxData.models[0], configControlSelector);
		processConfigData(voxData);
		updateConfigControlTool();
	}
}
