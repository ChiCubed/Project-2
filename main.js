// Functions in the initialisation section of this program are adapted from:
// https://developer.mozilla.org/en/docs/Web/API/WebGL_API/Tutorial/Getting_started_with_WebGL
// by Mozilla Contributors, licensed under CC-BY-SA 2.5.

var canvas; // The canvas element.
var gl; // The WebGL context.
var verticesBuffer; // Vertex Buffer Object.
var program = null; // WebGL shader program.

// These store binding points for
// the uniforms.
var screenSizeUniform;
var cameraPosUniform;
var playerPosUniform;
var invPlayerRotationUniform;
var viewToWorldUniform;
var timeUniform;

// Setup the geometry.
// This is just a flat plane;
// the rendering is done in
// the fragment shader.
// This contains two triangles which
// together make the plane.
var vertices = [
   -1.0, 1.0, // top left
    1.0, 1.0, // top right
    1.0,-1.0, // bottom right
   -1.0, 1.0, // top left
    1.0,-1.0, // bottom right
   -1.0,-1.0  // bottom left
];

// Shader sources
var vertShaderSrc, fragShaderSrc;

// Light and DirectionalLight objects.
function Light(pos, colour, intensity, range) {
    this.pos = pos;
    this.colour = colour;
    this.intensity = intensity;
    this.range = range;
}

function DirectionalLight(direction, colour, intensity) {
    this.direction = direction;
    this.colour = colour;
    this.intensity = intensity;
}

// Material object.
function Material(diffuse, specular, shininess) {
    this.diffuse = diffuse;
    this.specular = specular;
    this.shininess = shininess;
}

// Obstacle object.
// Angle is around the z-axis.
function Obstacle(pos, angle, type) {
	this.pos = pos;
	this.angle = angle;
	this.type = type;
}

// More binding points
var numLightsUniform;
var lightPosUniform;
var lightColourUniform;
var lightIntensityUniform;
var reciprocalLightRangeSquaredUniform;

var numDirectionalLightsUniform;
var directionalLightDirectionUniform;
var directionalLightColourUniform;
var directionalLightIntensityUniform;

var numMaterialsUniform;
var materialDiffuseColourUniform;
var materialSpecularColourUniform;
var materialShininessUniform;

var numObstaclesUniform;
var obstaclePosUniform;
var obstacleInvRotationUniform;
var obstacleTypeUniform;

var MAX_NUM_LIGHTS = 32;
var MAX_NUM_DIRECTIONAL_LIGHTS = 32;
var MAX_NUM_MATERIALS = 32;
var MAX_NUM_OBSTACLES = 32;

var lights = [
    new Light([0,3,1],[1,1,1],1.5,40.0),
    new Light([0,4,-60],[0.8,0.8,1],1.0,50.0)
];
var directionalLights = [];
var materials = [
    new Material([1,0,0],[1,1,1],8.0), // player
    new Material([0.35,0.25,0.7],[0.7,0.7,0.7],2.0), // wall
    new Material([0.2,0.2,0.3],[1,1,1],4.0), // floor
	new Material([0.4,0.4,0.4],[1,1,1],2.0), // for checker pattern
	new Material([0.3,0.6,0.4],[1,1,1],8.0), // obstacle 0
	new Material([0.7,0.3,0.5],[1,1,1],8.0)
];
var obstacles = [
	new Obstacle([0,0,-100],0.0,0),
	new Obstacle([0,0,-200],0.0,1)
];


// For FPS calculation
var lastFrameTime;
var startTime;
var requestId; // request ID for the new animation frame
var fpsElement; // paragraph element

// Angle of the camera
// in left/right, up/down, tilt
var angle = [0.0, -0.1, 0.0];

// Camera position
var cameraPos = [0.0, 4.5, 20.0];
// Player position
var playerPos = [0.0, 0.0, 0.0];
// Player forwards speed
var playerSpeed = 1.0;
// Player rotation
// about the z-axis,
// i.e. tilt.
var playerRotation = 0.0;

