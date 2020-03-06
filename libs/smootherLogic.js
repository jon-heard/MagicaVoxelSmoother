
const SmoothType = Object.freeze({ NONE: 1, VOXEL: 2, OUTLINE: 3, CORNER: 4, EMBED: 5, OUTBED: 6, SIDECORNER: 7 });
const CellState = Object.freeze({ INVALID: 1, BLANK: 2, VOXEL: 3, SMOOTH: 4 });
const CellConfig = Object.freeze({ NO_VOXEL: 1, NO_SMOOTH: 2, BLANK: 3 });

// Palette index equality: Wraps basic equality, allowing for chunks of indices considered "equal"
function palEq(cell1, cell2)
{
	if (!cell1 || !cell2)
	{
		return;
	}
	let c1 = cell1.color;
	let c2 = cell2.color;
	// Combine 228-239 into smooth clusters of 4: [228,229,230,231], [232,233,234,235], [236,237,238,239]
	if (c1 > 227 && c1 < 240)
	{
		c1 = Math.floor(c1 / 4) * 4
	}
	if (c2 > 227 && c2 < 240)
	{
		c2 = Math.floor(c2 / 4) * 4
	}

	if (c1 == c2)
	{
		return true;
	}
	else
	{
		return false;
	}
}

function getCellState(model, coords)
{
	// No voxel model available
	if (!model)
	{
		return CellState.INVALID;
	}

	if (coords[0] < 0 || coords[1] < 0 || coords[2] < 0)
	{
		return CellState.INVALID;
	}
	else if (coords[0] >= model.size[0] || coords[1] >= model.size[1] || coords[2] >= model.size[2])
	{
		return CellState.INVALID;
	}
	else
	{
		let c = model.grid[coords[0]][coords[1]][coords[2]];
		if (c instanceof Float32Array)
		{
			if (c.type == "voxel")
			{
				return CellState.VOXEL;
			}
			else if (c.type == "smooth")
			{
				return CellState.SMOOTH;
			}
		}
		else if (c instanceof Array)
		{
			return CellState.SMOOTH;
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
					model.grid[x][y].push(null);
				}
			}
		}

		// grid populate voxels
		for (let k = 0; k < model.voxels.length; k++)
		{
			const v = model.voxels[k];
			v.enabled = true;
			model.grid[ v[0] ][ v[1] ][ v[2] ] = v.color;
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

		// Clear old smooths
		for (let k = 0; k < model.smooths.length; k++)
		{
			const v = model.smooths[k];
			model.grid[ v[0] ][ v[1] ][ v[2] ] = null;
		}
		model.smooths = [];

		// Config-based voxel removal
		for (let k = 0; k < model.voxels.length; k++)
		{
			const v = model.voxels[k];
			if (configState.cellConfigs[JSON.stringify([v[0], v[1], v[2]])] == CellConfig.NO_VOXEL)
			{
				v.enabled = false;
				model.grid[ v[0] ][ v[1] ][ v[2] ] = null;
			}
			else
			{
				v.enabled = true;
				model.grid[ v[0] ][ v[1] ][ v[2] ] = v;
			}
		}

		// "culled" flag create
		for (let k = 0; k < model.voxels.length; k++)
		{
			const v = model.voxels[k];
			// Unculled if uncovered by voxel on ANY side
			let culled = true;
			     if (getCellState(model, [v[0]-1, v[1], v[2]]) != CellState.VOXEL) { culled = false; }
			else if (getCellState(model, [v[0], v[1]-1, v[2]]) != CellState.VOXEL) { culled = false; }
			else if (getCellState(model, [v[0], v[1], v[2]-1]) != CellState.VOXEL) { culled = false; }
			else if (getCellState(model, [v[0]+1, v[1], v[2]]) != CellState.VOXEL) { culled = false; }
			else if (getCellState(model, [v[0], v[1]+1, v[2]]) != CellState.VOXEL) { culled = false; }
			else if (getCellState(model, [v[0], v[1], v[2]+1]) != CellState.VOXEL) { culled = false; }
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

		// Calculate new smooths
		for (let x = 0; x < model.size[0]; x++)
		{
			for (let y = 0; y < model.size[1]; y++)
			{
				for (let z = 0; z < model.size[2]; z++)
				{
					// Only smooth empty grid spaces
					if (getCellState(model, [x, y, z]) != CellState.BLANK)
					{
						continue;
					}

					// Get adjacent cell states
					let a = [ null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null ];
					let hasAdjacent = false;
					if (getCellState(model, [x-1, y, z]) == CellState.VOXEL) { a[0] = model.grid[x-1][y][z]; hasAdjacent = true; }
					if (getCellState(model, [x, y-1, z]) == CellState.VOXEL) { a[1] = model.grid[x][y-1][z]; hasAdjacent = true; }
					if (getCellState(model, [x, y, z-1]) == CellState.VOXEL) { a[2] = model.grid[x][y][z-1]; hasAdjacent = true; }
					if (getCellState(model, [x+1, y, z]) == CellState.VOXEL) { a[3] = model.grid[x+1][y][z]; hasAdjacent = true; }
					if (getCellState(model, [x, y+1, z]) == CellState.VOXEL) { a[4] = model.grid[x][y+1][z]; hasAdjacent = true; }
					if (getCellState(model, [x, y, z+1]) == CellState.VOXEL) { a[5] = model.grid[x][y][z+1]; hasAdjacent = true; }
					if (getCellState(model, [x-1, y-1, z]) == CellState.VOXEL) { a[ 6] = model.grid[x-1][y-1][z]; hasAdjacent = true; }
					if (getCellState(model, [x-1, y, z-1]) == CellState.VOXEL) { a[ 7] = model.grid[x-1][y][z-1]; hasAdjacent = true; }
					if (getCellState(model, [x-1, y+1, z]) == CellState.VOXEL) { a[ 8] = model.grid[x-1][y+1][z]; hasAdjacent = true; }
					if (getCellState(model, [x-1, y, z+1]) == CellState.VOXEL) { a[ 9] = model.grid[x-1][y][z+1]; hasAdjacent = true; }
					if (getCellState(model, [x+1, y-1, z]) == CellState.VOXEL) { a[10] = model.grid[x+1][y-1][z]; hasAdjacent = true; }
					if (getCellState(model, [x+1, y, z-1]) == CellState.VOXEL) { a[11] = model.grid[x+1][y][z-1]; hasAdjacent = true; }
					if (getCellState(model, [x+1, y+1, z]) == CellState.VOXEL) { a[12] = model.grid[x+1][y+1][z]; hasAdjacent = true; }
					if (getCellState(model, [x+1, y, z+1]) == CellState.VOXEL) { a[13] = model.grid[x+1][y][z+1]; hasAdjacent = true; }
					if (getCellState(model, [x, y-1, z-1]) == CellState.VOXEL) { a[14] = model.grid[x][y-1][z-1]; hasAdjacent = true; }
					if (getCellState(model, [x, y-1, z+1]) == CellState.VOXEL) { a[15] = model.grid[x][y-1][z+1]; hasAdjacent = true; }
					if (getCellState(model, [x, y+1, z-1]) == CellState.VOXEL) { a[16] = model.grid[x][y+1][z-1]; hasAdjacent = true; }
					if (getCellState(model, [x, y+1, z+1]) == CellState.VOXEL) { a[17] = model.grid[x][y+1][z+1]; hasAdjacent = true; }

					// Only check cells with adjacencies
					if (!hasAdjacent)
					{
						continue;
					}

					// Find smooth patterns and record smooths
					while (true) // broken on no smooths found
					{
						let pattern = "";
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

						if (pattern != "")
						{
							let newSmooth = vec3.fromValues(x, y, z);
							newSmooth.type = "smooth";
							newSmooth.color = color;
							newSmooth.enabled = true;
							newSmooth.pattern = pattern;
							newSmooth.orientation = orient;
							model.smooths.push(newSmooth);
							let curCell = model.grid[x][y][z];
							if (curCell == null)
							{
								model.grid[x][y][z] = newSmooth;
							}
							else if (curCell instanceof Float32Array)
							{
								model.grid[x][y][z] = [];
								model.grid[x][y][z] = curCell;
							}
							else if (curCell instanceof Array)
							{
								model.grid[x][y][z].push(newSmooth);
							}
							if (configState.cellConfigs[JSON.stringify([x, y, z])] == CellConfig.NO_SMOOTH)
							{
								newSmooth.enabled = false;
							}
						}
					}
				}
			}
		}
	}
}
