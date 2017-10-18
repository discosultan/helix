'use strict';

if (!THREE.Effects) THREE.Effects = {};

(function(effects) {
    // ref: http://alteredqualia.com/three/examples/webgl_cubes.html
    var mixinCommon =
        'vec3 rotateVectorByQuaternion(vec3 v, vec4 q) { ' +
            'vec3 dest = vec3(0.0); ' +

            'float x = v.x, y = v.y, z = v.z; ' +
            'float qx = q.x, qy = q.y, qz = q.z, qw = q.w; ' +

            'float ix =  qw * x + qy * z - qz * y, ' +
                  'iy =  qw * y + qz * x - qx * z, ' +
                  'iz =  qw * z + qx * y - qy * x, ' +
                  'iw = -qx * x - qy * y - qz * z; ' +

            'dest.x = ix * qw + iw * -qx + iy * -qz - iz * -qy; ' +
            'dest.y = iy * qw + iw * -qy + iz * -qx - ix * -qz; ' +
            'dest.z = iz * qw + iw * -qz + ix * -qy - iy * -qx; ' +

            'return dest; ' +
        '} ' +

        'vec4 axisAngleToQuaternion(vec3 axis, float angle) { ' +
            'vec4 dest = vec4(0.0); ' +

            'float halfAngle = angle / 2.0; ' +
            'float s = sin(halfAngle); ' +

            'dest.x = axis.x * s; ' +
            'dest.y = axis.y * s; ' +
            'dest.z = axis.z * s; ' +
            'dest.w = cos(halfAngle); ' +
            'return dest; ' +
        '}';

    /*
    random components:
    - rotation axis (vec 3 dir normal)      - color
    - rotation speed (float 0..1)           - random1.x
    - age (float 0..1)                      - random1.y
    - age speed (float 0..1)                - random1.z
    - y offset (float -1..1)                - random1.w
    - left or right (float -1 or 1)         - random2.x
    - front or back (float -1 or 1)         - random2.y
    - x offset (float -1..1)                - random2.z
    - z offset (float -1..1)                - random2.w
    http://stackoverflow.com/a/3956538/1466456
    */
    var mixinCubePosition =
        '/* ROTATION. */ ' +
        'const float rotationSpeed = 3.0; ' +
        'vec4 rotation = axisAngleToQuaternion(color, fAge * random1.x * rotationSpeed); ' +
        'vec3 position = rotateVectorByQuaternion(position, rotation); ' +
        'vec3 normal = rotateVectorByQuaternion(normal, rotation); ' +

        '/* TRANSLATION. */ ' +
        '/* Y-translation. */ ' +
        'const float yOffset = 60.0; ' +
        'const float yDistance = 120.0; ' +
        'const float transitionSecondsY = 60.0; ' +
        'float randomizedAgeY = fAge * (random1.y + 0.5) * 0.5 + (random1.z) * transitionSecondsY; ' +
        'float moduloRandomizedAgeY = mod(randomizedAgeY, transitionSecondsY); ' +
        'float positionY = position.y - yOffset + moduloRandomizedAgeY / transitionSecondsY * yDistance; ' +

        '/* X- & Z-translation. */ ' +
        'const float xzDistance = 20.0; ' +
        'const float xzAgeFactor = 0.2; ' +
        'float leftOrRight = random2.x; ' +
        'float frontOrBack = random2.y; ' +
        'moduloRandomizedAgeY *= xzAgeFactor; ' +
        'float positionX = position.x + cos(moduloRandomizedAgeY) * leftOrRight * xzDistance; ' +
        'float positionZ = position.z + sin(moduloRandomizedAgeY) * frontOrBack * xzDistance; ' +

        'const float offsetAmount = 9.5; ' +

        'position = vec3( ' +
            'positionX + random2.z * offsetAmount, ' +
            'positionY + random1.w * offsetAmount, ' +
            'positionZ + random2.w * offsetAmount); ' +

        '/* COORDINATE SPACE TRANSFORMATION. */ ' +
        'vec4 mvPosition = viewMatrix * vec4(position, 1.0); ' +
        'gl_Position = projectionMatrix * mvPosition;';

    var mixinCubeLighting =
        '/* We use Gouraud shading for per vertex lighting. */ ' +

        '/* Ambient light. */ ' +
        'const vec3 ambientLightColor = vec3(0.0, 0.0, 0.0);' +
        'vDiffuse = ambientLightColor;' +

        '/* Directional light. */ ' +
        'const vec3 dirLightColor = vec3(0.35, 1.0, 1.0) * 0.25; ' +
        'const vec3 dirLightInvDir = vec3(0.0, 1.0, 0.0); ' +        
        'vDiffuse += max(dot(normal, dirLightInvDir), 0.0) * dirLightColor; ' +

        '/* Point light. */ ' +        
        'const float pointLightMaxDistance = 65.0; ' +
        'vec3 pointLightInvVector = v3PointLightPosition - position; ' +
        'float pointLightDistance = length(pointLightInvVector); ' +
        'vec3 pointLightInvDir = pointLightInvVector / pointLightDistance; ' +
        'float pointLightFactor = 1.0 - min(pointLightDistance / pointLightMaxDistance, 1.0); ' +
        'vDiffuse += max(dot(normal, pointLightInvDir), 0.0) * pointLightFactor * cPointLightColor;';

    effects.cubesDiffuse = {
        uniforms: {
            fAge: {
                type: 'f',
                value: 60
            },
            cPointLightColor: {
                type: 'c',
                value: new THREE.Color(0.349, 1, 1)
            },
            v3PointLightPosition: {
                type: 'v3',
                value: new THREE.Vector3(0, 0, 0)
            }
        },
        vertexColors: THREE.VertexColors,

        vertexShader:
            'uniform float fAge; ' +
            'uniform vec3 cPointLightColor; ' +
            'uniform vec3 v3PointLightPosition; ' +

            'attribute vec4 random1; ' +
            'attribute vec4 random2; ' +

            'varying lowp vec3 vDiffuse; ' +

            mixinCommon +
            'void main() { ' +
                mixinCubePosition +
                mixinCubeLighting +
            '}',

        fragmentShader:
            'varying lowp vec3 vDiffuse; ' +
            'void main() { ' +
                'gl_FragColor = vec4(vDiffuse, 1.0); ' +
            '}'
    };

    effects.cubesBlack = {
        uniforms: {
            fAge: {
                type: 'f',
                value: 60
            }
        },
        vertexColors: THREE.VertexColors,

        vertexShader:
            'uniform float fAge; ' +

            'attribute vec4 random1; ' +
            'attribute vec4 random2; ' +

            mixinCommon +
            'void main() { ' +
                mixinCubePosition +
            '}',

        fragmentShader:
            'void main() { ' +
                'gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); ' +
            '}'
    };

    /*
    random components:
    - rotation axis (vec 3 dir normal)      - color
    - rotation speed (float 0..1)           - random1.x
    - age (float 0..1)                      - random1.y
    - age speed (float 0..1)                - random1.z
    - z offset(float -1..1)                 - random1.w
    - left or right (float -1 or 1)         - random2.x
    - not used (float -1 or 1)              - random2.y
    - x offset (float -1..1)                - random2.z
    - not used (float -1..1)                - random2.w
    */
    effects.background = {
        uniforms: {
            fAge: {
                type: 'f',
                value: 60
            }
        },
        vertexColors: THREE.VertexColors,
        vertexShader:
            'uniform float fAge; ' +

            'attribute vec4 random1; ' +
            'attribute vec4 random2; ' +

            'varying lowp vec3 vDiffuse; ' +

            mixinCommon +
            'void main() { ' +
                '/* ROTATION. */ ' +
                'const float rotationSpeed = 3.0; ' +
                'vec4 rotation = axisAngleToQuaternion(color, fAge * random1.x * rotationSpeed); ' +
                'vec3 position = rotateVectorByQuaternion(position, rotation); ' +
                'vec3 normal = rotateVectorByQuaternion(normal, rotation); ' +

                '/* TRANSLATION. */ ' +
                'const float transitionSecondsY = 30.0; ' +
                'const float zOffset = -150.0; ' +
                'const float zDistance = 30.0;' +
                'const float xOffset = 160.0; ' +
                'const float yOffset = 60.0; ' +
                'const float yDistance = 120.0; ' +

                'float randomizedAgeY = fAge * (random1.y + 0.5) * 0.5 + (random1.z) * transitionSecondsY; ' +
                'float moduloRandomizedAgeY = mod(randomizedAgeY, transitionSecondsY); ' +
                'float positionY = position.y - yOffset + moduloRandomizedAgeY / transitionSecondsY * yDistance; ' +

                'position = vec3( ' +
                    'position.x + random2.z * xOffset, ' +
                    'positionY, ' +
                    'zOffset + random1.w * zDistance ' + 
                '); ' +

                '/* LIGHTING. */ ' +
                'vDiffuse = vec3(0.0); ' +
                '/* Directional light. */ ' +                
                'const vec3 dirLightColor = vec3(0.35, 1.0, 1.0) * 0.25; ' +
                'const vec3 dirLightInvDir = vec3(0.0, 1.0, 0.0); ' +                
                'vDiffuse += max(dot(normal, dirLightInvDir), 0.0) * dirLightColor; ' +

                '/* COORDINATE SPACE TRANSFORMATION. */ ' +
                'vec4 mvPosition = viewMatrix * vec4(position, 1.0); ' +
                'gl_Position = projectionMatrix * mvPosition; ' +
            '}',

        fragmentShader:
            'varying lowp vec3 vDiffuse; ' +
            'void main() { ' +
                'gl_FragColor = vec4(vDiffuse, 1.0); ' +
            '}'
    };

    var mixinPosition =
        'gl_Position = vec4(position, 1.0); ';

    // ref: https://github.com/BKcore/Three.js-extensions/blob/master/sources/Shaders.js
    effects.godRays = {
        uniforms: {
            tDiffuse: {
                type: "t"
            },
            fExposure: {
                type: "f",
                value: 0.6
            },
            fDecay: {
                type: "f",
                value: 0.9
            },
            fDensity: {
                type: "f",
                // value: 0.96
                value: 0.8
            },
            fWeight: {
                type: "f",
                // value: 0.4
                value: 0.75
            },
            fClamp: {
                type: "f",
                value: 1.0
            },
            v2LightPosition: {
                type: "v2",
                value: new THREE.Vector2(0.5, 0.5)
            }
        },
        vertexShader:
            'varying vec2 vUv; ' +

            'void main() { ' +
                'vUv = uv; ' +
                mixinPosition +
            '}',

        fragmentShader:
            'varying vec2 vUv; ' +

            'uniform sampler2D tDiffuse; ' +

            'uniform float fExposure; ' +
            'uniform float fDecay; ' +
            'uniform float fDensity; ' +
            'uniform float fWeight; ' +
            'uniform float fClamp; ' +
            'uniform vec2 v2LightPosition; ' +

            'void main() { ' +
                'const int numSamples = 20; ' +

                'vec2 delta = vUv - v2LightPosition; ' +
                'delta *= 1.0 / float(numSamples) * fDensity; ' +
                'float illuminationDecay = 1.0; ' +
                'vec4 fragColor = vec4(0.0); ' +

                'vec2 coord = vUv; ' +

                'for (int i = 0; i < numSamples; i++) { ' +
                    'coord -= delta; ' +
                    'vec4 texel = texture2D(tDiffuse, coord); ' +
                    'texel *= illuminationDecay * fWeight; ' +

                    'fragColor += texel; ' +

                    'illuminationDecay *= fDecay; ' +
                '} ' +
                'fragColor *= fExposure; ' +
                'fragColor = clamp(fragColor, 0.0, fClamp); ' +
                'gl_FragColor = fragColor; ' +
            '}'
    };

    // ref: https://github.com/BKcore/Three.js-extensions/blob/master/sources/Shaders.js
    effects.additive = {
        uniforms: {
            tDiffuse: {
                type: 't'
            },
            tAdd: {
                type: 't'
            },
            fCoefficient: {
                type: 'f',
                value: 1.0
            }
        },
        vertexShader:
            'varying vec2 vUv; ' +

            'void main() { ' +
                'vUv = uv; ' +
                mixinPosition +
            '}',

        fragmentShader:
            'varying vec2 vUv; ' +

            'uniform sampler2D tDiffuse; ' +
            'uniform sampler2D tAdd; ' +
            'uniform float fCoefficient; ' +

            'void main() { ' +
                'vec4 texel = texture2D(tDiffuse, vUv); ' +
                'vec4 add = texture2D(tAdd, vUv); ' +
                'gl_FragColor = texel + add * fCoefficient; ' +
            '}'
    };

    // ref: https://github.com/BKcore/Three.js-experiments-pool/blob/master/r48/js/ShaderExtras.js
    effects.horizontalBlur = {
        uniforms: {
            tDiffuse: {
                type: 't'
            },
            fH: {
                type: 'f',
                value: 1.0 / 512.0
            }
        },
        vertexShader:
            'varying vec2 vUv; ' +

            'void main() { ' +
                'vUv = uv; ' +
                mixinPosition +
            '}',

        fragmentShader:
            'varying vec2 vUv; ' +

            'uniform sampler2D tDiffuse; ' +
            'uniform float fH; ' +

            'void main() { ' +
                'vec4 sum = vec4(0.0); ' +
                'sum += texture2D( tDiffuse, vec2(vUv.x - 4.0 * fH, vUv.y)) * 0.051; ' +
        				'sum += texture2D( tDiffuse, vec2(vUv.x - 3.0 * fH, vUv.y)) * 0.0918; ' +
        				'sum += texture2D( tDiffuse, vec2(vUv.x - 2.0 * fH, vUv.y)) * 0.12245; ' +
        				'sum += texture2D( tDiffuse, vec2(vUv.x - 1.0 * fH, vUv.y)) * 0.1531; ' +
        				'sum += texture2D( tDiffuse, vec2(vUv.x, 		  	vUv.y)) * 0.1633; ' +
        				'sum += texture2D( tDiffuse, vec2(vUv.x + 1.0 * fH, vUv.y)) * 0.1531; ' +
        				'sum += texture2D( tDiffuse, vec2(vUv.x + 2.0 * fH, vUv.y)) * 0.12245; ' +
        				'sum += texture2D( tDiffuse, vec2(vUv.x + 3.0 * fH, vUv.y)) * 0.0918; ' +
        				'sum += texture2D( tDiffuse, vec2(vUv.x + 4.0 * fH, vUv.y)) * 0.051; ' +
        				'gl_FragColor = sum; ' +
            '}'
    };

    // ref: https://github.com/BKcore/Three.js-experiments-pool/blob/master/r48/js/ShaderExtras.js
    effects.verticalBlur = {
        uniforms: {
            tDiffuse: {
                type: 't'
            },
            fV: {
                type: 'f',
                value: 1.0 / 512.0
            }
        },

        vertexShader:
            'varying vec2 vUv; ' +

            'void main() { ' +
                'vUv = uv; ' +
                mixinPosition +
            '}',

        fragmentShader:
            'varying vec2 vUv; ' +

            'uniform sampler2D tDiffuse; ' +
            'uniform float fV; ' +

            'void main() { ' +
                'vec4 sum = vec4(0.0); ' +

                'sum += texture2D(tDiffuse, vec2(vUv.x, vUv.y - 4.0 * fV)) * 0.051; ' +
                'sum += texture2D(tDiffuse, vec2(vUv.x, vUv.y - 3.0 * fV)) * 0.0918; ' +
                'sum += texture2D(tDiffuse, vec2(vUv.x, vUv.y - 2.0 * fV)) * 0.12245; ' +
                'sum += texture2D(tDiffuse, vec2(vUv.x, vUv.y - 1.0 * fV)) * 0.1531; ' +
                'sum += texture2D(tDiffuse, vec2(vUv.x, vUv.y			)) * 0.1633; ' +
                'sum += texture2D(tDiffuse, vec2(vUv.x, vUv.y + 1.0 * fV)) * 0.1531; ' +
                'sum += texture2D(tDiffuse, vec2(vUv.x, vUv.y + 2.0 * fV)) * 0.12245; ' +
                'sum += texture2D(tDiffuse, vec2(vUv.x, vUv.y + 3.0 * fV)) * 0.0918; ' +
                'sum += texture2D(tDiffuse, vec2(vUv.x, vUv.y + 4.0 * fV)) * 0.051; ' +

                'gl_FragColor = sum; ' +
            '}'
    };
})(THREE.Effects);