// Rotation/movement speeds.
var rotationSpeed = 1.0;
var maxRotation = 0.4;
var movementSpeed = 1.0;

// whether the arrow keys are pressed
var leftPressed = false;
var rightPressed = false;

// handlers for buttons
function keyDownHandler(e) {
	if (e.keyCode == 37) {
		leftPressed = true;
	} else if (e.keyCode == 39) {
		rightPressed = true;
	}
}

function keyUpHandler(e) {
	if (e.keyCode == 37) {
		leftPressed = false;
	} else if (e.keyCode == 39) {
		rightPressed = false;
	}
}

function setLightUniforms(lightArray) {
    gl.uniform1i(numLightsUniform, lightArray.length);
    // Three _flat_ arrays storing the:
    // positions, colours and intensities
    // of the lights.
	if (lightArray.length > MAX_NUM_LIGHTS) {
		console.log("Warning: Too many lights");
		return;
	}
	// We don't worry about actually
	// initialising these with values
	// since GLSL only uses the first
	// [lightArray.count] elements
	// of these arrays.
    var pos = new Array(MAX_NUM_LIGHTS * 3);
    var colour = new Array(MAX_NUM_LIGHTS * 3);
    var intensity = new Array(MAX_NUM_LIGHTS);
    var recRangeSqr = new Array(MAX_NUM_LIGHTS);
    for (var i=0; i<lightArray.length; ++i) {
		for (var x=0; x<3; ++x) {
        	pos[i*3+x]=lightArray[i].pos[x];
			colour[i*3+x]=lightArray[i].colour[x];
		}
        // since intensity is just a float we can do this
        intensity[i] = lightArray[i].intensity;
        recRangeSqr[i] = 1/(lightArray[i].range*lightArray[i].range);
    }
    // Now we set the values of the uniforms.
    gl.uniform3fv(lightPosUniform, new Float32Array(pos));
    gl.uniform3fv(lightColourUniform, new Float32Array(colour));
    gl.uniform1fv(lightIntensityUniform, new Float32Array(intensity));
    gl.uniform1fv(reciprocalLightRangeSquaredUniform, new Float32Array(recRangeSqr));
}

function setDirectionalLightUniforms(directionalLightArray) {
    gl.uniform1i(numDirectionalLightsUniform, directionalLightArray.length);
	if(directionalLightArray.length>MAX_NUM_DIRECTIONAL_LIGHTS){
		console.log("Warning: Too many directional lights");
		return;
	}
    var direction = new Array(MAX_NUM_DIRECTIONAL_LIGHTS * 3);
    var colour = new Array(MAX_NUM_DIRECTIONAL_LIGHTS * 3);
    var intensity = new Array(MAX_NUM_DIRECTIONAL_LIGHTS);
    for (var i=0; i<directionalLightArray.length; ++i) {
        for (var x=0; x<3; ++x) {
        	direction[i*3+x]=directionalLightArray[i].direction[x];
			colour[i*3+x]=directionalLightArray[i].colour[x];
		}
        // since intensity is just a float we can do this
        intensity[i] = directionalLightArray[i].intensity;
    }
    gl.uniform3fv(directionalLightDirectionUniform, new Float32Array(direction));
    gl.uniform3fv(directionalLightColourUniform, new Float32Array(colour));
	gl.uniform1fv(directionalLightIntensityUniform, new Float32Array(intensity));
}

function setMaterialUniforms(materialArray) {
    gl.uniform1i(numMaterialsUniform, materialArray.length);
    if (materialArray.length>MAX_NUM_MATERIALS) {
        console.log("Warning: Too many materials");
        return;
    }
    var diffuse = new Array(MAX_NUM_MATERIALS * 3);
    var specular = new Array(MAX_NUM_MATERIALS * 3);
    var shininess = new Array(MAX_NUM_MATERIALS);
    for (var i=0; i<materialArray.length; ++i) {
        for (var x=0; x<3; ++x) {
            diffuse[i*3+x]=materialArray[i].diffuse[x];
            specular[i*3+x]=materialArray[i].specular[x];
        }
        shininess[i]=materialArray[i].shininess;
    }
    gl.uniform3fv(materialDiffuseColourUniform, new Float32Array(diffuse));
    gl.uniform3fv(materialSpecularColourUniform, new Float32Array(specular));
    gl.uniform1fv(materialShininessUniform, new Float32Array(shininess));
}

