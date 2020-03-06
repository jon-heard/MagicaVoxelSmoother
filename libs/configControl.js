
let configState = { useBuggySmooths: false, paletteFile: null, cellConfigs: {} };

let configControlTool = 0;
let configControlSelector = null;
let configControlSelectorOffset = null;
let configControlHighlightedVoxels = [];
let infoUi;

function initConfigControl()
{
	document.getElementById("configControlTool").addEventListener("change", function(evt)
	{
		configControlTool = evt.target.value;
		updateConfigControlTool();
	});
	document.getElementById("view").addEventListener("mousemove", configControl_onHover);
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
			if (configState.cellConfigs[key] == configControlTool)
			{
				configControlHighlightedVoxels.push(JSON.parse(key));
			}
		}
	}
}

function configControl_onHover(evt)
{
	if (!voxData) { return; }
	let ray = getRayFromScreenCoordinates(evt.layerX, evt.layerY);
	let info = "&nbsp;";
	configControlSelector = null;
	let i = 0;
	let state = 0;
	while (state != 2 && (state > 0 || i < 500))
	{
		if (configControlSelector) { break; }
		let rayIteration = vec3.create();
		vec3.scaleAndAdd(rayIteration, ray.start, ray.dir, i);
		for (var k = 0; k < voxData.models.length; k++)
		{
			let model = voxData.models[k];
			let rayIterationForModel = vec3.clone(rayIteration);
			vec3.add(rayIterationForModel, rayIterationForModel, model.centerOffset);
			vec3.round(rayIterationForModel, rayIterationForModel);
			let voxelState = getCellState(model, rayIterationForModel);
			if (state == 0 && voxelState != CellState.INVALID || state == 1 && voxelState == CellState.INVALID)
			{
				state++;
			}
			if (voxelState == CellState.VOXEL || voxelState == CellState.SMOOTH)
			{
				vec3.round(rayIteration, rayIteration);
				configControlSelector = model.grid[rayIterationForModel[0]][rayIterationForModel[1]][rayIterationForModel[2]];
				configControlSelectorOffset = vec3.clone(model.centerOffset);
				vec3.scale(configControlSelectorOffset, configControlSelectorOffset, -1);
				info = "Model: " + k + " &nbsp; Position: " + configControlSelector[0] + ", " + configControlSelector[1] + ", " + configControlSelector[2] + " &nbsp Type: " + configControlSelector.type;
			}
		}
		i++;
	}
	infoUi.innerHTML = info;
}
