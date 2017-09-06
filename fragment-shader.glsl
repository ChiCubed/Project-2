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
const int MAX_SHADOW_MARCH_STEPS = 64;
const float NEAR_DIST = 0.01;
const float FAR_DIST = 256.0;
float FOV = 45.0;
const float EPSILON = 0.001;
const float NORMAL_EPSILON = 0.01;
const float stepScale = 0.90;

// For lighting of materials.
vec3 AMBIENT_COLOUR = vec3(0.1,0.1,0.1);
float ambientIntensity = 1.0;


// To pass light data in/out of the shader
const int MAX_NUM_LIGHTS = 32;
const int MAX_NUM_DIRECTIONAL_LIGHTS = 32;

uniform vec3 lightPos[MAX_NUM_LIGHTS];
uniform vec3 lightColour[MAX_NUM_LIGHTS];
uniform float lightIntensity[MAX_NUM_LIGHTS];
uniform float reciprocalLightRangeSquared[MAX_NUM_LIGHTS];

uniform vec3 directionalLightDirection[MAX_NUM_DIRECTIONAL_LIGHTS];
uniform vec3 directionalLightColour[MAX_NUM_DIRECTIONAL_LIGHTS];
uniform float directionalLightIntensity[MAX_NUM_DIRECTIONAL_LIGHTS];

uniform int numLights;
uniform int numDirectionalLights;

// Materials
const int MAX_NUM_MATERIALS = 32;

uniform vec3 materialDiffuseColour[MAX_NUM_MATERIALS];
uniform vec3 materialSpecularColour[MAX_NUM_MATERIALS];
uniform float materialShininess[MAX_NUM_MATERIALS];

uniform int numMaterials;

// Obstacles
const int MAX_NUM_OBSTACLES = 32;

uniform vec3 obstaclePos[MAX_NUM_OBSTACLES];
uniform mat3 obstacleInvRotation[MAX_NUM_OBSTACLES];
uniform int obstacleType[MAX_NUM_OBSTACLES];

uniform int numObstacles;

// Projectile
uniform vec3 projectilePos;

uniform bool projectileExists;

// for obstacles
const vec3 BOX_SIZE = vec3(0.7, 0.5, 0.7);
const vec3 TORUS_SIZE = vec3(1.5, 0.3, 0.0);


struct HitPoint {
    float dist; // distance to scene
    int mid; // material id
	int oid; // obstacle id
	// oid is only used for obstacles
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


float player(vec3 p) {
	// player distance
    const vec3 a = vec3(-1,  0, 0.3),
               b = vec3( 0,0.1,   0),
               c = vec3( 0,  0,  -2),
               d = vec3( 1,  0, 0.3);
    float playerDist = min(
        triangle(p, a, b, c),
        triangle(p, b, c, d)
    );

	return playerDist;
}


// smooth minimum.
// can be used to 'blend' objects
// http://www.iquilezles.org/www/articles/smin/smin.htm
float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5*(b-a)/k, 0.0, 1.0);
    return mix(b,a,h) - k*h*(1.0-h);
}

// Distance function for everything except the
// player, projectile, walls, floor, and ornaments.
// (Essentially, this is the obstacles.)
HitPoint sceneObstacles(vec3 p) {
    // Obstacles (materials 5+)
	HitPoint obstacleHit = HitPoint(FAR_DIST,0,-1);

	for (int i = 0; i < MAX_NUM_OBSTACLES; ++i) {
		if (i == numObstacles) break;
		vec3 tmp = obstacleInvRotation[i]*(p - obstaclePos[i]);
		HitPoint thisObstacle = HitPoint(0.0,0,0);

        // In GLSL, conditionals are generally slow,
        // so we try to not use them. Instead, we multiply
        // by booleans.

		float x = float(obstacleType[i]);

		// http://iquilezles.org/www/articles/distfunctions/distfunctions.htm

        // just an ordinary box (obstacle ID 0, material 4)
        thisObstacle.dist += length(max(abs(tmp)-BOX_SIZE,0.0)) * (1.0 - abs(sign(x)));
		thisObstacle.oid = 0;
        thisObstacle.mid += 5 * int(x == 0.0);

        // For torus (obstacle ID 1, material 5)
        vec2 q = vec2(length(tmp.xy)-TORUS_SIZE.x,tmp.z);
        thisObstacle.dist += (length(q)-TORUS_SIZE.y) * (1.0 - abs(sign(x - 1.0)));
		thisObstacle.oid += int(x == 1.0);
        thisObstacle.mid += 5 * int(x == 1.0);

        // Note that, if an obstacle has an invalid
        // ID, it'll cause the distance to be 0.
        // There isn't a conditional here to check for that,
        // since conditionals are expensive in GLSL.

        // if (thisObstacle.dist == 0.0) thisObstacle.dist = FAR_DIST;

		obstacleHit = min(obstacleHit, thisObstacle);
	}

    return obstacleHit;
}

