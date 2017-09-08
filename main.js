// Functions for WebGL initialisation are adapted from:
// https://developer.mozilla.org/en/docs/Web/API/WebGL_API/Tutorial/Getting_started_with_WebGL
// by Mozilla Contributors, licensed under CC-BY-SA 2.5.

var canvas; // The canvas element.
var screenshotCanvas; // Screenshot canvas element.
var screenshotCtx; // Screenshot 2d context.
var screenshotTexture; // Screenshot texture.
var screenshotFb; // Screenshot framebuffer.
// screenshot width / height
var screenshotWidth = 1920;
var screenshotHeight = 1080;
var screenshotData;
var container; // Container for canvas + pause button.
var gl; // The WebGL context.
var verticesBuffer; // Vertex Buffer Object.
var program = null; // WebGL shader program.

// A debug variable.
var FIX_LATE_COUNTDOWN = true;

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
var vertShaderSrc, fragShaderSrc, obstacleSrc;

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
// mid is material id.
function Obstacle(pos, angle, type, mid, destroyable, chasePlayer) {
	this.pos = pos;
	this.angle = angle;
	this.type = type;
    this.mid = mid;
    this.destroyable = Boolean(destroyable);
    this.chasePlayer = Boolean(chasePlayer);
    this.exists = true;
}