function setObstacleUniforms(obstacleArray) {
	gl.uniform1i(numObstaclesUniform, obstacleArray.length);
	if (obstacleArray.length>MAX_NUM_OBSTACLES) {
		console.log("Warning: Too many obstacles");
		return;
	}
	var pos = new Array(MAX_NUM_OBSTACLES * 3);
	var invRot = new Array(MAX_NUM_OBSTACLES * 9);
	var type = new Array(MAX_NUM_OBSTACLES);
	var x; // inner loop var
	for (var i=0; i<obstacleArray.length; ++i) {
		for (x=0; x<3; ++x) {
			pos[i*3+x]=obstacleArray[i].pos[x];
		}
		var rot = rotateZ(obstacleArray[i].angle);
		// We want to give WebGL the transpose
		// of the inverse of rot
		// which is just rot.
		for (x=0; x<9; ++x) {
			invRot[i*9+x]=rot[x];
		}
		type[i]=obstacleArray[i].type;
	}
	gl.uniform3fv(obstaclePosUniform, new Float32Array(pos));
	gl.uniformMatrix3fv(obstacleInvRotationUniform, false, new Float32Array(invRot));
	gl.uniform1iv(obstacleTypeUniform, type);
}


// Utility function to generate
// a matrix for a roll rotation
// i.e. tilting camera
function rotateZ(a) {
    return [Math.cos(a), -Math.sin(a), 0,
            Math.sin(a),  Math.cos(a), 0,
                      0,            0, 1];
}

// rotate left/right
function rotateY(a) {
    return [ Math.cos(a), 0, Math.sin(a),
                       0, 1,           0,
            -Math.sin(a), 0, Math.cos(a)];
}

// pitch up/down
function rotateX(a) {
    return [1,           0,            0,
            0, Math.cos(a), -Math.sin(a),
            0, Math.sin(a),  Math.cos(a)];
}

// For colour manipulation
// https://stackoverflow.com/questions/8507885/shift-hue-of-an-rgb-color
function rotateHue(c, h) {
	var U = Math.cos(h * Math.PI/180);
	var W = Math.sin(h * Math.PI/180);

	return [
		(0.299 + 0.701*U + 0.168*W)*c[0] +
		(0.587 - 0.587*U + 0.330*W)*c[1] +
		(0.114 - 0.114*U - 0.497*W)*c[2],
		(0.299 - 0.299*U - 0.328*W)*c[0] +
		(0.587 + 0.413*U + 0.035*W)*c[1] +
		(0.114 - 0.114*U + 0.292*W)*c[2],
		(0.299 - 0.300*U + 1.250*W)*c[0] +
		(0.587 - 0.588*U - 1.050*W)*c[1] +
		(0.114 + 0.886*U - 0.203*W)*c[2]
	];
}

// Function to multiply two
// 3x3 matrices.
function mult3(m1, m2) {
    var r = [0,0,0,0,0,0,0,0,0];
    for (var i=0; i<3; ++i) {
        for (var j=0; j<3; ++j) {
            for (var k=0; k<3; ++k) {
                r[i*3+j] += m1[i*3+k]*m2[k*3+j];
            }
        }
    }
    return r;
}

// Function to transpose a
// 3x3 matrix.
function trans3(m) {
    var r = [0,0,0,0,0,0,0,0,0];
    for (var i=0; i<3; ++i) {
        for (var j=0; j<3; ++j) {
            r[j*3+i] = m[i*3+j];
        }
    }
    return r;
}


