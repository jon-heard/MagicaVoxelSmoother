
function meshToGl(gl, mesh)
{
	const result = { vertices: gl.createBuffer(), normals: gl.createBuffer(), faces: gl.createBuffer(), elementCount: mesh.faces.length, mesh: mesh };
	gl.bindBuffer(gl.ARRAY_BUFFER, result.vertices);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.vertices), gl.STATIC_DRAW);
	gl.bindBuffer(gl.ARRAY_BUFFER, result.normals);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.normals), gl.STATIC_DRAW);
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, result.faces);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(mesh.faces), gl.STATIC_DRAW);
	return result;
}

function createMesh_cube(size)
{
	size = (size ? size : 1) * 0.5;
	const result = {};
	result.vertices = [
		// Front face
		-size, -size, +size,
		+size, -size, +size,
		+size, +size, +size,
		-size, +size, +size,

		// Back face
		-size, -size, -size,
		-size, +size, -size,
		+size, +size, -size,
		+size, -size, -size,

		// Top face
		-size, +size, -size,
		-size, +size, +size,
		+size, +size, +size,
		+size, +size, -size,

		// Bottom face
		-size, -size, -size,
		+size, -size, -size,
		+size, -size, +size,
		-size, -size, +size,

		// Right face
		+size, -size, -size,
		+size, +size, -size,
		+size, +size, +size,
		+size, -size, +size,

		// Left face
		-size, -size, -size,
		-size, -size, +size,
		-size, +size, +size,
		-size, +size, -size,
	];
	result.normals = [
		// Front
		 0.0,  0.0,  1.0,
		 0.0,  0.0,  1.0,
		 0.0,  0.0,  1.0,
		 0.0,  0.0,  1.0,

		// Back
		 0.0,  0.0, -1.0,
		 0.0,  0.0, -1.0,
		 0.0,  0.0, -1.0,
		 0.0,  0.0, -1.0,

		// Top
		 0.0,  1.0,  0.0,
		 0.0,  1.0,  0.0,
		 0.0,  1.0,  0.0,
		 0.0,  1.0,  0.0,

		// Bottom
		 0.0, -1.0,  0.0,
		 0.0, -1.0,  0.0,
		 0.0, -1.0,  0.0,
		 0.0, -1.0,  0.0,

		// Right
		 1.0,  0.0,  0.0,
		 1.0,  0.0,  0.0,
		 1.0,  0.0,  0.0,
		 1.0,  0.0,  0.0,

		// Left
		-1.0,  0.0,  0.0,
		-1.0,  0.0,  0.0,
		-1.0,  0.0,  0.0,
		-1.0,  0.0,  0.0
	];
	result.faces = [
		0,  1,  2,    0,  2,  3,	// front
		4,  5,  6,    4,  6,  7,	// back
		8,  9,  10,   8,  10, 11,	// top
		12, 13, 14,   12, 14, 15,	// bottom
		16, 17, 18,   16, 18, 19,	// right
		20, 21, 22,   20, 22, 23,	// left
	];
	return result;
}

function createMesh_cubeOutline(size)
{
	size = (size ? size : 1) * 0.5;
	const result = {};
	result.vertices = [
		// Front face
		+size, +size, -size,
		+size, +size, +size,
		-size, +size, +size,
		-size, +size, -size,
		+size, -size, -size,
		+size, -size, +size,
		-size, -size, +size,
		-size, -size, -size,
	];
	result.normals = [
		// Front
		 1.0,  0.0,  0.0,
		 1.0,  0.0,  0.0,
		 1.0,  0.0,  0.0,
		 1.0,  0.0,  0.0,
		 1.0,  0.0,  0.0,
		 1.0,  0.0,  0.0,
		 1.0,  0.0,  0.0,
		 1.0,  0.0,  0.0,
	];
	result.faces = [0, 1, 2, 3, 7, 6, 5, 4, 0, 3, 7, 4, 5, 1, 2, 6];
	return result;
}