// Level object.
function Level(obstacles, winPosition, title) {
    this.obstacles = obstacles;
    this.winPosition = winPosition;
    this.title = title;
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
var obstacleExistsUniform;

var projectilePosUniform;
var projectileExistsUniform;

var winPositionUniform;

// for collision detection.
// the GPU does this for us.
// we do this so that we don't have to care about
// the actual shape of the obstacles in the
// main code.
// this allows us to interface with it.
var isCollisionDetectionUniform;

var collisionTextureWidth = 1;
var collisionTextureHeight = 1;
var collisionTexture;
var collisionFramebuffer;

var NUM_PHYSICS_SUBSTEPS = 8;

// Countdown duration before
// level start, in MS.
var COUNTDOWN_DURATION = 3000;

var MAX_NUM_LIGHTS = 32;
var MAX_NUM_DIRECTIONAL_LIGHTS = 32;
var MAX_NUM_MATERIALS = 32;
var MAX_NUM_OBSTACLES = 32;

var lights = [
    new Light([0,3,-1],[1,1,1],1.5,40.0), // player light
    new Light([0,4,-60],[0.8,0.8,1],1.0,50.0), // forwards light
    new Light([0,4,-30],[0.6,0.6,0.6],1.0,40.0), // secondary forwards light
    new Light([0,0,0],[1,1,1],0.0,40.0), // projectile light
    new Light([0,0,0],[1,1,1],1.5,50.0) // win position light
];
var directionalLights = [];
var materials = [
    new Material([1,0,0],[1,1,1],8.0), // player
    new Material([0.35,0.25,0.7],[0.7,0.7,0.7],2.0), // wall
    new Material([0.2,0.2,0.3],[1,1,1],4.0), // floor
	new Material([0.4,0.4,0.4],[1,1,1],2.0), // for checker pattern
    new Material([0.5,0.5,0.7],[1,1,1],8.0), // projectile
    new Material([0.6,0.4,0.3],[1,1,1],4.0), // win plane
	new Material([0.3,0.6,0.4],[0.5,0.7,0.4],8.0), // obstacles from this point
	new Material([0.7,0.3,0.5],[1,1,1],8.0)
];
var obstacles = [];
// this stores how far the player
// has to travel before they win.
var winPosition;
// current level index
// in the 'levels' array
var currentLevel;
// stores the levels.
// obstacles in a level should be
// sorted by their z-position
// in reverse.
var levels = [
    new Level([
        new Obstacle([0,0,-100],0.0,0,6,true,false),
        new Obstacle([0,0,-200],0.0,1,6,true,false),
        new Obstacle([0,0,-300],0.0,2,6,true,false)
    ], -500.0, 'Basics'),
    new Level([
        new Obstacle([-2,0,-80],0.0,0,7,false,false),
        new Obstacle([2,0,-93],0.0,0,7,false,false),
        new Obstacle([-2,0,-106],0.0,0,7,false,false)
    ], -130.0, 'Indestructibles'),
    new Level([
        new Obstacle([-1.6,0,-70],0.0,1,6,true,false),
        new Obstacle([-0.8,0,-80],0.0,1,7,false,false),
        new Obstacle([ 0.0,0,-90],0.0,1,6,true,false),
        new Obstacle([ 0.8,0,-100],0.0,1,7,false,false),
        new Obstacle([ 1.6,0,-110],0.0,1,6,true,false),
        new Obstacle([ 0.8,0,-120],0.0,1,7,false,false),
        new Obstacle([ 0.0,0,-130],0.0,1,6,true,false),
        new Obstacle([-0.8,0,-140],0.0,1,7,false,false),
        new Obstacle([-1.6,0,-150],0.0,1,6,true,false)
    ], -170.0, 'Precision'),
    new Level([
        new Obstacle([-2,0,-100],0.0,0,6,true,true),
        new Obstacle([2,0,-200],0.0,2,7,false,true),
    ], -250.0, 'Chasers'),
    new Level([
        new Obstacle([-3,0,-100],0.0,0,7,false,true),
        new Obstacle([0,0,-100],0.0,1,7,false,true),
        new Obstacle([3,0,-100],0.0,0,7,false,true),
    ], -120.0, 'More Chasers'),
    new Level([
        new Obstacle([-4.2,0,-80],0.0,0,7,false,false),
        new Obstacle([ 4.2,0,-80],0.0,0,7,false,false),
        new Obstacle([-3,0,-100],0.0,1,7,false,true),
        new Obstacle([-2,0,-110],0.0,1,7,false,true),
        new Obstacle([-1,0,-120],0.0,1,7,false,true),
        new Obstacle([ 0,0,-130],0.0,1,7,false,true),
        new Obstacle([ 1,0,-140],0.0,1,7,false,true),
        new Obstacle([ 2,0,-150],0.0,1,7,false,true),
        new Obstacle([ 3,0,-160],0.0,1,7,false,true),
    ], -200.0, 'Alignment'),
    new Level([
        new Obstacle([-2,2,-100],0.0,0,7,false,true),
        new Obstacle([2,2,-100],0.0,0,7,false,true),
        new Obstacle([-5,0.5,-100],1.57,0,7,false,true),
        new Obstacle([ 5,0.5,-100],1.57,0,7,false,true),

        new Obstacle([-2,2,-170],0.0,0,7,false,true),
        new Obstacle([2,2,-170],0.0,0,7,false,true),
        new Obstacle([-5,0.5,-170],1.57,0,6,true,true),
        new Obstacle([ 5,0.5,-170],1.57,0,7,false,true),
    ], -200.0, 'Collapsing Structure')
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

var obstacleChaseSpeed = 1.0;

// Projectile.
var relativeProjectileSpeed = 1.0;
var projectilePos = null;
var projectileExists = false;
var originalProjectileSpeed = 0.0;

// whether the arrow keys are pressed
var leftPressed = false;
var rightPressed = false;

// Other UI elements
var gameOverMenu;
var winMenu;
var levelMenu;
var pauseButton;
var pauseMenu;
var optionsMenu;

var optionsBackButton;
var physicsSubstepsInput;
var screenshotWInput;
var screenshotHInput;

var countdown;

// for shaking the canvas
var shakeFramesLeft;
var shakeMagnitude;
var shakeMagnitudeDelta;


// whether the game is actually playing or not
var gamePlaying = false;
var paused = false;
var pauseTime;

// whether or not a level preview
// has been rendered yet.
// we use this when we start a level
// so that the canvas actually shows
// what the level will look like.
var hasRenderedPreview;


function random(min, max) {
    return min + Math.floor(Math.random()*(max-min+1));
}

function shootProjectile() {
    projectileExists = true;
    projectilePos = playerPos.slice(); // copy player position
    projectilePos[2] -= 2.4; // move in front of player

    originalProjectileSpeed = playerSpeed;

    // the actual movement of the projectile
    // is done in the main render loop.
}

// handlers for buttons
function keyDownHandler(e) {
	if (e.keyCode == 37) {
		leftPressed = true;
		e.preventDefault();
	} else if (e.keyCode == 39) {
		rightPressed = true;
		e.preventDefault();
	} else if (e.keyCode == 32) {
        // spacebar - shoot projectile
        if (!projectileExists) {
            shootProjectile();
        }
		e.preventDefault();
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
    var exists = new Array(MAX_NUM_OBSTACLES);
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
        exists[i] = obstacleArray[i].exists;
	}
	gl.uniform3fv(obstaclePosUniform, new Float32Array(pos));
	gl.uniformMatrix3fv(obstacleInvRotationUniform, false, new Float32Array(invRot));
    gl.uniform1fv(obstacleExistsUniform, new Float32Array(exists));
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


// Function to mix two
// 3x1 vectors.
function mix3(x, y, a) {
    return [
        x[0]*(1.0 - a) + y[0]*a,
        x[1]*(1.0 - a) + y[1]*a,
        x[2]*(1.0 - a) + y[2]*a
    ];
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


function generateProgramFromSources(vertex, fragment) {
    var vertShader = createShader(gl, gl.VERTEX_SHADER, vertex);
    var fragShader = createShader(gl, gl.FRAGMENT_SHADER, fragment);

    // Now we 'link' them into a program
    // which can be used by WebGL.
    return createProgram(gl, vertShader, fragShader);
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

	// Create the texture for collision detection
	// red component is player collision,
	// green component is projectile collision
	// https://webglfundamentals.org/webgl/lessons/webgl-render-to-texture.html
	collisionTexture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, collisionTexture);

	var level = 0;
	var internalFormat = gl.RGBA;
	var border = 0;
	var format = gl.RGBA;
	var type = gl.UNSIGNED_BYTE;
	var data = null;
	gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, collisionTextureWidth, collisionTextureHeight, border, format, type, data);

	// change filtering so mip-maps
	// are not needed
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

	// create / bind framebuffer
	collisionFramebuffer = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, collisionFramebuffer);

	// attach texture
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, collisionTexture, level);


    // Now for the screenshot texture!
    screenshotTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, screenshotTexture);

	gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, screenshotWidth, screenshotHeight, border, format, type, data);

	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

	// to store pixels
	screenshotData = new Uint8Array(4 * screenshotWidth * screenshotHeight);

	screenshotFb = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, screenshotFb);

	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, screenshotTexture, level);


    // The reason we can't just get the program attribute locations now is that
    // the program is dynamically generated for each level that we play, and
    // therefore will not exist when this function is called.
}


