
	let gl;
	let showSmoothUi;
	let shaders = {};
	const meshes = {};

	// Each browser resize requires viewport recalculation
	function onResize()
	{
		// Set canvas position (in the web document)
		//   HACK: Flex-defined sizes are incompatible with updating canvas size (dynamically) to match.
		//     Instead, 'viewSpace' div is positioned by flex while canvas is dynamically placed to match.
		let viewSpace = document.getElementById("viewSpace");
		gl.canvas.style.left = viewSpace.offsetLeft;
		gl.canvas.style.top = viewSpace.offsetTop;
		gl.canvas.width = viewSpace.clientWidth;
		gl.canvas.height = viewSpace.clientHeight;

		updateViewPortAndProjectionMatrix(gl.canvas.width, gl.canvas.height);
	}

	function getOrientationMatrix(index)
	{
		const result = mat4.create();
		switch (index)
		{
			case  1: mat4.rotate(result, result, 180*Math.PI/180, [0, 0, 1]); break;
			case  2: mat4.rotate(result, result, 90*Math.PI/180, [0, 0, 1]); break;
			case  3: mat4.rotate(result, result, -90*Math.PI/180, [0, 0, 1]); break;
			case  4: mat4.rotate(result, result, 90*Math.PI/180, [0, 1, 0]); break;
			case  5: mat4.rotate(result, result, -90*Math.PI/180, [0, 1, 0]); break;
			case  6: mat4.rotate(result, result, 180*Math.PI/180, [0, 1, 0]); break;
			case  7: mat4.rotate(result, result, 180*Math.PI/180, [0, 1, 0]); mat4.rotate(result, result, 90*Math.PI/180, [0, 0, 1]); break;
			case  8: mat4.rotate(result, result, 180*Math.PI/180, [0, 1, 0]); mat4.rotate(result, result, -90*Math.PI/180, [0, 0, 1]); break;
			case  9: mat4.rotate(result, result, 180*Math.PI/180, [0, 1, 0]); mat4.rotate(result, result, 180*Math.PI/180, [0, 0, 1]); break;
			case 10: mat4.rotate(result, result, 90*Math.PI/180, [0, 1, 0]); mat4.rotate(result, result, 180*Math.PI/180, [0, 0, 1]); break;
			case 11: mat4.rotate(result, result, -90*Math.PI/180, [0, 1, 0]); mat4.rotate(result, result, 180*Math.PI/180, [0, 0, 1]); break;
			case 12: mat4.scale(result, result, [-1, 1, 1]); break;
		}
		return result;
	}

	// Init webgl
	function initRendering()
	{
		// WebGL
		gl = initWebgl(document.getElementById("view"), { r: 0.15, g: 0.15, b: 0.15 });
		if (typeof(gl) === "string")
		{
			return onFatalError(gl);
		}

		// Shaders
		const shaderSrc_v = `
			attribute vec4 vertex;
			attribute vec3 normal;
			uniform mat4 matProjection;
			uniform mat4 matModelView;
			uniform mat4 matNormal;
			uniform vec3 color;
			varying lowp vec3 varyingColor;
			void main()
			{
				gl_Position = matProjection * matModelView * vertex;

				vec4 transformedNormal = matNormal * vec4(normal, 1.0);
				float lighting = max(dot(transformedNormal.xyz, vec3(0.0, 0.0, 1.0)), 0.0);
				varyingColor = color * lighting;
			}
		`;
		const shaderSrc_f = `
			varying lowp vec3 varyingColor;
			void main()
			{
				gl_FragColor = vec4(varyingColor, 1.0);
			}
		`;
		const shaderSrcOutline_v = `
			attribute vec4 vertex;
			uniform mat4 matProjection;
			uniform mat4 matModelView;
			uniform vec3 color;
			varying lowp vec3 varyingColor;
			varying lowp vec3 varyingPosition;
			void main()
			{
				gl_Position = matProjection * matModelView * vertex;
				varyingColor = color;
				varyingPosition = gl_Position.xyz;
			}
		`;
		const shaderSrcHighlight_f = `
			varying lowp vec3 varyingColor;
			varying lowp vec3 varyingPosition;
			void main()
			{
				lowp vec3 pos = varyingPosition * 10.0;
				lowp float chessboard = floor(pos.x) + floor(pos.y) + floor(pos.z);
				chessboard = fract(chessboard * 0.5);
				if (chessboard != 0.0)
				{
					gl_FragColor = vec4(varyingColor * 1.25, 1.0);
				}
				else
				{
					gl_FragColor = vec4(varyingColor * 0.6, 1.0);
				}
			}
		`;
		shaders.main = createShader(gl, shaderSrc_v, shaderSrc_f, ["vertex", "normal"], ["matModelView", "matProjection", "matNormal", "color"]);
		if (typeof(shaders.main) === "string")
		{
			return onFatalError(shaders.main);
		}
		shaders.outline = createShader(gl, shaderSrcOutline_v, shaderSrc_f, ["vertex"], ["matModelView", "matProjection", "color"]);
		if (typeof(shaders.outline) === "string")
		{
			return onFatalError(shaders.outline);
		}
		shaders.highlight = createShader(gl, shaderSrcOutline_v, shaderSrcHighlight_f, ["vertex"], ["matModelView", "matProjection", "color"]);
		if (typeof(shaders.highlight) === "string")
		{
			return onFatalError(shaders.highlight);
		}

		// Meshes
		meshes[SmoothType.VOXEL] = meshToGl(gl, createMesh_cube());
		meshes[SmoothType.OUTLINE] = meshToGl(gl, createMesh_cubeOutline());
		meshes[SmoothType.CORNER] = meshToGl(gl, createMesh_corner());
		meshes[SmoothType.EMBED] = meshToGl(gl, createMesh_embed());
		meshes[SmoothType.OUTBED] = meshToGl(gl, createMesh_outbed());
		meshes[SmoothType.SIDECORNER] = meshToGl(gl, createMesh_sideCorner());

		// Setup camera system
		initCamOrbit();

		// Setup sizing management
		window.addEventListener("resize", onResize, false);
		onResize();

		// ui lookup convenience
		showSmoothUi = document.getElementById("showSmooth");

		return true;
	}

	// Frame logic loop
	let prevFrameTime = 0;
	function frameLogic(frameTime)
	{
		// Delta time
		frameTime *= 0.001;
		const deltaTime = frameTime - prevFrameTime;
		prevFrameTime = frameTime;

		// clear scene
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

		// If source model is loaded, render it
		if (voxData)
		{
			const viewMatrix = getCamOrbitMatrix();

			for (var k = 0; k < voxData.models.length; k++)
			{
				const model = voxData.models[k];
				const s = model.centerOffset;

				// Render voxels
				for (let i = 0; i < model.voxels.length; i++)
				{
					let v = model.voxels[i];
					let vCentered = vec3.create();
					vec3.subtract(vCentered, v, s);
					if (v.culled || (!v.enabled && showSmoothUi.checked)) { continue; }
					let c = voxData.palette[v.color-1];
					const modelViewMatrix = mat4.create();
					mat4.translate(modelViewMatrix, modelViewMatrix, vCentered);
					mat4.multiply(modelViewMatrix, viewMatrix, modelViewMatrix);
					renderMesh(gl, meshes[SmoothType.VOXEL], v==configControlSelector ? shaders.highlight : shaders.main, c, modelViewMatrix);
				}

				// Render smooths
				if (showSmoothUi.checked)
				{
					for (let i = 0; i < model.smooths.length; i++)
					{
						let v = model.smooths[i];
						let vCentered = vec3.create();
						vec3.subtract(vCentered, v, s);
						if (v.culled || !v.enabled) { continue; }
						if (!meshes.hasOwnProperty(v.pattern)) { continue; }
						let c = voxData.palette[v.color-1];
						const modelViewMatrix = mat4.create();
						mat4.translate(modelViewMatrix, modelViewMatrix, vCentered);
						mat4.multiply(modelViewMatrix, modelViewMatrix, getOrientationMatrix(v.orientation));
						if (v.orientation > 11)
						{
							gl.frontFace(gl.CW);
						}
						mat4.multiply(modelViewMatrix, viewMatrix, modelViewMatrix);
						renderMesh(gl, meshes[v.pattern], v==configControlSelector ? shaders.highlight : shaders.main, c, modelViewMatrix);
						if (v.orientation > 11)
						{
							gl.frontFace
							(gl.CCW);
						}
					}
				}
			}

			gl.clear(gl.DEPTH_BUFFER_BIT); // draw hightlights over geometry

			// Render config modifications
			const s = voxData.models[0].centerOffset;
			let color = vec3.fromValues(Math.random() * 0.5, Math.random() * 0.5, Math.random() * 0.5);
			for (var i = 0; i < configControlHighlightedVoxels.length; i++)
			{
				let c = configControlHighlightedVoxels[i];
				const modelViewMatrix = mat4.create();
				mat4.translate(modelViewMatrix, modelViewMatrix, [c[0]-s[0], c[1]-s[1], c[2]-s[2]]);
				mat4.multiply(modelViewMatrix, viewMatrix, modelViewMatrix);
				renderMesh(gl, meshes[SmoothType.OUTLINE], shaders.outline, color, modelViewMatrix, true);
			}

			vec3.scale(color, color, 2.0);
			if (configControlSelector)
			{
				const modelViewMatrix = mat4.create();
				mat4.translate(modelViewMatrix, modelViewMatrix, configControlSelector);
				mat4.translate(modelViewMatrix, modelViewMatrix, configControlSelectorOffset);
				mat4.multiply(modelViewMatrix, viewMatrix, modelViewMatrix);
				renderMesh(gl, meshes[SmoothType.OUTLINE], shaders.outline, color, modelViewMatrix, true);
			}
		}

		// Frame looping
		requestAnimationFrame(frameLogic);
	}