function createMesh_corner(gl, size)
{
	size = (size ? size : 1) * 0.5;
	const result = {};
	result.vertices = [
		// Front
		-size, -size, +size,
		+size, -size, +size,
		+size, +size, -size,
		-size, +size, -size,

		// Side 1
		-size, -size, +size,
		-size, +size, -size,
		-size, -size, -size,

		// Side 2
		+size, -size, +size,
		+size, -size, -size,
		+size, +size, -size,
	];
	result.normals = [
		// Front
		 0.0,  0.707107,  0.707107,
		 0.0,  0.707107,  0.707107,
		 0.0,  0.707107,  0.707107,
		 0.0,  0.707107,  0.707107,

		// Side 1
		 -1.0,  0.0,  0.0,
		 -1.0,  0.0,  0.0,
		 -1.0,  0.0,  0.0,

		// Side 2
		 1.0,  0.0,  0.0,
		 1.0,  0.0,  0.0,
		 1.0,  0.0,  0.0,
	];
	result.faces = [
		0,  1,  2,    0,  2,  3,	// front
		4,  5,  6,    7,  8,  9,	// sides
	];
	return result;
}

function createMesh_embed(gl, size)
{
	size = (size ? size : 1) * 0.5;
	const result = {};
	result.vertices = [
		// Front
		-size, +size, +size,
		+size, -size, +size,
		+size, +size, -size,

		// Side 1
		+size, -size, +size,
		+size, -size, -size,
		+size, +size, -size,

		// Side 2
		-size, +size, +size,
		+size, +size, -size,
		-size, +size, -size,

		// Side 3
		-size, +size, +size,
		-size, -size, +size,
		+size, -size, +size,
	];
	result.normals = [
		// Front
		 0.577350,  0.577350,  0.577350,
		 0.577350,  0.577350,  0.577350,
		 0.577350,  0.577350,  0.577350,

		// Side 1
		 1.0,  0.0,  0.0,
		 1.0,  0.0,  0.0,
		 1.0,  0.0,  0.0,

		// Side 2
		 0.0,  1.0,  0.0,
		 0.0,  1.0,  0.0,
		 0.0,  1.0,  0.0,

		// Side 3
		 0.0,  0.0,  1.0,
		 0.0,  0.0,  1.0,
		 0.0,  0.0,  1.0,
	];
	result.faces = [
		0,  1,  2,	// front
		3,  4,  5,	// side 1
		6,  7,  8,	// side 2
		9, 10, 11,	// side 3
	];
	return result;
}

function createMesh_outbed(gl, size)
{
	size = (size ? size : 1) * 0.5;
	const result = {};
	result.vertices = [
		// Front
		-size, -size, +size,
		+size, -size, -size,
		-size, +size, -size,
	];
	result.normals = [
		// Front
		 0.577350,  0.577350,  0.577350,
		 0.577350,  0.577350,  0.577350,
		 0.577350,  0.577350,  0.577350,

	];
	result.faces = [
		0,  1,  2,	// front
	];
	return result;
}

function createMesh_sideCorner(gl, size)
{
	size = (size ? size : 1) * 0.5;
	const result = {};
	result.vertices = [
		// Front
		-size, -size, +size,
		-size, -size, -size,
		+size, +size, +size,

		// Back
		+size, +size, +size,
		-size, +size, -size,
		-size, +size, +size,

		// Bottom
		+size, +size, +size,
		-size, -size, -size,
		-size, +size, -size,
	];
	result.normals = [
		// Front
		 0.707107,  -0.707107,  0.0,
		 0.707107,  -0.707107,  0.0,
		 0.707107,  -0.707107,  0.0,

		// Back
		 0.0,  1.0,  0.0,
		 0.0,  1.0,  0.0,
		 0.0,  1.0,  0.0,

		// Bottom
		 0.707107,  0.0,  -0.707107,
		 0.707107,  0.0,  -0.707107,
		 0.707107,  0.0,  -0.707107,
	];
	result.faces = [
		0,  1,  2,	// front
		3,  4,  5,	// back
		6,  7,  8,	// bottom
	];
	return result;
}