function changeScreenshotSize(w, h) {
	screenshotWidth = w;
	screenshotHeight = h;
	screenshotCanvas.width = w;
	screenshotCanvas.height = h;

	var level = 0;
	var internalFormat = gl.RGBA;
	var border = 0;
	var format = gl.RGBA;
	var type = gl.UNSIGNED_BYTE;
	var data = null;

	// to store pixels
	screenshotData = new Uint8Array(4 * screenshotWidth * screenshotHeight);

	gl.bindTexture(gl.TEXTURE_2D, screenshotTexture);

	gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, screenshotWidth, screenshotHeight, border, format, type, data);

	/*
	 // The following code is not really
	 // necessary, since the
     // texture is already linked to
     // the framebuffer. All we want
     // to do is change the texture size,
     // and we've done that.
	 gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	 gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	 gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

	 gl.bindFramebuffer(gl.FRAMEBUFFER, screenshotFb);

	 gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, screenshotTexture, level);
	*/
}


// sets canvas width / height
function setCanvasSize(width, height) {
    canvas.width = width;
    canvas.height = height;
	gl.viewport(0, 0, canvas.width, canvas.height);

	// preview must be re-rendered
	hasRenderedPreview = false;
}


function getProgramAttribLocations() {
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
    obstacleExistsUniform = gl.getUniformLocation(program, "obstacleExists");

    projectileExistsUniform = gl.getUniformLocation(program, "projectileExists");
    projectilePosUniform = gl.getUniformLocation(program, "projectilePos");

	isCollisionDetectionUniform = gl.getUniformLocation(program, "isCollisionDetection");

    winPositionUniform = gl.getUniformLocation(program, "winPosition");
}


// Loosely based off https://jsfiddle.net/12aueufy/1/
function shakeCanvas(time) {
    // Restore original element translation at the start.
    container.style.transform = 'translate(0px, 0px)';

    if (shakeFramesLeft <= 0) {
        // We're finished.
        return;
    }

    shakeMagnitude += shakeMagnitudeDelta;

    var randX = random(-shakeMagnitude, shakeMagnitude);
    var randY = random(-shakeMagnitude * 0.5, shakeMagnitude * 0.5);
    var randRot = random(-shakeMagnitude * 0.1, shakeMagnitude * 0.1);

    // Javascript will automatically make randX, randY and randRot
    // strings for us.
    container.style.transform = 'rotate(' + randRot + 'deg) translate(' + randX + 'px, ' + randY + 'px)';

    shakeFramesLeft--;
    requestAnimationFrame(shakeCanvas);
}


function addLevelButtons(levelMenuElem) {
    // This adds buttons to the
    // element defined by levelMenuElem,
    // one for each level. These buttons
    // can be clicked by the user to send
    // them to that level.

    // Firstly add a side-scrolling element
    // to hold the levels.
    var lvlBtnMenu = document.createElement('div');
    lvlBtnMenu.className = 'levelSelectionMenu';

    for (var i = 0; i < levels.length; ++i) {
        var btn = document.createElement('button');
        // automatically converted to string
        btn.innerHTML = i+1 + '. ' + levels[i].title;
        btn.className = 'levelButton';
        btn.onclick = levelLoader(i);
        lvlBtnMenu.appendChild(btn);
    }

    levelMenuElem.appendChild(lvlBtnMenu);
}


function injectObstacleSceneData(fragment, obstacles) {
    // We inject the data for the obstacles
    // into the shader, so they are rendered.
    var sceneObstacles = 'HitPoint obstacleHit = HitPoint(FAR_DIST, 0, 255);\n' +
                         'HitPoint thisHit;';

    for (var i = 0; i < obstacles.length; ++i) {
        sceneObstacles += 'thisHit = obstacleDist'+obstacles[i].type+'(\n' +
                          '    FAR_DIST * (1.0 - obstacleExists['+i+']) +\n' +
                          '    obstacleInvRotation['+i+']*(p - obstaclePos['+i+']),\n' +
                          '    ' + obstacles[i].mid + ',\n' +
                          '    ' + i + '\n' +
                          ');\n' +
                          'obstacleHit = min(obstacleHit, thisHit);\n';
    }

    sceneObstacles += 'return obstacleHit;\n';

    return fragment.replace('_PLACEHOLDER_FOR_OBSTACLE_SCENE_DATA', sceneObstacles);
}


