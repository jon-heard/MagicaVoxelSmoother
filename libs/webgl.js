
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

	for (var i = 0; i < attributes.length; i++)
	{
		result.attributes[attributes[i]] = gl.getAttribLocation(shaderProgram, attributes[i]);
	}

	for (var i = 0; i < uniforms.length; i++)
	{
		result.uniforms[uniforms[i]] = gl.getUniformLocation(shaderProgram, uniforms[i]);
	}

	return result;
}

function renderMesh(gl, mesh, shader, color, modelViewMatrix)
{
	const normalMatrix = mat4.create();
	mat4.invert(normalMatrix, modelViewMatrix);
	mat4.transpose(normalMatrix, normalMatrix);

	gl.useProgram(shader.index);
	gl.uniformMatrix4fv(shader.uniforms.matProjection, false, gl.projectionMatrix);
	gl.uniformMatrix4fv(shader.uniforms.matModelView, false, modelViewMatrix);
	gl.uniformMatrix4fv(shader.uniforms.matNormal, false, normalMatrix);
	gl.uniform4fv(shader.uniforms.color, color);

	gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vertices);
	gl.vertexAttribPointer(shader.attributes.vertex, 3, gl.FLOAT, false, 0, 0);
	gl.enableVertexAttribArray(shader.attributes.vertex);

	gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normals);
	gl.vertexAttribPointer(shader.attributes.normal, 3, gl.FLOAT, false, 0, 0);
	gl.enableVertexAttribArray(shader.attributes.normal);

	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.faces);
	gl.drawElements(gl.TRIANGLES, mesh.elementCount, gl.UNSIGNED_SHORT, 0);
}