function initWebGL(canvas) {    
    var gl = null;
    
    // attempt to get a WebGL context
    gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    
    if (!gl) {
        alert('Failed to initialise WebGL.');
    }
    
    return gl;
}


function createShader(gl, type, source) {
    var shader = gl.createShader(type);
    
    // Load the source into the shader
    gl.shaderSource(shader, source);
    
    gl.compileShader(shader);
    
    // We only return the shader if it
    // compiled successfully.
    var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (success) {
        return shader;
    }
    
    // if the WebGL context wasn't lost:
    if (!gl.isContextLost()) {
        // Otherwise we log what went wrong.
        console.log(gl.getShaderInfoLog(shader));
    
        gl.deleteShader(shader);
    }
}


function createProgram(gl, vertexShader, fragmentShader) {
    var program = gl.createProgram();
    
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    
    gl.linkProgram(program);
    
    var success = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (success) {
        return program;
    }
    
    if (!gl.isContextLost()) {
        console.log(gl.getProgramInfoLog(program));

        gl.deleteProgram(program);
    }
}


function setupWebGLState() {
    verticesBuffer = gl.createBuffer();
    // gl.ARRAY_BUFFER is a 'bind point'
    // for WebGL, which indicates where
    // the data is located.
    gl.bindBuffer(gl.ARRAY_BUFFER, verticesBuffer);
    // We convert positions to a 32-bit float array.
    // gl.STATIC_DRAW indicates that the plane
    // will not move during the render loop.
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, verticesBuffer);
    
    var vertShader = createShader(gl, gl.VERTEX_SHADER, vertShaderSrc);
    var fragShader = createShader(gl, gl.FRAGMENT_SHADER, fragShaderSrc);

    // Now we 'link' them into a program
    // which can be used by WebGL.
    program = createProgram(gl, vertShader, fragShader);

    // The shader program now needs to know
    // where the data being used in the
    // vertex shader (namely the
    // position attribute) is coming from.
    // We set that here.
    var positionAttribLoc = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(positionAttribLoc);

    // We now tell WebGL how to extract
    // data out of the array verticesBuffer
    // and give it to the vertex shader.
    // The three main arguments are the
    // first three. In order these indicate:
    // 1.  where to bind the current ARRAY_BUFFER to
    // 2.  how many components there are per attribute
    //       (in this case two)
    // 3.  the type of the data
    gl.vertexAttribPointer(positionAttribLoc, 2, gl.FLOAT, false, 0, 0);


    // We also get the uniform locations,
    // to pass data to/from the shader.
    screenSizeUniform = gl.getUniformLocation(program, "screenSize");
    cameraPosUniform = gl.getUniformLocation(program, "cameraPos");
    playerPosUniform = gl.getUniformLocation(program, "playerPos");
    invPlayerRotationUniform = gl.getUniformLocation(program, "invPlayerRot");
    viewToWorldUniform = gl.getUniformLocation(program, "viewToWorld");
    timeUniform = gl.getUniformLocation(program, "time");

    numLightsUniform = gl.getUniformLocation(program, "numLights");
    lightPosUniform = gl.getUniformLocation(program, "lightPos");
    lightColourUniform = gl.getUniformLocation(program, "lightColour");
    lightIntensityUniform = gl.getUniformLocation(program, "lightIntensity");
    reciprocalLightRangeSquaredUniform = gl.getUniformLocation(program, "reciprocalLightRangeSquared");

    numDirectionalLightsUniform = gl.getUniformLocation(program, "numDirectionalLights");
    directionalLightDirectionUniform = gl.getUniformLocation(program, "directionalLightDirection");
    directionalLightColourUniform = gl.getUniformLocation(program, "directionalLightColour");
    directionalLightIntensityUniform = gl.getUniformLocation(program, "directionalLightIntensity");

    numMaterialsUniform = gl.getUniformLocation(program, "numMaterials");
    materialDiffuseColourUniform = gl.getUniformLocation(program, "materialDiffuseColour");
    materialSpecularColourUniform = gl.getUniformLocation(program, "materialSpecularColour");
    materialShininessUniform = gl.getUniformLocation(program, "materialShininess");

	numObstaclesUniform = gl.getUniformLocation(program, "numObstacles");
	obstaclePosUniform = gl.getUniformLocation(program, "obstaclePos");
	obstacleInvRotationUniform = gl.getUniformLocation(program, "obstacleInvRotation");
	obstacleTypeUniform = gl.getUniformLocation(program, "obstacleType");
}


