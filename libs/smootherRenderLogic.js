
	let gl;
	let canvasHeightOffset;
	let showSmoothUi;

	// Each browser resize requires viewport recalculation
	function onResize(evt)
	{
		gl.canvas.width = gl.canvas.clientWidth;
		gl.canvas.height = window.innerHeight - canvasHeightOffset - 1;
		gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
		mat4.perspective(gl.projectionMatrix, 45 * Math.PI/180, gl.canvas.width / gl.canvas.height, 0.1, 1000.0);
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
			uniform vec4 color;
			varying lowp vec4 varyingColor;
			void main()
			{
				gl_Position = matProjection * matModelView * vertex;

				vec4 transformedNormal = matNormal * vec4(normal, 1.0);
				float lighting = max(dot(transformedNormal.xyz, vec3(0.0, 0.0, 1.0)), 0.0);
				varyingColor = vec4(color.r * lighting, color.g * lighting, color.b * lighting, 1.0);
			}
		`;
		const shaderSrc_f = `
			varying lowp vec4 varyingColor;
			void main()
			{
				gl_FragColor = varyingColor;
			}
		`;
		shader = createShader(gl, shaderSrc_v, shaderSrc_f, ["vertex", "normal"], ["matModelView", "matProjection", "matNormal", "color"]);
		if (typeof(shader) === "string")
		{
			return onFatalError(shader);
		}

		// Meshes
		meshes[SmoothType.ORIGINAL] = createMesh_cube(gl);
		meshes[SmoothType.CORNER] = createMesh_corner(gl);
		meshes[SmoothType.EMBED] = createMesh_embed(gl);
		meshes[SmoothType.OUTBED] = createMesh_outbed(gl);
		meshes[SmoothType.SIDECORNER] = createMesh_sideCorner(gl);

		// Setup camera system
		initCamOrbit();

		// Setup sizing management
		canvasHeightOffset = window.innerHeight - gl.canvas.clientHeight;
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
			const s = voxData.models[0].centerOffset;

			// Render original voxels
			for (let i = 0; i < voxData.models[0].voxels.length; i++)
			{
				let v = voxData.models[0].voxels[i];
				if (v.culled || (!v.enabled && showSmoothUi.checked)) { continue; }
				let c = voxData.palette[v.color-1];
				const modelViewMatrix = mat4.create();
				mat4.translate(modelViewMatrix, modelViewMatrix, [v.x-s.x, v.y-s.y, v.z-s.z]);
				mat4.multiply(modelViewMatrix, viewMatrix, modelViewMatrix);
				renderMesh(gl, meshes[SmoothType.ORIGINAL], shader, [c.r,c.g,c.b,c.a], modelViewMatrix);
			}

			// Render smoothing voxels
			if (showSmoothUi.checked)
			{
				for (let i = 0; i < voxData.models[0].smoothVoxels.length; i++)
				{
					let v = voxData.models[0].smoothVoxels[i];
					if (v.culled || !v.enabled) { continue; }
					if (!meshes.hasOwnProperty(v.pattern)) { continue; }
					let c = voxData.palette[v.color-1];
					const modelViewMatrix = mat4.create();
					mat4.translate(modelViewMatrix, modelViewMatrix, [v.x-s.x, v.y-s.y, v.z-s.z]);
					switch (v.orientation)
					{
						case  1: mat4.rotate(modelViewMatrix, modelViewMatrix, 180*Math.PI/180, [0, 0, 1]); break;
						case  2: mat4.rotate(modelViewMatrix, modelViewMatrix, 90*Math.PI/180, [0, 0, 1]); break;
						case  3: mat4.rotate(modelViewMatrix, modelViewMatrix, -90*Math.PI/180, [0, 0, 1]); break;
						case  4: mat4.rotate(modelViewMatrix, modelViewMatrix, 90*Math.PI/180, [0, 1, 0]); break;
						case  5: mat4.rotate(modelViewMatrix, modelViewMatrix, -90*Math.PI/180, [0, 1, 0]); break;
						case  6: mat4.rotate(modelViewMatrix, modelViewMatrix, 180*Math.PI/180, [0, 1, 0]); break;
						case  7: mat4.rotate(modelViewMatrix, modelViewMatrix, 180*Math.PI/180, [0, 1, 0]); mat4.rotate(modelViewMatrix, modelViewMatrix, 90*Math.PI/180, [0, 0, 1]); break;
						case  8: mat4.rotate(modelViewMatrix, modelViewMatrix, 180*Math.PI/180, [0, 1, 0]); mat4.rotate(modelViewMatrix, modelViewMatrix, -90*Math.PI/180, [0, 0, 1]); break;
						case  9: mat4.rotate(modelViewMatrix, modelViewMatrix, 180*Math.PI/180, [0, 1, 0]); mat4.rotate(modelViewMatrix, modelViewMatrix, 180*Math.PI/180, [0, 0, 1]); break;
						case 10: mat4.rotate(modelViewMatrix, modelViewMatrix, 90*Math.PI/180, [0, 1, 0]); mat4.rotate(modelViewMatrix, modelViewMatrix, 180*Math.PI/180, [0, 0, 1]); break;
						case 11: mat4.rotate(modelViewMatrix, modelViewMatrix, -90*Math.PI/180, [0, 1, 0]); mat4.rotate(modelViewMatrix, modelViewMatrix, 180*Math.PI/180, [0, 0, 1]); break;
						case 12: mat4.scale(modelViewMatrix, modelViewMatrix, [-1, 1, 1]); break;
					}
					if (v.orientation > 11)
					{
						gl.frontFace(gl.CW);
					}
					mat4.multiply(modelViewMatrix, viewMatrix, modelViewMatrix);
					renderMesh(gl, meshes[v.pattern], shader, [c.r,c.g,c.b,c.a], modelViewMatrix);
					if (v.orientation > 11)
					{
						gl.frontFace
						(gl.CCW);
					}
				}
			}
		}

		// Frame looping
		requestAnimationFrame(frameLogic);
	}
