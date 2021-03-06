const dragSpeed = 0.01;
const minRotY = -2.95;
const maxRotY = -0.1;
const minZoom = 2;
const maxZoom = 300;

let viewRotX;
let viewRotY;
let viewZoom;

function resetCamOrbit()
{
	viewRotX = 0;
	viewRotY = -Math.PI/2;
	viewZoom = 100;
}

function initCamOrbit(canvas)
{
	gl.canvas.addEventListener("mousedown", onMouseDown);
	gl.canvas.addEventListener("mousemove", onMouseMove);
	gl.canvas.addEventListener("mouseup", onMouseUp);
	gl.canvas.addEventListener("wheel", onMouseWheel);
	gl.canvas.addEventListener("contextmenu", function(evt) { evt.preventDefault(); });
	resetCamOrbit();	
}

function getCamOrbitMatrix()
{
	const result = mat4.create();
	mat4.translate(result, result, [0, 0, -viewZoom]);
	mat4.rotate(result, result, viewRotY, [1, 0, 0]);
	mat4.rotate(result, result, viewRotX, [0, 0, 1]);
	return result;
}

function getCamOrbitPosition()
{
	const viewMat = mat4.create();
	mat4.rotate(viewMat, viewMat, -viewRotX, [0, 0, 1]);
	mat4.rotate(viewMat, viewMat, -viewRotY, [1, 0, 0]);
	mat4.translate(viewMat, viewMat, [0, 0, viewZoom]);
	const result = vec3.create();
	vec3.transformMat4(result, result, viewMat);
	return result;
}

let mouseDown = null;
function onMouseDown(evt)
{
	if (evt.button == 2)
	{
		mouseDown = evt;
	}
}
function onMouseMove(evt)
{
	if (evt.which == 0)
	{
		mouseDown = null;
	}
	if (mouseDown)
	{
		viewRotX += (evt.x - mouseDown.x) * dragSpeed;
		viewRotY += (evt.y - mouseDown.y) * dragSpeed;
		viewRotY = Math.min(Math.max(viewRotY, minRotY), maxRotY);
		mouseDown = evt;
	}
}
function onMouseUp(evt)
{
	if (evt.button == 2)
	{
		mouseDown = null;
	}
}
function onMouseWheel(evt)
{
	viewZoom += viewZoom * 0.15 * (evt.deltaY > 0 ? 1 : -1);
	viewZoom = Math.min(Math.max(viewZoom, minZoom), maxZoom);
}