// The following functions (up to line 1106)
// change something about game state, e.g.
// open a menu.


function levelLoader(levelID) {
    // returns a function which will
    // load the level levelID.
    var loadLvl = function() { loadLevel(levelID); };
    return loadLvl;
}


function selectLevel() {
    // just in case the game is still going
    // (which it shouldn't be, but this will
    //  prevent an issue occuring)
    cancelAnimationFrame(requestId);

    gamePlaying = false;
    paused = false;

    // draw menu
    levelMenu.style.display = '';

    // make other menus invisible
	optionsMenu.style.display = 'none';
    gameOverMenu.style.display = 'none';
    winMenu.style.display = 'none';
    pauseButton.style.display = 'none';
    pauseMenu.style.display = 'none';

	countdown.style.display = 'none';
    fpsElement.innerHTML = 'Not in game';
}


function openOptions(returnFunc, returnName) {
	// returnFunc and returnName
	// are the function to call and the
	// name of the menu which we came
	// to the options menu through.

	// set the return button based on this
	optionsBackButton.innerHTML = 'Back to '+returnName;
	optionsBackButton.onclick = returnFunc;

	// just in case game still going
	cancelAnimationFrame(requestId);

	// draw menu
	optionsMenu.style.display = '';

	// make other menus invisible
	levelMenu.style.display = 'none';
    gameOverMenu.style.display = 'none';
    winMenu.style.display = 'none';
    pauseButton.style.display = 'none';
    pauseMenu.style.display = 'none';
}


// This function loads a new level.
// Basically this just sets the currentLevel,
// recompiles the program to include the
// obstacles for the current scene,
// and starts the game.
function loadLevel(levelID) {
	fpsElement.innerHTML = 'Loading level';

    // We don't want to load the level
    // if we're mid-game!
    if (gamePlaying) return;

    currentLevel = levelID;

    var newFragShaderSrc = injectObstacleSceneData(fragShaderSrc, levels[levelID].obstacles);
    program = generateProgramFromSources(vertShaderSrc, newFragShaderSrc);
    // This function does things like get the locations of uniforms
    // so we can set them. Always a handy thing to be able to do.
    getProgramAttribLocations();

    // start the level
    // We use setTimeout to ensure
    // the browser has time to update
    // the fps counter's text to
    // "Loading game".
    setTimeout(startGame, 15);
}


function loseGame() {
    // We want to stop the game execution
    cancelAnimationFrame(requestId);

    gamePlaying = false;
    paused = false;

    // draw menu
    // i.e. make it not invisible
    gameOverMenu.style.display = '';

    winMenu.style.display = 'none';
    levelMenu.style.display = 'none';
	optionsMenu.style.display = 'none';

    // hide pause button
    pauseButton.style.display = 'none';
    pauseMenu.style.display = 'none';

	countdown.style.display = 'none';
    // After a short delay update the FPS counter
	setTimeout(function() {
        fpsElement.innerHTML = 'Level failed';
    }, 15);

    // Make canvas shake
    shakeFramesLeft = 15;
    shakeMagnitude = 30;
    shakeMagnitudeDelta = -2;
    shakeCanvas();
}


function winGame() {
    // Stop game execution
    cancelAnimationFrame(requestId);

    gamePlaying = false;
    paused = false;

    winMenu.style.display = '';

    gameOverMenu.style.display = 'none';
    levelMenu.style.display = 'none';
	optionsMenu.style.display = 'none';

    pauseButton.style.display = 'none';
    pauseMenu.style.display = 'none';

	countdown.style.display = 'none';
	setTimeout(function() {
        fpsElement.innerHTML = 'Level complete';
    }, 15);

    // Make canvas shake
    shakeFramesLeft = 15;
    shakeMagnitude = 30;
    shakeMagnitudeDelta = -2;
    shakeCanvas();
}


