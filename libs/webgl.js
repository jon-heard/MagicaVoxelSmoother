
const projectionYRadius = 45 * Math.PI/180;
const nearClipPlaneDistance = 0.1;
const farClipPlaneDistance = 1000;

function initWebgl(canvas, bgColor)
{
		const gl = canvas.getContext("webgl");
		if (gl === null)
		{
			return "Unable to initialize WebGL. Your browser or machine may not support it";
		}

		gl.clearColor(bgColor.r, bgColor.g, bgColor.b, 1.0);
		gl.clearDepth(1.0);
		gl.enable(gl.DEPTH_TEST);
		gl.depthFunc(gl.LEQUAL);
		gl.enable(gl.CULL_FACE);
		gl.clear(gl.COLOR_BUFFER_BIT);

		gl.projectionMatrix = mat4.create();

		return gl;
}

function createShader(gl, vSrc, fSrc, attributes, uniforms)
{
	const vShader = gl.createShader(gl.VERTEX_SHADER);
	gl.shaderSource(vShader, vSrc);
	gl.compileShader(vShader);
	if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS))
	{
		const result = "Unable to compile vertex shader: " + gl.getShaderInfoLog(vShader);
 		gl.deleteShader(vShader);
		return result;
	}

	const fShader = gl.createShader(gl.FRAGMENT_SHADER);
	gl.shaderSource(fShader, fSrc);
	gl.compileShader(fShader);
	if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS))
	{
		const result = "Unable to compile fragment shader: " + gl.getShaderInfoLog(fShader);
 		gl.deleteShader(vShader);
 		gl.deleteShader(fShader);
		return result;
	}

	const shaderProgram = gl.createProgram();
	gl.attachShader(shaderProgram, vShader);
	gl.attachShader(shaderProgram, fShader);
	gl.linkProgram(shaderProgram);
	if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS))
	{
		const result = "Unable to create shader: " + gl.getProgramInfoLog(shaderProgram);
 		gl.deleteShader(vShader);
 		gl.deleteShader(fShader);
		return result;
	}

	const result = { index: shaderProgram, attributes: {}, uniforms: {}};

	for (let i = 0; i < attributes.length; i++)
	{
		result.attributes[attributes[i]] = gl.getAttribLocation(shaderProgram, attributes[i]);
	}

	for (let i = 0; i < uniforms.length; i++)
	{
		result.uniforms[uniforms[i]] = gl.getUniformLocation(shaderProgram, uniforms[i]);
	}

	return result;
}

function renderMesh(gl, mesh, shader, color, modelViewMatrix, drawAsOutline)
{
	const hasNormals = shader.uniforms.hasOwnProperty("matNormal");
	const normalMatrix = mat4.create();
	if (hasNormals)
	{
		mat4.invert(normalMatrix, modelViewMatrix);
		mat4.transpose(normalMatrix, normalMatrix);
	}

	gl.useProgram(shader.index);
	gl.uniformMatrix4fv(shader.uniforms.matProjection, false, gl.projectionMatrix);
	gl.uniformMatrix4fv(shader.uniforms.matModelView, false, modelViewMatrix);
	if (hasNormals)
	{
		gl.uniformMatrix4fv(shader.uniforms.matNormal, false, normalMatrix);
	}
	gl.uniform3fv(shader.uniforms.color, color);

	gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vertices);
	gl.vertexAttribPointer(shader.attributes.vertex, 3, gl.FLOAT, false, 0, 0);
	gl.enableVertexAttribArray(shader.attributes.vertex);

	if (hasNormals)
	{
		gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normals);
		gl.vertexAttribPointer(shader.attributes.normal, 3, gl.FLOAT, false, 0, 0);
		gl.enableVertexAttribArray(shader.attributes.normal);
	}

	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.faces);
	gl.drawElements(drawAsOutline ? gl.LINE_STRIP : gl.TRIANGLES, mesh.elementCount, gl.UNSIGNED_SHORT, 0);
}

function updateViewPortAndProjectionMatrix(viewWidth, viewHeight)
{
	gl.viewport(0, 0, viewWidth, viewHeight);
	mat4.perspective(gl.projectionMatrix, projectionYRadius, viewWidth / viewHeight, nearClipPlaneDistance, farClipPlaneDistance);
}

function getRayFromScreenCoordinates(x, y)
{
	// Camera position
	const viewPos = getCamOrbitPosition();

	// lookat - Vector from camera to origin (what it's looking at) normalized
	const lookat = vec3.clone(viewPos);
	vec3.scale(lookat, lookat, -1);
	vec3.normalize(lookat, lookat);

	// Near-clip-plane axis directions
	const nearPlaneX = vec3.create();
		// Near-clip
		vec3.cross(nearPlaneX, [0,0,-1], lookat);
		vec3.normalize(nearPlaneX, nearPlaneX);
	const nearPlaneY = vec3.create();
		vec3.cross(nearPlaneY, lookat, nearPlaneX);
		vec3.normalize(nearPlaneY, nearPlaneY);

	// Near-clip-plane axis sizes
	// Y = angle-opposite (length of Y) divided by angle-adjacent (near-clip-distance) multiplied by angle-adjacent
	const nearPlaneYLength = Math.tan(projectionYRadius / 2) * nearClipPlaneDistance;
	// X = Y * canvas size ratio
	const nearPlaneXLength = nearPlaneYLength * (gl.canvas.width / gl.canvas.height);

	// Near-clip-plane axis directions and axis sizes
	vec3.scale(nearPlaneX, nearPlaneX, nearPlaneXLength);
	vec3.scale(nearPlaneY, nearPlaneY, nearPlaneYLength);

	// Screen size halved
	const screenHalfX = gl.canvas.width / 2;
	const screenHalfY = gl.canvas.height / 2;

	// Screen coordinates translated relative to center screen and then de-united (-1 to 1)
	x = (x - screenHalfX) / screenHalfX;
	y = (y - screenHalfY) / screenHalfY;

	// Ray's start is the view's position...
	const rayStart = vec3.clone(viewPos);
	// ...Plus the near-clip-distance down the lookat vector...
	vec3.scaleAndAdd(rayStart, rayStart, lookat, nearClipPlaneDistance);
	vec3.scaleAndAdd(rayStart, rayStart, nearPlaneX, x);
	vec3.scaleAndAdd(rayStart, rayStart, nearPlaneY, y);

	// Ray's direction is from camera's position to ray's start (ie. place on near plane mapped to mouse)
	const rayDir = vec3.create();
	vec3.subtract(rayDir, rayStart, viewPos);
	vec3.normalize(rayDir, rayDir);

	return { start: rayStart, dir: rayDir };
}
