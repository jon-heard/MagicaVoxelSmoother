
const SmoothType = Object.freeze({ NONE: 1, VOXEL: 2, OUTLINE: 3, CORNER: 4, EMBED: 5, OUTBED: 6, SIDECORNER: 7 });
const CellState = Object.freeze({ INVALID: 1, BLANK: 2, VOXEL: 3, SMOOTH: 4 });
const CellConfig = Object.freeze({ NO_VOXEL: 2, NO_SMOOTH: 4, BLANK: 6 });

// Palette index equality: Wraps basic equality, allowing for chunks of indices considered "equal"
function palEq(voxel1, voxel2)
{
	if (!voxel1 || !voxel2)
	{
		return;
	}
	const color1 = voxel1.color;
	const color2 = voxel2.color;
	// Combine 228-239 into smooth clusters of 4: [228,229,230,231], [232,233,234,235], [236,237,238,239]
	if (color1 > 227 && color1 < 240)
	{
		color1 = Math.floor(color1 / 4) * 4
	}
	if (color2 > 227 && color2 < 240)
	{
		color2 = Math.floor(color2 / 4) * 4
	}

	if (color1 == color2)
	{
		return true;
	}
	else
	{
		return false;
	}
}


function getCell(model, coords)
{
	if (coords[0] < 0 || coords[1] < 0 || coords[2] < 0)
	{
		return null;
	}
	else if (coords[0] >= model.size[0] || coords[1] >= model.size[1] || coords[2] >= model.size[2])
	{
		return null;
	}
	return model.grid[coords[0]][coords[1]][coords[2]];
}

function getCellState(cell, includeDisabled)
{
	if (!cell)
	{
		return CellState.INVALID;
	}
	else if (cell.voxel && (cell.voxel.enabled || includeDisabled))
	{
		return CellState.VOXEL;
	}
	else
	{
		for (let i = 0; i < cell.smooths.length; i++)
		{
			if (cell.smooths[i].enabled || includeDisabled)
			{
				return CellState.SMOOTH;
			}
		}
	}
	return CellState.BLANK;
}

function smoother_processVoxData(data)
{
	for (let i = 0; i < data.models.length; i++)
	{
		const model = data.models[i];

		// Center offset create
		model.centerOffset = vec3.clone(model.size);
		vec3.scale(model.centerOffset, model.centerOffset, 0.5);
		vec3.add(model.centerOffset, model.centerOffset, [-0.5, -0.5, -0.5]);

		// grid create
		model.grid = [];
		for (let x = 0; x < model.size[0]; x++)
		{
			model.grid.push([]);
			for (let y = 0; y < model.size[1]; y++)
			{
				model.grid[x].push([]);
				for (let z = 0; z < model.size[2]; z++)
				{
					model.grid[x][y].push({ voxel: null, smooths: [] });
				}
			}
		}

		// grid populate voxels
		for (let k = 0; k < model.voxels.length; k++)
		{
			const v = model.voxels[k];
			v.enabled = true;
			model.grid[ v[0] ][ v[1] ][ v[2] ].voxel = v;
		}

		// Add smooths collection (placeholder)
		model.smooths = [];
	}
	for (let i = 0; i < data.palette.length; i++)
	{
		data.palette[i] = vec3.fromValues(data.palette[i][0] / 255, data.palette[i][1] / 255, data.palette[i][2] / 255);
	}

	processConfigData(data);
}

function processConfigData(data)
{
	for (let i = 0; i < data.models.length; i++)
	{
		const model = data.models[i];

		// Voxel disabling
		for (let k = 0; k < model.voxels.length; k++)
		{
			const v = model.voxels[k];
			const cellConfigState = configState.cellConfigs[JSON.stringify([ v[0], v[1], v[2] ])];
			v.enabled = (!cellConfigState || !(cellConfigState & CellConfig.NO_VOXEL));
		}

		// "culled" flag create
		for (let k = 0; k < model.voxels.length; k++)
		{
			const v = model.voxels[k];
			// Unculled if uncovered by voxel on ANY side
			let culled = true;
			     if (getCellState(getCell(model, [v[0]-1, v[1], v[2]])) != CellState.VOXEL) { culled = false; }
			else if (getCellState(getCell(model, [v[0], v[1]-1, v[2]])) != CellState.VOXEL) { culled = false; }
			else if (getCellState(getCell(model, [v[0], v[1], v[2]-1])) != CellState.VOXEL) { culled = false; }
			else if (getCellState(getCell(model, [v[0]+1, v[1], v[2]])) != CellState.VOXEL) { culled = false; }
			else if (getCellState(getCell(model, [v[0], v[1]+1, v[2]])) != CellState.VOXEL) { culled = false; }
			else if (getCellState(getCell(model, [v[0], v[1], v[2]+1])) != CellState.VOXEL) { culled = false; }
			v.culled = culled;
		}
	}
	processSmooths(data);
}