function startGame() {
    // Starts game.
    // If already playing (but is paused),
    // resumes.
    if (!gamePlaying) {
        startTime = performance.now();
        lastFrameTime = startTime;
		startTime += COUNTDOWN_DURATION;

        gamePlaying = true;
        paused = false;

		hasRenderedPreview = false;

        // reset vars
        playerPos = [0.0, 0.0, 0.0];
        playerSpeed = 1.0;
		playerRotation = 0.0;
        projectileExists = false;
        // Create a copy of the obstacles
        // We have to make a deep copy so we don't
        // modify the originals.
        obstacles = [];
        for (var i = 0; i < levels[currentLevel].obstacles.length; ++i) {
            var x = levels[currentLevel].obstacles[i];
            // We do .slice() on x.pos to create a copy
            // of the array.
            obstacles.push(new Obstacle(x.pos.slice(), x.angle, x.type, x.mid, x.destroyable, x.chasePlayer));
        }
        winPosition = levels[currentLevel].winPosition;

        // show pause button, hide pause menu
        pauseButton.style.display = '';
        pauseMenu.style.display = 'none';

        // make menus invisible
        gameOverMenu.style.display = 'none';
        winMenu.style.display = 'none';
        levelMenu.style.display = 'none';
		optionsMenu.style.display = 'none';

        countdown.style.display = '';

		fpsElement.innerHTML = 'Starting game';

        // reset container position
        container.style.transform = 'translate(0px, 0px)';

        if (FIX_LATE_COUNTDOWN) {
            render(performance.now());
        } else {
            requestId = requestAnimationFrame(render, canvas);
        }
    } else if (paused) {
        // We just resume the render loop.
        // First, account for the time that the
        // game has spent not running.
        var deltaTime = performance.now() - pauseTime;
        startTime += deltaTime;
        lastFrameTime += deltaTime;

        // don't reset game state

        gamePlaying = true;
        paused = false;

        // show pause button, hide pause menu
        pauseButton.style.display = '';
        pauseMenu.style.display = 'none';

        // ensure menus are invisible
        gameOverMenu.style.display = 'none';
        winMenu.style.display = 'none';
        levelMenu.style.display = 'none';
		optionsMenu.style.display = 'none';

        container.style.transform = 'translate(0px, 0px)';

        if (FIX_LATE_COUNTDOWN) {
            render(performance.now());
        } else {
            requestId = requestAnimationFrame(render, canvas);
        }
    }
}


function pauseGame() {
    if (!gamePlaying) {
        // We're not actually in-game.
        return;
    }
    // stop rendering
    cancelAnimationFrame(requestId);

	// We only set the pause time the first
	// time we pause the game. Subsequent times
	// (e.g. by going back from the options menu)
	// will not change the pause time.
	if (!paused) {
		pauseTime = performance.now();
		paused = true;
	}

    pauseButton.style.display = 'none';
    pauseMenu.style.display = '';

    // just in case...
    gameOverMenu.style.display = 'none';
    winMenu.style.display = 'none';
    levelMenu.style.display = 'none';
	optionsMenu.style.display = 'none';
}


function handleVisibilityChange() {
    if (document.hidden) {
        // we just left the tab.
        // pause
        pauseGame();
    }
}


function moveLights() {
	// Move the 'player light' to near the player
    // We scale down the player position to prevent
    // the light from getting close to a wall,
    // which would cause artifacts.
    lights[0].pos[0] = playerPos[0]*0.8;
    lights[0].pos[1] = playerPos[1] + 4.0;
    lights[0].pos[2] = playerPos[2];

    // Prevent it from going past the win location
    lights[0].pos[2] = Math.max(lights[0].pos[2], winPosition + 5);

    // Also another light
    lights[1].pos[0] = 0.0;
    lights[1].pos[1] = playerPos[1] + 5.0;
    lights[1].pos[2] = playerPos[2] - 60.0;

    // Also prevent it from going past the win position
    lights[1].pos[2] = Math.max(lights[1].pos[2], winPosition + 5);

    // Also the secondary forwards light
    lights[2].pos[0] = 0.0;
    lights[2].pos[1] = playerPos[1] + 5.0;
    lights[2].pos[2] = playerPos[2] - 30.0;

    // Also prevent it from going past the win position
    lights[2].pos[2] = Math.max(lights[2].pos[2], winPosition + 5);

    // Also projectile light
    if (projectileExists) {
        // Set colour to rotating wall colour
        lights[3].colour = materials[1].diffuse;

        lights[3].pos[0] = projectilePos[0]*0.8;
        lights[3].pos[1] = projectilePos[1] + 3.0;
        lights[3].pos[2] = projectilePos[2];
        lights[3].intensity = 2.0;
    } else {
        lights[3].intensity = 0.0;
    }

    // Also, ending / win position light
    lights[4].pos[0] = 0.0;
    lights[4].pos[1] = 2.0;
    lights[4].pos[2] = winPosition + 5.0;
}


// This functions makes obstacles
// move towards the player, and
// returns true if any obstacles
// were moved, otherwise false.
function chasePlayer(chaseSpeed) {
    var anyMoved = false;
    for (var i = 0; i < obstacles.length; ++i) {
        if (obstacles[i].chasePlayer) {
            // This obstacle is one that
            // can move towards the player.

            anyMoved = true;
            // make obstacle move towards player
            obstacles[i].pos = mix3(obstacles[i].pos, playerPos, chaseSpeed);
        }
    }
    return anyMoved;
}


