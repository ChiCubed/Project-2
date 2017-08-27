// current vertex position
attribute vec2 position;

void main() {
    // gl_Position must be set
    // by the vertex shader
    gl_Position = vec4(position, 0.0, 1.0);
}