// medium float precision
precision mediump float;

// screen resolution
uniform vec2 screenSize;
// camera position
uniform vec3 cameraPos;
// rotation matrix
// from camera view
// to the world view.
uniform mat3 viewToWorld;

const int MAX_MARCH_STEPS = 128;
const float NEAR_DIST = 0.01;
const float FAR_DIST = 100.0;
const float FOV = 45.0;
const float EPSILON = 0.001;
const float stepScale = 0.90;

// For lighting of materials.
vec3 AMBIENT_COLOUR = vec3(0.1,0.1,0.1);
vec3 DIFFUSE_COLOUR = vec3(0.7,0.7,0.7);
vec3 SPECULAR_COLOUR = vec3(1.0,1.0,1.0);
float SHININESS = 8.0;
float ambientIntensity = 1.0;


// To pass light data in/out of the shader
const int MAX_NUM_LIGHTS = 32;
const int MAX_NUM_DIRECTIONAL_LIGHTS = 32;

uniform vec3 lightPos[MAX_NUM_LIGHTS];
uniform vec3 lightColour[MAX_NUM_LIGHTS];
uniform float lightIntensity[MAX_NUM_LIGHTS];

uniform vec3 directionalLightDirection[MAX_NUM_DIRECTIONAL_LIGHTS];
uniform vec3 directionalLightColour[MAX_NUM_DIRECTIONAL_LIGHTS];
uniform float directionalLightIntensity[MAX_NUM_DIRECTIONAL_LIGHTS];

uniform int numLights;
uniform int numDirectionalLights;


struct HitPoint {
    float dist; // distance to scene
    int id; // object id
};

// Helper functions for HitPoint
HitPoint min(HitPoint a, HitPoint b) {
    if (a.dist < b.dist) {
        return a;
    } else {
        return b;
    }
}

HitPoint max(HitPoint a, HitPoint b) {
    if (a.dist > b.dist) {
        return a;
    } else {
        return b;
    }
}

// squared length
float len2(vec3 v) {
    return dot(v,v);
}

// Inigo Quillez:
// http://iquilezles.org/www/articles/distfunctions/distfunctions.htm
float triangle(vec3 p, vec3 a, vec3 b, vec3 c) {
    vec3 ba = b - a; vec3 pa = p - a;
    vec3 cb = c - b; vec3 pb = p - b;
    vec3 ac = a - c; vec3 pc = p - c;
    vec3 nor = cross(ba, ac);
    
    if (sign(dot(cross(ba,nor),pa)) +
        sign(dot(cross(cb,nor),pb)) +
        sign(dot(cross(ac,nor),pc)) < 2.0) {
        return sqrt(min(min(
            len2(ba*clamp(dot(ba,pa)/len2(ba),0.0,1.0)-pa),
            len2(cb*clamp(dot(cb,pb)/len2(cb),0.0,1.0)-pb)),
            len2(ac*clamp(dot(ac,pc)/len2(ac),0.0,1.0)-pc))
        );
    } else {
        return sqrt(dot(nor,pa)*dot(nor,pa)/len2(nor));
    }
}
    

// Distance function for the scene
HitPoint scene(vec3 p) {
    // player distance
    vec3 a = vec3(-1,0, 0.3),
         b = vec3( 0,0.1, 0),
         c = vec3( 0,0,-1),
         d = vec3( 1,0, 0.3);
    float playerDist = min(
        triangle(p, a, b, c),
        triangle(p, b, c, d)
    );
    return HitPoint(playerDist, 0);
}

// Estimate normal at a point
// for lighting calcs
vec3 estimateNormal(vec3 p) {
    vec2 eps = vec2(EPSILON, 0.0);
    return normalize(vec3(
                scene(p+eps.xyy).dist - scene(p-eps.xyy).dist,
                scene(p+eps.yxy).dist - scene(p-eps.yxy).dist,
                scene(p+eps.yyx).dist - scene(p-eps.yyx).dist));
}