// This is the rendering function.
// This will cause WebGL to render
// the scene, and does most of
// the game logic.
function render(time) {
    // sanity check
    if (program === null) {
        // The program hasn't loaded yet!
        return;
    }

	// temporary rotation matrices
	var m, pm;

    // setup the browser for the
	// next frame
    requestId = requestAnimationFrame(render, canvas);

    // check if player has won level
    if (playerPos[2] <= winPosition) {
        winGame();
    }

	var deltaTime = time - lastFrameTime;
	var currentTime = time - startTime;

	// If we're in the countdown and
	// we haven't rendered the preview yet
	if (currentTime < 0 && !hasRenderedPreview) {
		// Render a level preview.
		// Comments are basically all removed
		// here for conciseness.
		gl.useProgram(program);

		gl.uniform2f(screenSizeUniform, canvas.width, canvas.height);
		gl.uniform1f(timeUniform,0.0);

		materials[1].diffuse = [0.35,0.25,0.7];

		moveLights();
		setLightUniforms(lights);
		setDirectionalLightUniforms(directionalLights);
		setMaterialUniforms(materials);
		setObstacleUniforms(obstacles);

		m = mult3(mult3(rotateY(angle[0]), rotateX(angle[1])), rotateZ(angle[2]));
		m = trans3(m);

		gl.uniformMatrix3fv(viewToWorldUniform, false, new Float32Array(m));

		gl.uniform1f(winPositionUniform, winPosition);

		pm = rotateZ(playerRotation);
		gl.uniformMatrix3fv(invPlayerRotationUniform, false, new Float32Array(pm));

		gl.uniform3fv(playerPosUniform, new Float32Array(playerPos));

		gl.uniform1f(projectileExistsUniform, projectileExists);
		if (projectileExists) {
			gl.uniform3fv(projectilePosUniform, new Float32Array(projectilePos));
		}

        cameraPos[1] = playerPos[1] + 4.5;
        cameraPos[2] = playerPos[2] + 20.0;
		gl.uniform3fv(cameraPosUniform, new Float32Array(cameraPos));

		gl.bindFramebuffer(gl.FRAMEBUFFER, null);

		gl.clearColor(0.0, 0.0, 0.0, 1.0);
		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.uniform1f(isCollisionDetectionUniform, false);

		gl.drawArrays(gl.TRIANGLES, 0, 6);
		gl.finish();
	}

	hasRenderedPreview = true;

	if (currentTime < 0) {
		// During countdown
		countdown.innerHTML = Math.min(-Math.floor(currentTime / 1000), Math.floor(COUNTDOWN_DURATION / 1000));
        countdown.style.opacity = 1.0;

		lastFrameTime = time;

        fpsElement.innerHTML = 'Starting game';

		return;
	} else if (currentTime < 1000) {
		// Display the word 'Go'
		countdown.innerHTML = 'GO';
        countdown.style.opacity = (1.0 - currentTime / 1000);
	} else {
		countdown.style.display = 'none';
	}

    // Update the scene
    var isMovingRight = (rightPressed && !leftPressed);
    var isMovingLeft  = (leftPressed && !rightPressed);

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

	// Speed up
	playerSpeed += deltaTime*0.000005;

	// Rotate wall colour
	materials[1].diffuse = rotateHue([0.35,0.25,0.7], currentTime*0.01);

	// Tell WebGL to use our shader program.
    gl.useProgram(program);

	// Set the uniforms
    gl.uniform2f(screenSizeUniform, canvas.width, canvas.height);
    // divide by 1000: ms -> s
    gl.uniform1f(timeUniform,currentTime/1000.0);

    setMaterialUniforms(materials);
    setObstacleUniforms(obstacles);

    // We need to calculate the rotation matrix from
    // view to world.
    // First get the transformation matrix.
    m = mult3(mult3(rotateY(angle[0]), rotateX(angle[1])), rotateZ(angle[2]));
    // We transpose the matrix to make WebGL happy.
    m = trans3(m);
    // Now set the uniform.
    gl.uniformMatrix3fv(viewToWorldUniform, false, new Float32Array(m));



    // Write the win position.
    // Not strictly necessary to do every frame.
    gl.uniform1f(winPositionUniform, winPosition);

	// Render to the collision texture.
	// The fragment shader writes to the
	// red and green components of the
	// pixel at (0,0), indicating
	// which obstacle the player and the
	// projectile have collided with respectively.
	// 255 indicates no collision.
	gl.bindFramebuffer(gl.FRAMEBUFFER, collisionFramebuffer);

	gl.uniform1f(isCollisionDetectionUniform, true);

	// how far out the wall is at the moment.
    var wallDist = 4.5 + Math.sin(0.1 * playerPos[2]) * 0.5;

	// Collision detection.
	// Move player + projectile in increments.
	for (var i = 0; i < NUM_PHYSICS_SUBSTEPS; ++i) {
		// The player rotation and movement
		// are linked, to make movement smooth.
		// In particular, the player moves
		// based on their rotation.
		// We subtract the player rotation
		// instead of adding it since the rotation
		// is anticlockwise.
		playerPos[0] -= (playerRotation/maxRotation)*deltaTime*movementSpeed*0.01/NUM_PHYSICS_SUBSTEPS;

		// If the player is touching the wall, we
		// want to rotate them back in the other direction,
		// to bounce them off.
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
		}

		// We calculate the rotation matrix for player rotation.
		// First calculate the transformation matrix.
		pm = rotateZ(playerRotation);

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

		// Move player forwards
		playerPos[2] -= deltaTime*playerSpeed*0.02/NUM_PHYSICS_SUBSTEPS;

		// Player pos uniform
		gl.uniform3fv(playerPosUniform, new Float32Array(playerPos));

        // chasePlayer makes obstacles chase the player.
        // returns true if any obstacles were moved, in which
        // case the obstacle uniforms must be changed.
        if (chasePlayer(obstacleChaseSpeed*deltaTime*0.0003/NUM_PHYSICS_SUBSTEPS)) {
            setObstacleUniforms(obstacles);
        }

        // Move camera to player
        cameraPos[1] = playerPos[1] + 4.5;
        cameraPos[2] = playerPos[2] + 20.0;

		// Move the projectile (if it exists, of course.)
		if (projectileExists) {
			projectilePos[2] -= deltaTime*(originalProjectileSpeed*0.01+relativeProjectileSpeed*0.08)/NUM_PHYSICS_SUBSTEPS;
		}

		if (projectileExists &&
			((projectilePos[2] - cameraPos[2]) < -288.0 ||
			  projectilePos[2] < winPosition - 0.5)) {
			// The projectile is out of view.
			// So it's reshootable.
			projectileExists = false;
		}

		// Projectile uniform
		gl.uniform1f(projectileExistsUniform, projectileExists);
		if (projectileExists) {
			// We want to send the data to be drawn.
			gl.uniform3fv(projectilePosUniform, new Float32Array(projectilePos));
		}

		// Background colour: all zeroes
		gl.clearColor(0.0, 0.0, 0.0, 0.0);
		// Clear the texture.
		gl.clear(gl.COLOR_BUFFER_BIT);

		// Execute the shader programs
		// The gl.TRIANGLES indicates to draw triangles;
		// the 6 indicates there are 6 vertices.
		// This is done after updating to ensure
		// the drawn version is as up-to-date
		// as possible.
		gl.drawArrays(gl.TRIANGLES, 0, 6);
		// Wait for drawing to finish
		gl.finish();

		// Use collision information
		var collisionData = new Uint8Array(4);
		gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE, collisionData);

        var obstacleToRemove = null;

		if (collisionData[1] != 255) {
			// Destroy projectile
			projectileExists = false;

			// Get rid of the collided obstacle
			obstacleToRemove = collisionData[1];
		}

		if (collisionData[0] != 255) {
			// Player collision: you lose!
			if (collisionData[0] != obstacleToRemove) {
				loseGame();
				break;
			}
		}

		// Remove the obstacle
        // (obviously we only do this if it's destroyable)
		if (obstacleToRemove !== null && obstacles[obstacleToRemove].destroyable) {
			obstacles[obstacleToRemove].exists = false;

			// We'll want to re-send the data about
			// obstacles as well, so the removed one isn't
			// rendered.
			setObstacleUniforms(obstacles);
		}
	}

	// Move lights to player
	moveLights();
	setLightUniforms(lights);
	setDirectionalLightUniforms(directionalLights);

	// Camera pos uniform
	gl.uniform3fv(cameraPosUniform, new Float32Array(cameraPos));


    // The following code is for actual rendering
	// to the canvas.

	// bind canvas as framebuffer
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

	gl.uniform1f(isCollisionDetectionUniform, false);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.finish();

    // if the player is close to the win position,
    // vibrate the canvas.
    if (playerPos[2] <= winPosition + 50 && playerPos[2] > winPosition) {
        var mag = (50 - (playerPos[2] - winPosition)) * 0.6;
        var randX = random(-mag * 0.4, mag * 0.4);
        // we want the random Y movement to be less
        var randY = random(-mag * 0.1, mag * 0.1);
        var randRot = random(-mag * 0.03, mag * 0.03);

        container.style.transform = 'rotate(' + randRot + 'deg) translate(' + randX + 'px, ' + randY + 'px)';
    }

    // Now we do FPS calculation.
    var fps = 1000/deltaTime;
    fpsElement.innerHTML = "FPS: "+fps.toFixed(2);
    
    lastFrameTime = time;
}


