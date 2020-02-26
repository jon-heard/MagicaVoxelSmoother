
const SmoothType = Object.freeze({ NONE: 1, ORIGINAL: 2, CORNER: 3, EMBED: 4, OUTBED: 5, SIDECORNER: 6 });
const CellState = Object.freeze({ INVALID: 1, BLANK: 2, ORIGINAL: 3, SMOOTH: 4 });
const CellConfig = Object.freeze({ NOORIGINAL: 1, NOSMOOTH: 2, BLANK: 3 });

let smootherConfig = { cellConfigs: {}, paletteFile: null, useBuggySmoothing: false };

// TMP: hardcoding smoother config
let nonGnomeSmootherConfig = { cellConfigs: {}, paletteFile: null, useBuggySmoothing: false };
let gnomeSmootherConfig = { cellConfigs: {}, paletteFile: null, useBuggySmoothing: true };
// Shoulders
gnomeSmootherConfig.cellConfigs[JSON.stringify([ 2, 4, 4 ])] = CellConfig.NOORIGINAL;
gnomeSmootherConfig.cellConfigs[JSON.stringify([ 6, 4, 4 ])] = CellConfig.NOORIGINAL;
// Front-right side
gnomeSmootherConfig.cellConfigs[JSON.stringify([ 3, 3, 4 ])] = CellConfig.NOORIGINAL;
gnomeSmootherConfig.cellConfigs[JSON.stringify([ 3, 3, 3 ])] = CellConfig.NOORIGINAL;
gnomeSmootherConfig.cellConfigs[JSON.stringify([ 3, 3, 2 ])] = CellConfig.NOORIGINAL;
// Front-left side
gnomeSmootherConfig.cellConfigs[JSON.stringify([ 5, 3, 4 ])] = CellConfig.NOORIGINAL;
gnomeSmootherConfig.cellConfigs[JSON.stringify([ 5, 3, 3 ])] = CellConfig.NOORIGINAL;
gnomeSmootherConfig.cellConfigs[JSON.stringify([ 5, 3, 2 ])] = CellConfig.NOORIGINAL;
// Back-right side
gnomeSmootherConfig.cellConfigs[JSON.stringify([ 3, 5, 4 ])] = CellConfig.NOORIGINAL;
gnomeSmootherConfig.cellConfigs[JSON.stringify([ 3, 5, 3 ])] = CellConfig.NOORIGINAL;
gnomeSmootherConfig.cellConfigs[JSON.stringify([ 3, 5, 2 ])] = CellConfig.NOORIGINAL;
// Back-left side
gnomeSmootherConfig.cellConfigs[JSON.stringify([ 5, 5, 4 ])] = CellConfig.NOORIGINAL;
gnomeSmootherConfig.cellConfigs[JSON.stringify([ 5, 5, 3 ])] = CellConfig.NOORIGINAL;
gnomeSmootherConfig.cellConfigs[JSON.stringify([ 5, 5, 2 ])] = CellConfig.NOORIGINAL;
// Nose
gnomeSmootherConfig.cellConfigs[JSON.stringify([ 5, 2, 6 ])] = CellConfig.NOSMOOTH;
gnomeSmootherConfig.cellConfigs[JSON.stringify([ 5, 2, 7 ])] = CellConfig.NOSMOOTH;
gnomeSmootherConfig.cellConfigs[JSON.stringify([ 3, 2, 6 ])] = CellConfig.NOSMOOTH;
gnomeSmootherConfig.cellConfigs[JSON.stringify([ 3, 2, 7 ])] = CellConfig.NOSMOOTH;


// Palette index equality: Wraps basic equality, allowing for chunks of indices considered "equal"
function palEq(v1, v2)
{
	// Combine 228-239 into smoothing clusters of 4: [228,229,230,231], [232,233,234,235], [236,237,238,239]
	if (v1 > 227 && v1 < 240)
	{
		v1 = Math.floor(v1 / 4) * 4
	}
	if (v2 > 227 && v2 < 240)
	{
		v2 = Math.floor(v2 / 4) * 4
	}

	if (v1 == v2)
	{
		return true;
	}
	else
	{
		return false;
	}
}

