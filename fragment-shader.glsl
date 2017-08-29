// medium float precision
precision mediump float;

// screen resolution
uniform vec2 screenSize;
// camera position
uniform vec3 cameraPos;
// player position
uniform vec3 playerPos;
// INVERSE player rotation matrix
uniform mat3 invPlayerRot;
// rotation matrix
// from camera view
// to the world view.
uniform mat3 viewToWorld;
// current time,
// in seconds
uniform float time;

const int MAX_MARCH_STEPS = 128;
const int MAX_SHADOW_MARCH_STEPS = 128;
const float NEAR_DIST = 0.01;
const float FAR_DIST = 100.0;
const float FOV = 45.0;
const float EPSILON = 0.001;
const float NORMAL_EPSILON = 0.000001;
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
        triangle(invPlayerRot*(p-playerPos), a, b, c),
        triangle(invPlayerRot*(p-playerPos), b, c, d)
    );

    return HitPoint(playerDist, 0);
}

// Estimate normal at a point
// for lighting calcs
vec3 estimateNormal(vec3 p) {
    vec2 eps = vec2(NORMAL_EPSILON, 0.0);
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


// Calculates the amount that a pixel
// is in shadow from a light.
// Based on http://www.iquilezles.org/www/articles/rmshadows/rmshadows.htm
float shadow(vec3 p, vec3 direction, float near, float far, float k) {
	float depth=near;
	float dist =0.0;
	// currently 1.0 - shadowing amount
	float res = 1.0;
	// prevent overstepping
	float s = far * 32.0 / float(MAX_MARCH_STEPS);
	// while loops are not allowed
	for (int i=0; i<MAX_SHADOW_MARCH_STEPS; ++i) {
		// similar to normal sphere marching
		// but we keep track of res
		dist = scene(p + depth*direction).dist;
		res = min(res, k*dist/depth);

		depth += min(dist, s*8.0);
		if (depth >= far || dist < EPSILON) {
			break;
		}
	}

	return clamp(res, 0.0, 1.0);
}


// Phong lighting of a point.
// Includes attenuation i.e. lights
// are weaker from father away.
// See Wikipedia for an explanation
// of how this algorithm works.
vec3 phongLighting(vec3 diffuse_col, vec3 specular_col, float alpha,
                   vec3 p, vec3 normal, vec3 cam, vec3 viewerNormal,
                   vec3 lightPos, vec3 lightColour, float intensity) {
	// The normal at the point
    vec3 N = normal;
	// This is used for attenuation
	// calculation.
	vec3 relativePos = lightPos - p;
	vec3 L = normalize(relativePos);
	vec3 V = viewerNormal;
	vec3 R = normalize(reflect(-L, N));

	float dotLN = dot(L, N);
	float dotRV = dot(R, V);

	if (dotLN < 0.0) {
		// The surface is facing away
		// from the light i.e.
		// receives no light.
		// Since this function returns
		// the colour, obviously
		// this pixel is completely black.
        // (or the contribution from this
        //  light, at least, is nothing.)
		return vec3(0.0);
	}

	float squareDist = dot(relativePos, relativePos);

	// This contains (1 / light range)^2.
	// If different lights have different
	// ranges, this should be precalculated
	// before every frame.
	float reciprocalLightRangeSquared = 0.003;
	float attenuatedIntensity = 1.0 - squareDist * reciprocalLightRangeSquared;

	if (attenuatedIntensity < 0.0) {
		// The point is clearly completely
		// unlit, since it is outside
		// the light's range.
		return vec3(0.0);
	}

	// Now square and multiply by
	// the light's actual intensity.
	attenuatedIntensity *= attenuatedIntensity * intensity;

	if (dotRV < 0.0) {
		// The surface has no specular lighting
		return (diffuse_col*dotLN)*lightColour * attenuatedIntensity;
	}

	// Approximate the specular component
	const int gamma = 8;
	const int gamma_log2 = 3;
	float calculated_specular = (1.0 - alpha * (1.0-dotRV)/float(gamma));
	for (int i=0; i<gamma_log2; ++i) {
		calculated_specular *= calculated_specular;
	}

	return (diffuse_col*dotLN + specular_col*calculated_specular)*lightColour * attenuatedIntensity;
}


// Phong lighting, but for directional lights.
vec3 directionalPhongLighting(vec3 diffuse_col, vec3 specular_col, float alpha,
                              vec3 p, vec3 normal, vec3 cam, vec3 viewerNormal,
                              vec3 lightDirection, vec3 lightColour, float intensity) {
    vec3 N = normal;
	vec3 L = -lightDirection;
	vec3 V = viewerNormal;
	vec3 R = normalize(reflect(-L, N));

	float dotLN = dot(L, N);
	float dotRV = dot(R, V);

	if (dotLN < 0.0) return vec3(0.0);
	// Attenuation doesn't make sense
	// with directional lights, so
	// we omit it.
	if (dotRV < 0.0) return (diffuse_col*dotLN)*lightColour*intensity;

	const int gamma = 8;
	const int gamma_log2 = 3;
	float calculated_specular = (1.0 - alpha * (1.0-dotRV)/float(gamma));
	for (int i=0; i<gamma_log2; ++i) {
		calculated_specular *= calculated_specular;
	}

	return (diffuse_col*dotLN + specular_col*calculated_specular)*lightColour*intensity;
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
    
    // point lighting
	// for loops must have constant
	// expressions to compare with,
	// so we must work around this.
    for (int i=0; i<MAX_NUM_LIGHTS; ++i) {
		// workaround
		if (i >= numLights) break;

        vec3 tmp = phongLighting(diffuse_col, specular_col, alpha, p, normal, cam, viewerNormal, lightPos[i], lightColour[i], lightIntensity[i]);

		// if the point is lit at all:
		if (tmp != vec3(0.0)) {
			// calculate shadowing
			vec3 relPos = lightPos[i] - p;
			float dist = length(relPos);
            vec3 norm = relPos / dist;
            // The reason we add norm*EPSILON*2
            // is to move the start point for the
            // shadowing slightly away from the
            // point which we originally intersected,
            // to prevent artefacts when the normal is
            // almost perpendicular to the light.
			tmp *= shadow(p + norm*EPSILON*2.0, norm, EPSILON*2.0, dist, 8.0);
		}

		colour += tmp;
    }
    
    // directional lighting
    for (int i=0; i<MAX_NUM_DIRECTIONAL_LIGHTS; ++i) {
		if (i >= numDirectionalLights) break;
        vec3 tmp = directionalPhongLighting(diffuse_col, specular_col, alpha, p, normal, cam, viewerNormal, directionalLightDirection[i], directionalLightColour[i], directionalLightIntensity[i]);

		if (tmp != vec3(0.0)) {
			// We arbitrarily set the
			// 'far' plane to 100,
			// so if an object is not
			// in shadow within 100
			// units it is not
			// in shadow at all.
			tmp *= shadow(p - directionalLightDirection[i]*EPSILON*2.0, -directionalLightDirection[i], EPSILON*2.0, 100.0, 8.0);
		}

		colour += tmp;
    }

	return colour;
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
