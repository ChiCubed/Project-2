HitPoint obstacleDist0(vec3 p, int mid, int oid) {
    // Box
    vec3 d = abs(p) - BOX_SIZE;
    return HitPoint(
        min(max(d.x,max(d.y,d.z)),0.0) + length(max(d,0.0)),
        mid, oid
    );
}

HitPoint obstacleDist1(vec3 p, int mid, int oid) {
    // Torus
    vec2 q = vec2(length(p.xy)-TORUS_SIZE.x,p.z);
    return HitPoint(
        length(q)-TORUS_SIZE.y,
        mid, oid
    );
}

HitPoint obstacleDist2(vec3 p, int mid, int oid) {
    // Sphere
    return HitPoint(
        length(p)-SPHERE_SIZE.x,
        mid, oid
    );
}