function getCellState(data, x, y, z)
{
	// Handle passing object with x,y,z
	if (isNaN(x))
	{
		y = x.y;
		z = x.z;
		x = x.x;
	}

	// No voxel model available
	if (!data || !data.models || data.models.length < 1)
	{
		return CellState.INVALID;
	}

	let model = data.models[0];

	if (x < 0 || y < 0 || z < 0)
	{
		return CellState.INVALID;
	}
	else if (x >= model.size.x || y >= model.size.y || z >= model.size.z)
	{
		return CellState.INVALID;
	}
	else if (isNaN(model.grid[x][y][z]))
	{
		return CellState.SMOOTH;
	}
	else if (model.grid[x][y][z] == -1)
	{
		return CellState.BLANK;
	}
	else
	{
		return CellState.ORIGINAL;
	}
}

function smoother_processVoxData(data)
{
	// TMP: hardcoding smoother config
	smootherConfig = document.getElementById("fileSelect").files[0].name == "gnome_relaxed_01.vox" ? gnomeSmootherConfig : nonGnomeSmootherConfig;

	for (let i = 0; i < data.models.length; i++)
	{
		const model = data.models[i];

		// Center offset create
		model.centerOffset = {};
		model.centerOffset.x = model.size.x * 0.5 - 0.5;
		model.centerOffset.y = model.size.y * 0.5 - 0.5;
		model.centerOffset.z = model.size.z * 0.5 - 0.5;

		// grid create
		model.grid = [];
		for (let x = 0; x < model.size.x; x++)
		{
			model.grid.push([]);
			for (let y = 0; y < model.size.y; y++)
			{
				model.grid[x].push([]);
				for (let z = 0; z < model.size.z; z++)
				{
					model.grid[x][y].push(-1);
				}
			}
		}

		// grid populate && disabled voxels
		for (let k = 0; k < model.voxels.length; k++)
		{
			const v = model.voxels[k];
			if (smootherConfig.cellConfigs[JSON.stringify([v.x, v.y, v.z])] == CellConfig.NOORIGINAL)
			{
				v.enabled = false;
			}
			else
			{
				v.enabled = true;
				model.grid[ v.x ][ v.y ][ v.z ] = v.color;
			}
		}

		// smooth voxel calculation
		model.smoothVoxels = [];
		for (let x = 0; x < model.size.x; x++)
		{
			for (let y = 0; y < model.size.y; y++)
			{
				for (let z = 0; z < model.size.z; z++)
				{
					// Only smooth empty grid spaces
					if (getCellState(data, x, y, z) != CellState.BLANK)
					{
						continue;
					}

					// Get adjacent cell states
					let a = [ -1, -1, -1, -1, -1, -1,   -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ];
					let hasAdjacent = false;
					if (getCellState(data, x-1, y, z) == CellState.ORIGINAL) { a[0] = model.grid[x-1][y][z]; hasAdjacent = true; }
					if (getCellState(data, x, y-1, z) == CellState.ORIGINAL) { a[1] = model.grid[x][y-1][z]; hasAdjacent = true; }
					if (getCellState(data, x, y, z-1) == CellState.ORIGINAL) { a[2] = model.grid[x][y][z-1]; hasAdjacent = true; }
					if (getCellState(data, x+1, y, z) == CellState.ORIGINAL) { a[3] = model.grid[x+1][y][z]; hasAdjacent = true; }
					if (getCellState(data, x, y+1, z) == CellState.ORIGINAL) { a[4] = model.grid[x][y+1][z]; hasAdjacent = true; }
					if (getCellState(data, x, y, z+1) == CellState.ORIGINAL) { a[5] = model.grid[x][y][z+1]; hasAdjacent = true; }
					if (getCellState(data, x-1, y-1, z) == CellState.ORIGINAL) { a[ 6] = model.grid[x-1][y-1][z]; hasAdjacent = true; }
					if (getCellState(data, x-1, y, z-1) == CellState.ORIGINAL) { a[ 7] = model.grid[x-1][y][z-1]; hasAdjacent = true; }
					if (getCellState(data, x-1, y+1, z) == CellState.ORIGINAL) { a[ 8] = model.grid[x-1][y+1][z]; hasAdjacent = true; }
					if (getCellState(data, x-1, y, z+1) == CellState.ORIGINAL) { a[ 9] = model.grid[x-1][y][z+1]; hasAdjacent = true; }
					if (getCellState(data, x+1, y-1, z) == CellState.ORIGINAL) { a[10] = model.grid[x+1][y-1][z]; hasAdjacent = true; }
					if (getCellState(data, x+1, y, z-1) == CellState.ORIGINAL) { a[11] = model.grid[x+1][y][z-1]; hasAdjacent = true; }
					if (getCellState(data, x+1, y+1, z) == CellState.ORIGINAL) { a[12] = model.grid[x+1][y+1][z]; hasAdjacent = true; }
					if (getCellState(data, x+1, y, z+1) == CellState.ORIGINAL) { a[13] = model.grid[x+1][y][z+1]; hasAdjacent = true; }
					if (getCellState(data, x, y-1, z-1) == CellState.ORIGINAL) { a[14] = model.grid[x][y-1][z-1]; hasAdjacent = true; }
					if (getCellState(data, x, y-1, z+1) == CellState.ORIGINAL) { a[15] = model.grid[x][y-1][z+1]; hasAdjacent = true; }
					if (getCellState(data, x, y+1, z-1) == CellState.ORIGINAL) { a[16] = model.grid[x][y+1][z-1]; hasAdjacent = true; }
					if (getCellState(data, x, y+1, z+1) == CellState.ORIGINAL) { a[17] = model.grid[x][y+1][z+1]; hasAdjacent = true; }

					// Only check cells with adjacencies
					if (!hasAdjacent)
					{
						continue;
					}

					// Find smoothing patterns and record smoothing voxels
					while (true) // broken on no smoothing found
					{
						let pattern = "";
						let color = -1;
						let orient = 0;
						     if (a[ 0] != -1 && palEq(a[0], a[1]) && !palEq(a[0], a[2]) && !palEq(a[0], a[3]) && !palEq(a[0], a[4]) && !palEq(a[0], a[5])) { color = a[0]; pattern = SmoothType.CORNER; orient =  4; a[0] = a[1] = -1; }
						else if (a[ 0] != -1 && palEq(a[0], a[2]) && !palEq(a[0], a[1]) && !palEq(a[0], a[3]) && !palEq(a[0], a[4]) && !palEq(a[0], a[5])) { color = a[0]; pattern = SmoothType.CORNER; orient =  3; a[0] = a[2] = -1; }
						else if (a[ 0] != -1 && palEq(a[0], a[4]) && !palEq(a[0], a[1]) && !palEq(a[0], a[2]) && !palEq(a[0], a[3]) && !palEq(a[0], a[5])) { color = a[0]; pattern = SmoothType.CORNER; orient = 10; a[0] = a[4] = -1; }
						else if (a[ 0] != -1 && palEq(a[0], a[5]) && !palEq(a[0], a[1]) && !palEq(a[0], a[2]) && !palEq(a[0], a[3]) && !palEq(a[0], a[4])) { color = a[0]; pattern = SmoothType.CORNER; orient =  7; a[0] = a[5] = -1; }
						else if (a[ 1] != -1 && palEq(a[1], a[2]) && !palEq(a[1], a[0]) && !palEq(a[1], a[3]) && !palEq(a[1], a[4]) && !palEq(a[1], a[5])) { color = a[1]; pattern = SmoothType.CORNER; orient =  0; a[1] = a[2] = -1; }
						else if (a[ 1] != -1 && palEq(a[1], a[3]) && !palEq(a[1], a[0]) && !palEq(a[1], a[2]) && !palEq(a[1], a[4]) && !palEq(a[1], a[5])) { color = a[1]; pattern = SmoothType.CORNER; orient =  5; a[1] = a[3] = -1; }
						else if (a[ 1] != -1 && palEq(a[1], a[5]) && !palEq(a[1], a[0]) && !palEq(a[1], a[2]) && !palEq(a[1], a[3]) && !palEq(a[1], a[4])) { color = a[1]; pattern = SmoothType.CORNER; orient =  6; a[1] = a[5] = -1; }
						else if (a[ 2] != -1 && palEq(a[2], a[3]) && !palEq(a[2], a[0]) && !palEq(a[2], a[1]) && !palEq(a[2], a[4]) && !palEq(a[2], a[5])) { color = a[2]; pattern = SmoothType.CORNER; orient =  2; a[2] = a[3] = -1; }
						else if (a[ 2] != -1 && palEq(a[2], a[4]) && !palEq(a[2], a[0]) && !palEq(a[2], a[1]) && !palEq(a[2], a[3]) && !palEq(a[2], a[5])) { color = a[2]; pattern = SmoothType.CORNER; orient =  1; a[2] = a[4] = -1; }
						else if (a[ 3] != -1 && palEq(a[3], a[4]) && !palEq(a[3], a[0]) && !palEq(a[3], a[1]) && !palEq(a[3], a[2]) && !palEq(a[3], a[5])) { color = a[3]; pattern = SmoothType.CORNER; orient = 11; a[3] = a[4] = -1; }
						else if (a[ 3] != -1 && palEq(a[3], a[5]) && !palEq(a[3], a[0]) && !palEq(a[3], a[1]) && !palEq(a[3], a[2]) && !palEq(a[3], a[4])) { color = a[3]; pattern = SmoothType.CORNER; orient =  8; a[3] = a[5] = -1; }
						else if (a[ 4] != -1 && palEq(a[4], a[5]) && !palEq(a[4], a[0]) && !palEq(a[4], a[1]) && !palEq(a[4], a[2]) && !palEq(a[4], a[3])) { color = a[4]; pattern = SmoothType.CORNER; orient =  9; a[4] = a[5] = -1; }

						else if (a[ 0] != -1 && palEq(a[0], a[1]) && palEq(a[0], a[2]) && !palEq(a[0], a[3]) && !palEq(a[0], a[4]) && !palEq(a[0], a[5])) { color = a[0]; pattern = SmoothType.EMBED; orient = 0; a[0] = a[1] = a[2] = -1; }
						else if (a[ 1] != -1 && palEq(a[1], a[2]) && palEq(a[1], a[3]) && !palEq(a[1], a[0]) && !palEq(a[1], a[4]) && !palEq(a[1], a[5])) { color = a[1]; pattern = SmoothType.EMBED; orient = 2; a[1] = a[2] = a[3] = -1; }
						else if (a[ 0] != -1 && palEq(a[0], a[2]) && palEq(a[0], a[4]) && !palEq(a[0], a[1]) && !palEq(a[0], a[3]) && !palEq(a[0], a[5])) { color = a[0]; pattern = SmoothType.EMBED; orient = 3; a[0] = a[2] = a[4] = -1; }
						else if (a[ 2] != -1 && palEq(a[2], a[3]) && palEq(a[2], a[4]) && !palEq(a[2], a[0]) && !palEq(a[2], a[1]) && !palEq(a[2], a[5])) { color = a[2]; pattern = SmoothType.EMBED; orient = 1; a[2] = a[3] = a[4] = -1; }
						else if (a[ 0] != -1 && palEq(a[0], a[4]) && palEq(a[0], a[5]) && !palEq(a[0], a[1]) && !palEq(a[0], a[2]) && !palEq(a[0], a[3])) { color = a[0]; pattern = SmoothType.EMBED; orient = 9; a[0] = a[4] = a[5] = -1; }
						else if (a[ 1] != -1 && palEq(a[1], a[3]) && palEq(a[1], a[5]) && !palEq(a[1], a[0]) && !palEq(a[1], a[2]) && !palEq(a[1], a[4])) { color = a[1]; pattern = SmoothType.EMBED; orient = 6; a[1] = a[3] = a[5] = -1; }
						else if (a[ 0] != -1 && palEq(a[0], a[1]) && palEq(a[0], a[5]) && !palEq(a[0], a[2]) && !palEq(a[0], a[3]) && !palEq(a[0], a[4])) { color = a[0]; pattern = SmoothType.EMBED; orient = 7; a[0] = a[1] = a[5] = -1; }
						else if (a[ 4] != -1 && palEq(a[4], a[3]) && palEq(a[4], a[5]) && !palEq(a[4], a[0]) && !palEq(a[4], a[1]) && !palEq(a[4], a[2])) { color = a[4]; pattern = SmoothType.EMBED; orient = 8; a[4] = a[3] = a[5] = -1; }

						else if (a[ 6] != -1 && palEq(a[ 6], a[ 7]) && palEq(a[ 6], a[14]) && !palEq(a[ 6], a[ 8]) && !palEq(a[ 6], a[ 9]) && !palEq(a[ 6], a[10]) && !palEq(a[ 6], a[11]) && !palEq(a[ 6], a[12]) && !palEq(a[ 6], a[13]) && !palEq(a[ 6], a[15]) && !palEq(a[ 6], a[16]) && !palEq(a[ 6], a[17])) { color = a[ 6]; pattern = SmoothType.OUTBED; orient = 0; a[06] = a[07] = a[14] = -1; }
						else if (a[ 6] != -1 && palEq(a[ 6], a[ 9]) && palEq(a[ 6], a[15]) && !palEq(a[ 6], a[ 7]) && !palEq(a[ 6], a[ 8]) && !palEq(a[ 6], a[10]) && !palEq(a[ 6], a[11]) && !palEq(a[ 6], a[12]) && !palEq(a[ 6], a[13]) && !palEq(a[ 6], a[14]) && !palEq(a[ 6], a[16]) && !palEq(a[ 6], a[17])) { color = a[ 6]; pattern = SmoothType.OUTBED; orient = 4; a[06] = a[09] = a[15] = -1; }
						else if (a[ 7] != -1 && palEq(a[ 7], a[ 8]) && palEq(a[ 7], a[16]) && !palEq(a[ 7], a[ 6]) && !palEq(a[ 7], a[ 9]) && !palEq(a[ 7], a[10]) && !palEq(a[ 7], a[11]) && !palEq(a[ 7], a[12]) && !palEq(a[ 7], a[13]) && !palEq(a[ 7], a[14]) && !palEq(a[ 7], a[15]) && !palEq(a[ 7], a[17])) { color = a[ 7]; pattern = SmoothType.OUTBED; orient = 3; a[07] = a[08] = a[16] = -1; }
						else if (a[ 8] != -1 && palEq(a[ 8], a[ 9]) && palEq(a[ 8], a[17]) && !palEq(a[ 8], a[ 6]) && !palEq(a[ 8], a[ 7]) && !palEq(a[ 8], a[10]) && !palEq(a[ 8], a[11]) && !palEq(a[ 8], a[12]) && !palEq(a[ 8], a[13]) && !palEq(a[ 8], a[14]) && !palEq(a[ 8], a[15]) && !palEq(a[ 8], a[16])) { color = a[ 8]; pattern = SmoothType.OUTBED; orient = 9; a[08] = a[09] = a[17] = -1; }
						else if (a[10] != -1 && palEq(a[10], a[11]) && palEq(a[10], a[14]) && !palEq(a[10], a[ 6]) && !palEq(a[10], a[ 7]) && !palEq(a[10], a[ 8]) && !palEq(a[10], a[ 9]) && !palEq(a[10], a[12]) && !palEq(a[10], a[13]) && !palEq(a[10], a[15]) && !palEq(a[10], a[16]) && !palEq(a[10], a[17])) { color = a[10]; pattern = SmoothType.OUTBED; orient = 2; a[10] = a[11] = a[14] = -1; }
						else if (a[10] != -1 && palEq(a[10], a[13]) && palEq(a[10], a[15]) && !palEq(a[10], a[ 6]) && !palEq(a[10], a[ 7]) && !palEq(a[10], a[ 8]) && !palEq(a[10], a[ 9]) && !palEq(a[10], a[11]) && !palEq(a[10], a[12]) && !palEq(a[10], a[14]) && !palEq(a[10], a[16]) && !palEq(a[10], a[17])) { color = a[10]; pattern = SmoothType.OUTBED; orient = 6; a[10] = a[13] = a[15] = -1; }
						else if (a[11] != -1 && palEq(a[11], a[12]) && palEq(a[11], a[16]) && !palEq(a[11], a[ 6]) && !palEq(a[11], a[ 7]) && !palEq(a[11], a[ 8]) && !palEq(a[11], a[ 9]) && !palEq(a[11], a[10]) && !palEq(a[11], a[13]) && !palEq(a[11], a[14]) && !palEq(a[11], a[15]) && !palEq(a[11], a[17])) { color = a[11]; pattern = SmoothType.OUTBED; orient = 1; a[11] = a[12] = a[16] = -1; }
						else if (a[12] != -1 && palEq(a[12], a[13]) && palEq(a[12], a[17]) && !palEq(a[12], a[ 6]) && !palEq(a[12], a[ 7]) && !palEq(a[12], a[ 8]) && !palEq(a[12], a[ 9]) && !palEq(a[12], a[10]) && !palEq(a[12], a[11]) && !palEq(a[12], a[14]) && !palEq(a[12], a[15]) && !palEq(a[12], a[16])) { color = a[12]; pattern = SmoothType.OUTBED; orient = 8; a[12] = a[13] = a[17] = -1; }

						else if (smootherConfig.useBuggySmoothing && a[ 9] != -1 && palEq(a[ 0], a[ 9]) && palEq(a[ 9], a[17])) { color = a[ 9]; pattern = SmoothType.SIDECORNER; orient = 0; a[0] = a[9] = a[17] = -1; }
						else if (smootherConfig.useBuggySmoothing && a[13] != -1 && palEq(a[ 3], a[13]) && palEq(a[13], a[17])) { color = a[13]; pattern = SmoothType.SIDECORNER; orient = 12; a[3] = a[13] = a[17] = -1; }

						else { break; }

						if (pattern != "")
						{
							let newSmooth = { x: x, y: y, z: z, color: color, enabled: true, culled: false, pattern: pattern, orientation: orient };
							if (smootherConfig.cellConfigs[JSON.stringify([x, y, z])] == CellConfig.NOSMOOTH)
							{
								newSmooth.enabled = false;
							}
							model.smoothVoxels.push(newSmooth);
							model.grid[x][y][z] = newSmooth;
						}
					}
				}
			}
		}

		// "culled" flag create
		for (let k = 0; k < model.voxels.length; k++)
		{
			const v = model.voxels[k];
			// Unculled if uncovered by 'original' voxel on ANY side
			let culled = true;
				 if (getCellState(data, v.x-1, v.y, v.z) != CellState.ORIGINAL) { culled = false; }
			else if (getCellState(data, v.x, v.y-1, v.z) != CellState.ORIGINAL) { culled = false; }
			else if (getCellState(data, v.x, v.y, v.z-1) != CellState.ORIGINAL) { culled = false; }
			else if (getCellState(data, v.x+1, v.y, v.z) != CellState.ORIGINAL) { culled = false; }
			else if (getCellState(data, v.x, v.y+1, v.z) != CellState.ORIGINAL) { culled = false; }
			else if (getCellState(data, v.x, v.y, v.z+1) != CellState.ORIGINAL) { culled = false; }
			v.culled = culled;
		}
	}
	for (let i = 0; i < data.palette.length; i++)
	{
		data.palette[i].r /= 255;
		data.palette[i].g /= 255;
		data.palette[i].b /= 255;
		data.palette[i].a /= 255;
	}
}