// Cast a ray using sphere marching
HitPoint castRay(vec3 camera, vec3 direction, float near, float far) {
    float depth = near;
    HitPoint current;
    for (int i=0; i<MAX_MARCH_STEPS; ++i) {
        current = scene(camera + depth * direction);
        if (abs(current.dist) < EPSILON) break;
        depth += current.dist * stepScale;
        if (depth >= far) break;
    }
    return HitPoint(depth, current.id);
}


// Phong lighting of a point.
vec3 phongLighting(vec3 diffuse_col, vec3 specular_col, float alpha,
                   vec3 p, vec3 normal, vec3 cam, vec3 viewerNormal,
                   vec3 lightPos, vec3 lightColour, float intensity) {
    
}


// Phong lighting, but for directional lights.
vec3 directionalPhongLighting(vec3 diffuse_col, vec3 specular_col, float alpha,
                              vec3 p, vec3 normal, vec3 cam, vec3 viewerNormal,
                              vec3 lightDirection, vec3 lightColour, float intensity) {
    
}


// This function calculates the colour of a pixel according to
// the lighting and its diffuse colour.
vec3 lighting(vec3 ambient_col, vec3 diffuse_col, vec3 specular_col,
              float alpha, vec3 p, vec3 cam, float ambientIntensity,
              vec3 lightPos[MAX_NUM_LIGHTS], vec3 lightColour[MAX_NUM_LIGHTS],
              float lightIntensity[MAX_NUM_LIGHTS], int numLights,
              vec3 directionalLightDirection[MAX_NUM_DIRECTIONAL_LIGHTS],
              vec3 directionalLightColour[MAX_NUM_DIRECTIONAL_LIGHTS],
              float directionalLightIntensity[MAX_NUM_DIRECTIONAL_LIGHTS], int numDirectionalLights) {
    // current colour
    vec3 colour = ambient_col * ambientIntensity;
    
    // normals
    vec3 normal = estimateNormal(p);
    vec3 viewerNormal = normalize(cam - p);
    
    // normal lighting
    for (int i=0; i<numLights; ++i) {
        
    }
    
    // directional lighting
    for (int i=0; i<numDirectionalLights; ++i) {
        
    }
}



// This function centers coordinates on
// the screen, so instead of going
// from 0 -> screen size in the x and y directions
// the coordinates go from
// -screen size / 2 -> screen size / 2.
vec2 centerCoordinates(vec2 coord, vec2 size) {
    return coord - 0.5*size;
}


// This function calculates the direction
// of the ray given the:
//   Field of View of the camera
//   The screen-space coordinates of the pixel
//   The size of the screen
vec3 direction(float fov, vec2 coord, vec2 size) {
    vec2 xy = centerCoordinates(coord, size);
    // Calculate the z component based on angle
    float z = size.y / tan(radians(fov) * 0.5);
    
    vec3 tmp = vec3(xy, -z);
    return normalize(tmp);
}


void main() {
    // Calculate ray direction.
    // gl_FragCoord.xy is the position of the
    // pixel in screen space.
    vec3 rayDir = direction(FOV, gl_FragCoord.xy, screenSize);
    
    // Convert the ray direction to world coordinates.
    vec3 worldRayDir = viewToWorld * rayDir;
    
    // Cast a ray
    HitPoint result = castRay(cameraPos, worldRayDir, NEAR_DIST, FAR_DIST);
    if (result.dist < FAR_DIST - EPSILON) {
        // Calculate colour based on lights
        vec3 colour = lighting(AMBIENT_COLOUR, DIFFUSE_COLOUR, SPECULAR_COLOUR,
                               SHININESS, cameraPos + worldRayDir*result.dist, cameraPos, ambientIntensity,
                               lightPos, lightColour, lightIntensity, numLights,
                               directionalLightDirection, directionalLightColour, directionalLightIntensity, numDirectionalLights);
        gl_FragColor = vec4(colour,1);
    } else {
        gl_FragColor = vec4(0,0,0,1);
    }
}