// This is the rendering function.
// This will cause WebGL to render
// the scene, and does most of
// the game logic.
function render(time) {
	var deltaTime = time - lastFrameTime;
	var currentTime = time - startTime;
    
	// sanity check
    if (program === null) {
        // The program hasn't loaded yet! :O
        return;
    }
    
    // Background colour: black
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    // Clear the canvas.
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    // Tell WebGL to use our shader program.
    gl.useProgram(program);
    
    
    // Set the uniforms
    gl.uniform2f(screenSizeUniform, canvas.width, canvas.height);
    gl.uniform3fv(cameraPosUniform, new Float32Array(cameraPos));
    gl.uniform3fv(playerPosUniform, new Float32Array(playerPos));
    // divide by 1000: ms -> s
    gl.uniform1f(timeUniform,currentTime/1000.0);
    setLightUniforms(lights);
    setDirectionalLightUniforms(directionalLights);
    setMaterialUniforms(materials);
	setObstacleUniforms(obstacles);
    
    // We calculate the rotation matrix for player rotation.
    // First calculate the transformation matrix.
    var pm = rotateZ(playerRotation);

    // We should transpose it here to
    // ensure the data is in the correct
    // format for WebGL to use.
    // However, then in the fragment shader
    // we would have to find the inverse
    // of the matrix. The inverse is just
    // the matrix's transpose, so we do
    // two transpositions, which is the same
    // as doing nothing.

    // Set uniform
    gl.uniformMatrix3fv(invPlayerRotationUniform, false, new Float32Array(pm));

    // We need to calculate the rotation matrix from
    // view to world.
    // First get the transformation matrix.
    var m = mult3(mult3(rotateY(angle[0]), rotateX(angle[1])), rotateZ(angle[2]));
    // We transpose the matrix to make WebGL happy.
    m = trans3(m);
    // Now set the uniform.
    gl.uniformMatrix3fv(viewToWorldUniform, false, new Float32Array(m));


    var isMovingRight = (rightPressed && !leftPressed);
    var isMovingLeft  = (leftPressed && !rightPressed);

    // how far out the wall is at the moment.
    var wallDist = 4.5 + Math.sin(0.1 * playerPos[2]) * 0.5;

    // If the player is touching the wall, we
    // want to rotate them back in the other direction,
    // to bounce them off.
    // We use 4.5 because this is
    // (wall distance from center) - (half player width).
    // Also if the player is trying to move _away_ from
    // the wall, or they're rotated away,
	// we don't want them to get stuck.
    if (playerPos[0] >  wallDist && !isMovingLeft ||
        playerPos[0] < -wallDist && !isMovingRight) {
		if (playerPos[0] > wallDist) {
			playerPos[0] = wallDist;
		} else {
			playerPos[0] =-wallDist;
		}
        playerRotation = -playerRotation*0.9;
    } else {
        // We're not touching the wall.
	    // We rotate the player based on
        // which keys are pressed.
	    // If both are pressed there should
	    // be no rotation.
        if (isMovingRight) {
            // tilt right
            // rotation is anticlockwise
            // so this is negative, not positive.
            playerRotation -= deltaTime*rotationSpeed*0.007*(playerRotation+maxRotation);
        } else if (isMovingLeft) {
            // tilt left
            playerRotation += deltaTime*rotationSpeed*0.007*(-playerRotation+maxRotation);
        } else {
            // tilt to center
            playerRotation -= playerRotation*deltaTime*rotationSpeed*0.007;
        }
    }

	// The player rotation and movement
	// are linked, to make movement smooth.
	// In particular, the player moves
	// based on their rotation.
	// We subtract the player rotation
	// instead of adding it since the rotation
	// is anticlockwise.
	playerPos[0] -= (playerRotation/maxRotation)*deltaTime*movementSpeed*0.01;
    
    // Move player forwards
    playerPos[2] -= deltaTime*playerSpeed*0.02;

	// Speed up
	playerSpeed += deltaTime*0.000005;

	// Rotate wall colour
	materials[1].diffuse = rotateHue(materials[1].diffuse, deltaTime*0.01);

    // Move the 'player light' to near the player
    // We scale down the player position to prevent
    // the light from getting close to a wall,
    // which would cause artifacts.
    lights[0].pos[0] = playerPos[0]*0.8;
    lights[0].pos[1] = playerPos[1] + 3.0;
    lights[0].pos[2] = playerPos[2] + 1.0;

    // Also another light
    lights[1].pos[0] = 0.0;
    lights[1].pos[1] = playerPos[1] + 4.0;
    lights[1].pos[2] = playerPos[2] - 60.0;

    // Move camera to player
    cameraPos[1] = playerPos[1] + 4.5;
    cameraPos[2] = playerPos[2] + 20.0;

	// Execute the shader programs
    // The gl.TRIANGLES indicates to draw triangles;
    // the 6 indicates there are 6 vertices.
	// This is done after updating to ensure
	// the drawn version is as up-to-date
	// as possible.
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // ensure drawing is done
    gl.finish();

    // setup the browser for the
	// next frame
    requestId = requestAnimationFrame(render);

    // Now we do FPS calculation.
    var fps = 1000/deltaTime;
    fpsElement.innerHTML = "FPS: "+fps.toFixed(2);
    
    lastFrameTime = time;
}