function takeScreenshot() {
    // Takes a screenshot.
    // https://stackoverflow.com/questions/8191083/can-one-easily-create-an-html-image-element-from-a-webgl-texture-object

    // bind screenshot framebuffer
	gl.bindFramebuffer(gl.FRAMEBUFFER, screenshotFb);

    // change viewport
    gl.viewport(0, 0, screenshotWidth, screenshotHeight);
    gl.uniform2f(screenSizeUniform, screenshotWidth, screenshotHeight);

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // just in case
	gl.uniform1f(isCollisionDetectionUniform, false);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.finish();

    // reset viewport
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(screenSizeUniform, canvas.width, canvas.height);

    // screenshot information
    gl.readPixels(0, 0, screenshotWidth, screenshotHeight, gl.RGBA, gl.UNSIGNED_BYTE, screenshotData);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // WebGL uses a different coordinate system to canvas,
    // so we have to invert it. We do this by
    // storing the pixel information from WebGL, and then
    // drawing the image onto itself but upside down.
    screenshotCtx.setTransform(1, 0, 0, -1, 0, screenshotHeight);
    var imageData = screenshotCtx.createImageData(screenshotWidth, screenshotHeight);
    imageData.data.set(screenshotData);
    // This does not take into account the transformation.
    screenshotCtx.putImageData(imageData, 0, 0);
    // This takes into account the transformation.
    screenshotCtx.drawImage(screenshotCanvas, 0, 0);

    screenshotCanvas.toBlob(function(blob) {
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'screenshot.png';
        a.innerHTML = 'download';
        a.click();
    });
}