function processSmooths(data)
{
	for (let i = 0; i < voxData.models.length; i++)
	{
		const model = voxData.models[i];

		// Clear old smooths
		for (let k = 0; k < model.smooths.length; k++)
		{
			getCell(model, model.smooths[k]).smooths = [];
		}
		model.smooths = [];

		// Calculate new smooths
		for (let x = 0; x < model.size[0]; x++)
		{
			for (let y = 0; y < model.size[1]; y++)
			{
				for (let z = 0; z < model.size[2]; z++)
				{
					// Only smooth empty grid spaces
					if (getCellState(getCell(model, [x, y, z])) != CellState.BLANK)
					{
						continue;
					}

					// Get adjacent cell states
					const a = new Array(18).fill(null);
					let hasAdjacent = false;
					if (getCellState(getCell(model, [x-1, y, z])) == CellState.VOXEL) { a[0] = getCell(model, [x-1, y, z]).voxel; hasAdjacent = true; }
					if (getCellState(getCell(model, [x, y-1, z])) == CellState.VOXEL) { a[1] = getCell(model, [x, y-1, z]).voxel; hasAdjacent = true; }
					if (getCellState(getCell(model, [x, y, z-1])) == CellState.VOXEL) { a[2] = getCell(model, [x, y, z-1]).voxel; hasAdjacent = true; }
					if (getCellState(getCell(model, [x+1, y, z])) == CellState.VOXEL) { a[3] = getCell(model, [x+1, y, z]).voxel; hasAdjacent = true; }
					if (getCellState(getCell(model, [x, y+1, z])) == CellState.VOXEL) { a[4] = getCell(model, [x, y+1, z]).voxel; hasAdjacent = true; }
					if (getCellState(getCell(model, [x, y, z+1])) == CellState.VOXEL) { a[5] = getCell(model, [x, y, z+1]).voxel; hasAdjacent = true; }
					if (getCellState(getCell(model, [x-1, y-1, z])) == CellState.VOXEL) { a[ 6] = getCell(model, [x-1, y-1, z]).voxel; hasAdjacent = true; }
					if (getCellState(getCell(model, [x-1, y, z-1])) == CellState.VOXEL) { a[ 7] = getCell(model, [x-1, y, z-1]).voxel; hasAdjacent = true; }
					if (getCellState(getCell(model, [x-1, y+1, z])) == CellState.VOXEL) { a[ 8] = getCell(model, [x-1, y+1, z]).voxel; hasAdjacent = true; }
					if (getCellState(getCell(model, [x-1, y, z+1])) == CellState.VOXEL) { a[ 9] = getCell(model, [x-1, y, z+1]).voxel; hasAdjacent = true; }
					if (getCellState(getCell(model, [x+1, y-1, z])) == CellState.VOXEL) { a[10] = getCell(model, [x+1, y-1, z]).voxel; hasAdjacent = true; }
					if (getCellState(getCell(model, [x+1, y, z-1])) == CellState.VOXEL) { a[11] = getCell(model, [x+1, y, z-1]).voxel; hasAdjacent = true; }
					if (getCellState(getCell(model, [x+1, y+1, z])) == CellState.VOXEL) { a[12] = getCell(model, [x+1, y+1, z]).voxel; hasAdjacent = true; }
					if (getCellState(getCell(model, [x+1, y, z+1])) == CellState.VOXEL) { a[13] = getCell(model, [x+1, y, z+1]).voxel; hasAdjacent = true; }
					if (getCellState(getCell(model, [x, y-1, z-1])) == CellState.VOXEL) { a[14] = getCell(model, [x, y-1, z-1]).voxel; hasAdjacent = true; }
					if (getCellState(getCell(model, [x, y-1, z+1])) == CellState.VOXEL) { a[15] = getCell(model, [x, y-1, z+1]).voxel; hasAdjacent = true; }
					if (getCellState(getCell(model, [x, y+1, z-1])) == CellState.VOXEL) { a[16] = getCell(model, [x, y+1, z-1]).voxel; hasAdjacent = true; }
					if (getCellState(getCell(model, [x, y+1, z+1])) == CellState.VOXEL) { a[17] = getCell(model, [x, y+1, z+1]).voxel; hasAdjacent = true; }

					// Only check cells with adjacencies
					if (!hasAdjacent)
					{
						continue;
					}

					// Find smooth patterns and record smooths
					while (true) // broken on no smooths found
					{
						let pattern = null;
						let color = 0;
						let orient = 0;
						     if (a[ 0] != null && palEq(a[0], a[1]) && !palEq(a[0], a[2]) && !palEq(a[0], a[3]) && !palEq(a[0], a[4]) && !palEq(a[0], a[5])) { color = a[0].color; pattern = SmoothType.CORNER; orient =  4; a[0] = a[1] = null; }
						else if (a[ 0] != null && palEq(a[0], a[2]) && !palEq(a[0], a[1]) && !palEq(a[0], a[3]) && !palEq(a[0], a[4]) && !palEq(a[0], a[5])) { color = a[0].color; pattern = SmoothType.CORNER; orient =  3; a[0] = a[2] = null; }
						else if (a[ 0] != null && palEq(a[0], a[4]) && !palEq(a[0], a[1]) && !palEq(a[0], a[2]) && !palEq(a[0], a[3]) && !palEq(a[0], a[5])) { color = a[0].color; pattern = SmoothType.CORNER; orient = 10; a[0] = a[4] = null; }
						else if (a[ 0] != null && palEq(a[0], a[5]) && !palEq(a[0], a[1]) && !palEq(a[0], a[2]) && !palEq(a[0], a[3]) && !palEq(a[0], a[4])) { color = a[0].color; pattern = SmoothType.CORNER; orient =  7; a[0] = a[5] = null; }
						else if (a[ 1] != null && palEq(a[1], a[2]) && !palEq(a[1], a[0]) && !palEq(a[1], a[3]) && !palEq(a[1], a[4]) && !palEq(a[1], a[5])) { color = a[1].color; pattern = SmoothType.CORNER; orient =  0; a[1] = a[2] = null; }
						else if (a[ 1] != null && palEq(a[1], a[3]) && !palEq(a[1], a[0]) && !palEq(a[1], a[2]) && !palEq(a[1], a[4]) && !palEq(a[1], a[5])) { color = a[1].color; pattern = SmoothType.CORNER; orient =  5; a[1] = a[3] = null; }
						else if (a[ 1] != null && palEq(a[1], a[5]) && !palEq(a[1], a[0]) && !palEq(a[1], a[2]) && !palEq(a[1], a[3]) && !palEq(a[1], a[4])) { color = a[1].color; pattern = SmoothType.CORNER; orient =  6; a[1] = a[5] = null; }
						else if (a[ 2] != null && palEq(a[2], a[3]) && !palEq(a[2], a[0]) && !palEq(a[2], a[1]) && !palEq(a[2], a[4]) && !palEq(a[2], a[5])) { color = a[2].color; pattern = SmoothType.CORNER; orient =  2; a[2] = a[3] = null; }
						else if (a[ 2] != null && palEq(a[2], a[4]) && !palEq(a[2], a[0]) && !palEq(a[2], a[1]) && !palEq(a[2], a[3]) && !palEq(a[2], a[5])) { color = a[2].color; pattern = SmoothType.CORNER; orient =  1; a[2] = a[4] = null; }
						else if (a[ 3] != null && palEq(a[3], a[4]) && !palEq(a[3], a[0]) && !palEq(a[3], a[1]) && !palEq(a[3], a[2]) && !palEq(a[3], a[5])) { color = a[3].color; pattern = SmoothType.CORNER; orient = 11; a[3] = a[4] = null; }
						else if (a[ 3] != null && palEq(a[3], a[5]) && !palEq(a[3], a[0]) && !palEq(a[3], a[1]) && !palEq(a[3], a[2]) && !palEq(a[3], a[4])) { color = a[3].color; pattern = SmoothType.CORNER; orient =  8; a[3] = a[5] = null; }
						else if (a[ 4] != null && palEq(a[4], a[5]) && !palEq(a[4], a[0]) && !palEq(a[4], a[1]) && !palEq(a[4], a[2]) && !palEq(a[4], a[3])) { color = a[4].color; pattern = SmoothType.CORNER; orient =  9; a[4] = a[5] = null; }

						else if (a[ 0] != null && palEq(a[0], a[1]) && palEq(a[0], a[2]) && !palEq(a[0], a[3]) && !palEq(a[0], a[4]) && !palEq(a[0], a[5])) { color = a[0].color; pattern = SmoothType.EMBED; orient = 0; a[0] = a[1] = a[2] = null; }
						else if (a[ 1] != null && palEq(a[1], a[2]) && palEq(a[1], a[3]) && !palEq(a[1], a[0]) && !palEq(a[1], a[4]) && !palEq(a[1], a[5])) { color = a[1].color; pattern = SmoothType.EMBED; orient = 2; a[1] = a[2] = a[3] = null; }
						else if (a[ 0] != null && palEq(a[0], a[2]) && palEq(a[0], a[4]) && !palEq(a[0], a[1]) && !palEq(a[0], a[3]) && !palEq(a[0], a[5])) { color = a[0].color; pattern = SmoothType.EMBED; orient = 3; a[0] = a[2] = a[4] = null; }
						else if (a[ 2] != null && palEq(a[2], a[3]) && palEq(a[2], a[4]) && !palEq(a[2], a[0]) && !palEq(a[2], a[1]) && !palEq(a[2], a[5])) { color = a[2].color; pattern = SmoothType.EMBED; orient = 1; a[2] = a[3] = a[4] = null; }
						else if (a[ 0] != null && palEq(a[0], a[4]) && palEq(a[0], a[5]) && !palEq(a[0], a[1]) && !palEq(a[0], a[2]) && !palEq(a[0], a[3])) { color = a[0].color; pattern = SmoothType.EMBED; orient = 9; a[0] = a[4] = a[5] = null; }
						else if (a[ 1] != null && palEq(a[1], a[3]) && palEq(a[1], a[5]) && !palEq(a[1], a[0]) && !palEq(a[1], a[2]) && !palEq(a[1], a[4])) { color = a[1].color; pattern = SmoothType.EMBED; orient = 6; a[1] = a[3] = a[5] = null; }
						else if (a[ 0] != null && palEq(a[0], a[1]) && palEq(a[0], a[5]) && !palEq(a[0], a[2]) && !palEq(a[0], a[3]) && !palEq(a[0], a[4])) { color = a[0].color; pattern = SmoothType.EMBED; orient = 7; a[0] = a[1] = a[5] = null; }
						else if (a[ 4] != null && palEq(a[4], a[3]) && palEq(a[4], a[5]) && !palEq(a[4], a[0]) && !palEq(a[4], a[1]) && !palEq(a[4], a[2])) { color = a[4].color; pattern = SmoothType.EMBED; orient = 8; a[4] = a[3] = a[5] = null; }

						else if (a[ 6] != null && palEq(a[ 6], a[ 7]) && palEq(a[ 6], a[14]) && !palEq(a[ 6], a[ 8]) && !palEq(a[ 6], a[ 9]) && !palEq(a[ 6], a[10]) && !palEq(a[ 6], a[11]) && !palEq(a[ 6], a[12]) && !palEq(a[ 6], a[13]) && !palEq(a[ 6], a[15]) && !palEq(a[ 6], a[16]) && !palEq(a[ 6], a[17])) { color = a[ 6].color; pattern = SmoothType.OUTBED; orient = 0; a[06] = a[07] = a[14] = null; }
						else if (a[ 6] != null && palEq(a[ 6], a[ 9]) && palEq(a[ 6], a[15]) && !palEq(a[ 6], a[ 7]) && !palEq(a[ 6], a[ 8]) && !palEq(a[ 6], a[10]) && !palEq(a[ 6], a[11]) && !palEq(a[ 6], a[12]) && !palEq(a[ 6], a[13]) && !palEq(a[ 6], a[14]) && !palEq(a[ 6], a[16]) && !palEq(a[ 6], a[17])) { color = a[ 6].color; pattern = SmoothType.OUTBED; orient = 4; a[06] = a[09] = a[15] = null; }
						else if (a[ 7] != null && palEq(a[ 7], a[ 8]) && palEq(a[ 7], a[16]) && !palEq(a[ 7], a[ 6]) && !palEq(a[ 7], a[ 9]) && !palEq(a[ 7], a[10]) && !palEq(a[ 7], a[11]) && !palEq(a[ 7], a[12]) && !palEq(a[ 7], a[13]) && !palEq(a[ 7], a[14]) && !palEq(a[ 7], a[15]) && !palEq(a[ 7], a[17])) { color = a[ 7].color; pattern = SmoothType.OUTBED; orient = 3; a[07] = a[08] = a[16] = null; }
						else if (a[ 8] != null && palEq(a[ 8], a[ 9]) && palEq(a[ 8], a[17]) && !palEq(a[ 8], a[ 6]) && !palEq(a[ 8], a[ 7]) && !palEq(a[ 8], a[10]) && !palEq(a[ 8], a[11]) && !palEq(a[ 8], a[12]) && !palEq(a[ 8], a[13]) && !palEq(a[ 8], a[14]) && !palEq(a[ 8], a[15]) && !palEq(a[ 8], a[16])) { color = a[ 8].color; pattern = SmoothType.OUTBED; orient = 9; a[08] = a[09] = a[17] = null; }
						else if (a[10] != null && palEq(a[10], a[11]) && palEq(a[10], a[14]) && !palEq(a[10], a[ 6]) && !palEq(a[10], a[ 7]) && !palEq(a[10], a[ 8]) && !palEq(a[10], a[ 9]) && !palEq(a[10], a[12]) && !palEq(a[10], a[13]) && !palEq(a[10], a[15]) && !palEq(a[10], a[16]) && !palEq(a[10], a[17])) { color = a[10].color; pattern = SmoothType.OUTBED; orient = 2; a[10] = a[11] = a[14] = null; }
						else if (a[10] != null && palEq(a[10], a[13]) && palEq(a[10], a[15]) && !palEq(a[10], a[ 6]) && !palEq(a[10], a[ 7]) && !palEq(a[10], a[ 8]) && !palEq(a[10], a[ 9]) && !palEq(a[10], a[11]) && !palEq(a[10], a[12]) && !palEq(a[10], a[14]) && !palEq(a[10], a[16]) && !palEq(a[10], a[17])) { color = a[10].color; pattern = SmoothType.OUTBED; orient = 6; a[10] = a[13] = a[15] = null; }
						else if (a[11] != null && palEq(a[11], a[12]) && palEq(a[11], a[16]) && !palEq(a[11], a[ 6]) && !palEq(a[11], a[ 7]) && !palEq(a[11], a[ 8]) && !palEq(a[11], a[ 9]) && !palEq(a[11], a[10]) && !palEq(a[11], a[13]) && !palEq(a[11], a[14]) && !palEq(a[11], a[15]) && !palEq(a[11], a[17])) { color = a[11].color; pattern = SmoothType.OUTBED; orient = 1; a[11] = a[12] = a[16] = null; }
						else if (a[12] != null && palEq(a[12], a[13]) && palEq(a[12], a[17]) && !palEq(a[12], a[ 6]) && !palEq(a[12], a[ 7]) && !palEq(a[12], a[ 8]) && !palEq(a[12], a[ 9]) && !palEq(a[12], a[10]) && !palEq(a[12], a[11]) && !palEq(a[12], a[14]) && !palEq(a[12], a[15]) && !palEq(a[12], a[16])) { color = a[12].color; pattern = SmoothType.OUTBED; orient = 8; a[12] = a[13] = a[17] = null; }

						else if (configState.useBuggySmooths && a[ 9] != null && palEq(a[ 0], a[ 9]) && palEq(a[ 9], a[17])) { color = a[ 9].color; pattern = SmoothType.SIDECORNER; orient = 0; a[0] = a[9] = a[17] = null; }
						else if (configState.useBuggySmooths && a[13] != null && palEq(a[ 3], a[13]) && palEq(a[13], a[17])) { color = a[13].color; pattern = SmoothType.SIDECORNER; orient = 12; a[3] = a[13] = a[17] = null; }

						else { break; }

						const newSmooth = vec3.fromValues(x, y, z);
						newSmooth.type = CellState.SMOOTH;
						newSmooth.color = color;
						newSmooth.pattern = pattern;
						newSmooth.orientation = orient;
						const cellConfigState = configState.cellConfigs[JSON.stringify([ x, y, z ])];
						newSmooth.enabled = (!cellConfigState || !(cellConfigState & CellConfig.NO_SMOOTH));
						model.smooths.push(newSmooth);
						model.grid[x][y][z].smooths.push(newSmooth);
					}
				}
			}
		}
	}
}
