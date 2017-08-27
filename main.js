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
var viewToWorldUniform;

var numLightsUniform;
var lightPosUniform;
var lightColourUniform;
var lightIntensityUniform;

var numDirectionalLightsUniform;
var directionalLightDirectionUniform;
var directionalLightColourUniform;
var directionalLightIntensityUniform;

// Angle of the camera
// in left/right, up/down, tilt
var angle = [0.0, -0.6, 0.0];

// Camera position
var cameraPos = [0.0, 7.0, 10.0];

// For FPS calculation
var lastFrameTime;
var startTime;
var fpsElement; // paragraph element



// Light and DirectionalLight objects.
function Light(pos, colour, intensity) {
    this.pos = pos;
    this.colour = colour;
    this.intensity = intensity;
}

function DirectionalLight(direction, colour, intensity) {
    this.direction = direction;
    this.colour = colour;
    this.intensity = intensity;
}

var lights = [];
var directionalLights = [];

function setLightUniforms(lightArray) {
    gl.uniform1f(numLightsUniform, lightArray.count);
    // Three _flat_ arrays storing the:
    // positions, colours and intensities
    // of the lights.
    var pos = [];
    var colour = [];
    var intensity = [];
    for (var i=0; i<lightArray.count; ++i) {
        pos = pos.concat(lightArray[i].pos);
        colour = colour.concat(lightArray[i].colour);
        // since intensity is just a float we can do this
        intensity.push(lightArray[i].intensity);
    }
    // Now we set the values of the variables.
    gl.uniform3fv(lightPosUniform, new Float32Array(pos));
    gl.uniform3fv(lightColourUniform, new Float32Array(colour));
    gl.uniform3fv(lightIntensityUniform, new Float32Array(intensity));
}

function setDirectionalLightUniforms(directionalLightArray) {
    gl.uniform1f(numDirectionalLightsUniform, directionalLightArray.count);
    var direction = [];
    var colour = [];
    var intensity = [];
    for (var i=0; i<directionalLightArray.count; ++i) {
        direction = direction.concat(directionalLightArray[i].direction);
        colour = colour.concat(lightArray[i].colour);
        // since intensity is just a float we can do this
        intensity.push(lightArray[i].intensity);
    }
    gl.uniform3fv(directionalLightPosUniform, new Float32Array(direction));
    gl.uniform3fv(directionalLightColourUniform, new Float32Array(colour));
    gl.uniform3fv(directionalLightIntensityUniform, new Float32Array(intensity));
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

// tilt up/down
function rotateX(a) {
    return [1,           0,            0,
            0, Math.cos(a), -Math.sin(a),
            0, Math.sin(a),  Math.cos(a)];
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
    
    // Otherwise we log what went wrong.
    console.log(gl.getShaderInfoLog(shader));
    
    gl.deleteShader(shader);
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
    
    console.log(gl.getProgramInfoLog(program));
    
    gl.deleteProgram(program);
}


// This is the rendering function.
// This will cause WebGL to render
// the scene, and does most of
// the game logic.
function render(time) {
    requestAnimationFrame(render);
    
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
    setLightUniforms();
    setDirectionalLightUniforms();
    
    // We need to calculate the rotation matrix from
    // view to world.
    // First get the transformation matrix.
    var m = mult3(mult3(rotateY(angle[0]), rotateX(angle[1])), rotateZ(angle[2]));
    console.log(m);
    // We transpose the matrix to make WebGL happy.
    m = trans3(m);
    // Now set the uniform.
    gl.uniformMatrix3fv(viewToWorldUniform, false, new Float32Array(m));
    
    // Execute the shader programs
    // The gl.TRIANGLES indicates to draw triangles;
    // the 6 indicates there are 6 vertices.
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    
    
    // Now we do FPS calculation.
    var fps = 1000/(time - lastFrameTime);
    fpsElement.innerHTML = "FPS: "+fps.toFixed(2);
    
    lastFrameTime = time;
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
    
    // Load the shader source.
    var vertShaderSrc, fragShaderSrc;
    
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
            viewToWorldUniform = gl.getUniformLocation(program, "viewToWorld");
            
            numLightsUniform = gl.getUniformLocation(program, "numLights");
            lightPosUniform = gl.getUniformLocation(program, "lightPos");
            lightColourUniform = gl.getUniformLocation(program, "lightColour");
            lightIntensityUniform = gl.getUniformLocation(program, "lightIntensity");

            numDirectionalLightsUniform = gl.getUniformLocation(program, "numDirectionalLights");
            directionalLightDirectionUniform = gl.getUniformLocation(program, "directionalLightDirection");
            directionalLightColourUniform = gl.getUniformLocation(program, "directionalLightColour");
            directionalLightIntensityUniform = gl.getUniformLocation(program, "directionalLightIntensity");
        };
        fragReq.open("GET", "fragment-shader.glsl");
        fragReq.responseType = "text";
        fragReq.send();
    };
    vertReq.open("GET", "vertex-shader.glsl");
    vertReq.responseType = "text";
    vertReq.send();
    
    
    // Now we start the render loop
    startTime = performance.now();
    lastFrameTime = startTime;
    requestAnimationFrame(render);
}