function handleContextLost(event) {
    event.preventDefault();
    console.log('The WebGL context was lost.');
    if (gamePlaying) {
		pauseGame();
	}
}


function initGame() {
    canvas = document.getElementById('canvas');
    screenshotCanvas = document.getElementById('screenshot-canvas');
    container = document.getElementById('container');
    levelMenu = document.getElementById('levelMenu');
    gameOverMenu = document.getElementById('gameOverMenu');
    winMenu = document.getElementById('winMenu');
    pauseButton = document.getElementById('pause');
    pauseMenu = document.getElementById('pauseMenu');
	optionsMenu = document.getElementById('optionsMenu');
    fpsElement = document.getElementById('fps');
	physicsSubstepsInput = document.getElementById('numPhysicsSubsteps');
	optionsBackButton = document.getElementById('returnButton');
	screenshotWInput = document.getElementById('screenshotW');
	screenshotHInput = document.getElementById('screenshotH');
	countdown = document.getElementById('countdown');

	// set default number of physics substeps
    // for the input on the options page
	physicsSubstepsInput.value = NUM_PHYSICS_SUBSTEPS;

	// set default screenshot size
    // for the input on the options page
	screenshotWInput.value = screenshotWidth;
	screenshotHInput.value = screenshotHeight;
    
    // set screenshot canvas size
    screenshotCanvas.width = screenshotWidth;
    screenshotCanvas.height = screenshotHeight;

    // allows us to draw on the screenshot
    // canvas, which in turn allows us to
    // convert the drawn image to a png,
    // which we can save locally.
    screenshotCtx = screenshotCanvas.getContext('2d');

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
    // we should reload it.
    canvas.addEventListener(
        'webglcontextlost', handleContextLost, false
    );
    
    // When restored, we redo the
    // setup stages.
    canvas.addEventListener(
        'webglcontextrestored', setupWebGLState, false
    );
    
    // Add buttons for level selection
    // to the level select menu.
    addLevelButtons(levelMenu);

    
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

    // We use some XMLHttpRequests.
    // We do this asynchronously,
    // hence the nesting of
    // 'onload' functions.
    // The render loop handles the
    // case that the shader has not
    // yet compiled (i.e. the files
    // have not yet been loaded),
    // with the line
    // if (program === null).
    var vertReq = new XMLHttpRequest();
    vertReq.onload = function() {
        vertShaderSrc = this.response;
        
        var fragReq = new XMLHttpRequest();
        fragReq.onload = function() {
            fragShaderSrc = this.response;
            
            var obstReq = new XMLHttpRequest();
            obstReq.onload = function() {
                obstacleSrc = this.response;

                // Replace the placeholder in the fragment shader source
                // with the obstacle source.

                fragShaderSrc = fragShaderSrc.replace('_PLACEHOLDER_FOR_OBSTACLE_DISTANCE_FUNCTIONS', obstacleSrc);

                setupWebGLState();

                // Add event listeners
                // for the movement buttons
                document.addEventListener("keydown", keyDownHandler, false);
                document.addEventListener("keyup", keyUpHandler, false);
                // Add event listener for tab change
                // (pause)
                document.addEventListener("visibilitychange", handleVisibilityChange, false);

                // Launch into level selection
                selectLevel();
            };
            obstReq.open("GET", "obstacles.glsl");
            obstReq.responseType = "text";
            obstReq.send();
        };
        fragReq.open("GET", "fragment-shader.glsl");
        fragReq.responseType = "text";
        fragReq.send();
    };
    vertReq.open("GET", "vertex-shader.glsl");
    vertReq.responseType = "text";
    vertReq.send();
}