// Distance function for the scene
HitPoint scene(vec3 p) {
    // player floats up and down
    float vertDisp = sin(time*2.0)*0.2;

    // player (material 0)
	// We subtract an extra vector
	// from p to translate the player
	// up and down, to give it the
	// appearance of floating.
    HitPoint playerHit  = HitPoint(player(invPlayerRot*(p - playerPos - vec3(0,vertDisp,0))),0,-1);
    // walls (material 1 or 3)
    float wallDist = min(5.5-p.x, 5.5+p.x);
	wallDist += sin(10.0*p.y)*0.1;
	wallDist += sin(0.1*p.z)*0.5;
    HitPoint wallHit    = HitPoint(wallDist,1,-1);
	if (mod(p.z, 10.0) > 5.0) {
		// checker pattern
		wallHit.mid = 3;
	}
    // floor (material 2)
    HitPoint floorHit   = HitPoint(2.0+p.y,2,-1);

    // ornaments (also material 2)
    // repeated infinitely
    vec3 mp = p;
    mp.xz = mod(p.xz,vec2(8.0,8.0))-vec2(4.0,4.0);
    mp.y += 2.0; // overlap floor
	// this is guaranteed not to
	// cause an overestimation of
    // distance, because of the
	// maximum derivative of sin.
	mp.y += sin(time*2.0+p.z*0.3);
    // creates spheres
    float ornamentDist = length(mp)-0.5;

    // we now want to 'blend' the spheres
    // and the floor, to make some
    // sort of lumps.
    // we do this using the 'smooth min' function.
    floorHit.dist = smin(floorHit.dist, ornamentDist, 0.4);

    // Projectile (material 4)
    // Obviously we only draw this if the projectile exists.
    HitPoint projectileHit = HitPoint(length(p - playerPos - vec3(0,vertDisp,-2.4))-0.3, 4, -1);
    if (projectileExists) projectileHit.dist = length(p-projectilePos)-0.3;

    // If the projectile doesn't exist, we can indicate this by
    // drawing it onto the player, to indicate they can shoot it.

    // obstacles
    HitPoint obstacleHit = sceneObstacles(p);

    // return the closest distance of all
    return min(playerHit,min(wallHit,min(floorHit,min(projectileHit,obstacleHit))));
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
    return HitPoint(depth, current.mid, current.oid);
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
// reciprocalRangeSquared is
// used for attenuation calculation.
vec3 phongLighting(vec3 diffuse_col, vec3 specular_col, float alpha,
                   vec3 p, vec3 normal, vec3 cam, vec3 viewerNormal,
                   vec3 lightPos, vec3 lightColour, float intensity,
                   float recLightRangeSqr) {
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
	float attenuatedIntensity = 1.0 - squareDist * recLightRangeSqr;

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
              float lightIntensity[MAX_NUM_LIGHTS],
              float reciprocalLightRangeSquared[MAX_NUM_LIGHTS], int numLights,
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

        vec3 tmp = phongLighting(diffuse_col, specular_col, alpha, p, normal, cam, viewerNormal, lightPos[i], lightColour[i], lightIntensity[i], reciprocalLightRangeSquared[i]);

		// if the point is lit at all:
		if (tmp != vec3(0.0)) {
			// calculate shadowing
			vec3 relPos = lightPos[i] - p;
			float dist = length(relPos);
            vec3 relDir = relPos / dist;
            // The reason we add norm*EPSILON*2
            // is to move the start point for the
            // shadowing slightly away from the
            // point which we originally intersected,
            // to prevent artefacts when the normal is
            // almost perpendicular to the light.
			tmp *= shadow(p + normal*EPSILON*2.0, relDir, EPSILON*2.0, dist, 8.0);
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
    // Determine diffuse, specular and shininess.
    // GLSL doesn't allow variable array indexing
    // (e.g. materialDiffuseColour[result.mid])
    // so this is a kind of hacky workaround.
    vec3 diffuse, specular;
    float shininess;
    for (int i=0; i<MAX_NUM_MATERIALS; ++i) {
        if (i == result.mid) {
            diffuse = materialDiffuseColour[i];
            specular = materialSpecularColour[i];
            shininess = materialShininess[i];
        }
    }
    if (result.dist < FAR_DIST - EPSILON) {
        // Calculate colour based on lights
        vec3 colour = lighting(AMBIENT_COLOUR, diffuse, specular,
                               shininess, cameraPos + worldRayDir*result.dist, cameraPos, ambientIntensity,
                               lightPos, lightColour, lightIntensity, reciprocalLightRangeSquared, numLights,
                               directionalLightDirection, directionalLightColour, directionalLightIntensity, numDirectionalLights);
        gl_FragColor = vec4(colour,1);
    } else {
        gl_FragColor = vec4(0.0,0,0,1);
    }
}