function handleContextLost(event) {
    event.preventDefault();
    console.log('The WebGL context was lost.');
    cancelAnimationFrame(requestId);
}


function initGame() {
    canvas = document.getElementById('canvas');
    fpsElement = document.getElementById('fps');
    
    gl = initWebGL(canvas);
    
    // gl is a falsey value if
    // WebGL didn't initialise properly.
    // We simply return since we have
    // already alerted the user in
    // initWebGL.
    if (!gl) {
        return;
    }
    
    // If the WebGL context is lost,
    // we should reload.
    canvas.addEventListener(
        'webglcontextlost', handleContextLost, false
    );
    
    // When restored, we redo the
    // setup stages.
    canvas.addEventListener(
        'webglcontextrestored', setupWebGLState, false
    );
    
    
    // Now we create the shaders.
    // The 'vertex shader' is run
    // once per vertex, and is mostly
    // irrelevant for our purposes.
    // The 'fragment shader' is run
    // once per fragment
    // (a fragment is usually a pixel)
    // and this is the shader that we
    // are most interested in,
    // since it will do most of the
    // rendering.
    
    // Load shader source.
    
    // We use some XMLHttpRequests.
    // We do this asynchronously,
    // hence the nesting of
    // 'onload' functions.
    // The render loop handles the
    // case that the shader has not
    // yet compiled (i.e. the files
    // have not yet been loaded).
    var vertReq = new XMLHttpRequest();
    vertReq.onload = function() {
        vertShaderSrc = this.response;
        
        var fragReq = new XMLHttpRequest();
        fragReq.onload = function() {
            fragShaderSrc = this.response;
            
            setupWebGLState();

			// Add event listeners
			// for the movement buttons
			document.addEventListener("keydown", keyDownHandler, false);
			document.addEventListener("keyup", keyUpHandler, false);

			// Now we start the render loop
			startTime = performance.now();
    		lastFrameTime = startTime;
    		requestId = requestAnimationFrame(render);
        };
        fragReq.open("GET", "fragment-shader.glsl");
        fragReq.responseType = "text";
        fragReq.send();
    };
    vertReq.open("GET", "vertex-shader.glsl");
    vertReq.responseType = "text";
    vertReq.send();
}
