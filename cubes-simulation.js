'use strict';

function CubesSimulation(container) {
    // Setup helper variables.
    var ZERO_VECTOR = new THREE.Vector3(0, 0, 0);
    var TWO_PI = Math.PI * 2;
    var PI_OVER_TWO = Math.PI * 0.5;
    var self = this;

    // Setup renderer.
    this.renderer = new THREE.WebGLRenderer({
        antialias: false,
        stencil: false,
        preserveDrawingBuffer: false
    });

    this.clearColor = new THREE.Color(0x001B1B);

    this.renderer.setClearColor(this.clearColor);
    this.renderer.setSize(container.offsetWidth, container.offsetHeight);
    this.renderer.autoClear = false;
    this.renderer.sortObjects = false;
    container.appendChild(this.renderer.domElement);

    // Setup camera.
    var camera = new THREE.PerspectiveCamera(
        45,
        container.offsetWidth / container.offsetHeight,
        0.1, 1000);

    var cameraAxisOfRotation = new THREE.Vector3(0.0, 1.0, 0.25);
    cameraAxisOfRotation.normalize();
    this.cameraRotation = Math.random() * TWO_PI;
    this.rotationSpeed = Math.PI * 0.05;    

    camera.up.set(cameraAxisOfRotation.x, cameraAxisOfRotation.y, cameraAxisOfRotation.z);
    camera.position.set(100, 0, 0);
    camera.lookAt(ZERO_VECTOR);

    // Setup scene.
    var scene = new THREE.Scene();
    // Create geometry.
    var cubesGeometry = createCubesGeometry();
    // Setup materials.
    this.cubesDiffuseMaterial = new THREE.ShaderMaterial(THREE.Effects.cubesDiffuse);
    // Create mesh and add to scene.
    var cubesMesh = new THREE.Mesh(cubesGeometry, this.cubesDiffuseMaterial);
    scene.add(cubesMesh);

    // Create volumetric light scattering (god rays) post process
    this.godRays = createGodRaysPostProcess();

    // Create background.
    this.background = createBackground();

    this.resize = function() {
        self.renderer.setSize(container.offsetWidth, container.offsetHeight);
        camera.aspect = container.offsetWidth / container.offsetHeight;
        camera.updateProjectionMatrix();
        self.godRays.resize();
        self.background.resize();
    };

    var previousTimestamp = 0;
    var totalSeconds = Math.random() * 60;
    requestAnimationFrame(render);

    function render(timestamp) {
        var deltaSeconds = (timestamp - previousTimestamp) * 0.001;
        previousTimestamp = timestamp;

        totalSeconds += deltaSeconds;
        self.cubesDiffuseMaterial.uniforms.fAge.value += deltaSeconds;

        // Rotate camera.
        self.cameraRotation = (self.cameraRotation + self.rotationSpeed * deltaSeconds) % TWO_PI;

        camera.position.set(100, 0, 0).applyAxisAngle(cameraAxisOfRotation, self.cameraRotation);
        camera.lookAt(ZERO_VECTOR);

        if (self.godRays.enabled) {
            self.godRays.render(totalSeconds);
        } else {
            // Required when renderer preserveDrawingBuffer: true
            // self.renderer.clear(true, true, false);
            self.renderer.render(scene, camera);
            if (self.background.enabled) {
                self.background.render();
            }
        }
        requestAnimationFrame(render);
    }

    function createBackground() {
        var background = {
            enabled: true
        };
        
        var backgroundScene = new THREE.Scene();
        var backgroundMaterial = new THREE.ShaderMaterial(THREE.Effects.background);
        var backgroundMesh = new THREE.Mesh(cubesGeometry, backgroundMaterial);
        backgroundScene.add(backgroundMesh);
        
        // Setup camera.
        var backgroundCamera = new THREE.PerspectiveCamera(
            45,
            container.offsetWidth / container.offsetHeight,
            0.1, 1000);
        (background.resize = function() {
            backgroundCamera.aspect = container.offsetWidth / container.offsetHeight;
            backgroundCamera.updateProjectionMatrix();
        })();
        background.render = function(renderTarget) {
            backgroundMaterial.uniforms.fAge.value = self.cubesDiffuseMaterial.uniforms.fAge.value;
            // Render only a subset of the entire cubes buffer.
            cubesGeometry.setDrawRange(0, 36 * 60);

            self.renderer.render(backgroundScene, backgroundCamera, renderTarget);

            // Reset draw range.
            cubesGeometry.setDrawRange(0, cubesGeometry.attributes.position.count);
        }
        return background;
    }

    function createGodRaysPostProcess() {
        var godRays = {
            enabled: true
        };

        godRays.cubesBlackMaterial = new THREE.ShaderMaterial(THREE.Effects.cubesBlack);
        godRays.godRaysMaterial = new THREE.ShaderMaterial(THREE.Effects.godRays);
        var additiveMaterial = new THREE.ShaderMaterial(THREE.Effects.additive);
        var horizontalBlurMaterial = new THREE.ShaderMaterial(THREE.Effects.horizontalBlur);
        var verticalBlurMaterial = new THREE.ShaderMaterial(THREE.Effects.verticalBlur);
        
        var lightColor = new THREE.Color(0.8, 0.6, 0.5);
        var occlusionClearColor = new THREE.Color(0x000000);
        var occlusionScene = new THREE.Scene();

        var lightGeometry = new createCircleGeometry(10, 4);
        godRays.lightMaterial = new THREE.MeshBasicMaterial({
            color: lightColor
        });
        var lightMesh = new THREE.Mesh(lightGeometry, godRays.lightMaterial);
        lightMesh.position.set(0, 0, 0);
        lightMesh.rotation.set(PI_OVER_TWO, 0, 0);
        lightMesh.scale.set(1, 1, 1);

        godRays.lightMesh = lightMesh;
        var cubesMeshBlack = new THREE.Mesh(cubesGeometry, godRays.cubesBlackMaterial);
        occlusionScene.add(godRays.lightMesh);
        occlusionScene.add(cubesMeshBlack);

        var quadScene = new THREE.Scene();
        var quadMesh = new THREE.Mesh(new THREE.PlaneBufferGeometry(2, 2), godRays.godRaysMaterial);
        quadScene.add(quadMesh);

        var diffuseRT, godRaysRT1, godRaysRT2;
        (godRays.resize = function() {
            var blurriness = 3;
            horizontalBlurMaterial.uniforms.fH.value = blurriness / container.offsetWidth;
            verticalBlurMaterial.uniforms.fV.value = blurriness / container.offsetHeight;
            setupRenderTargets();
        })();                        

        var lightProjectedPosition = new THREE.Vector3();
        godRays.render = function(totalSeconds) {
            godRays.cubesBlackMaterial.uniforms.fAge.value = self.cubesDiffuseMaterial.uniforms.fAge.value;
            godRays.lightMesh.position.y = Math.sin(totalSeconds * 0.3) * 50;
            self.cubesDiffuseMaterial.uniforms.v3PointLightPosition.value.y = godRays.lightMesh.position.y;
            self.cubesDiffuseMaterial.uniforms.cPointLightColor.value.copy(lightColor);

            lightProjectedPosition.copy(godRays.lightMesh.position);
            lightProjectedPosition.project(camera);
            godRays.godRaysMaterial.uniforms.v2LightPosition.value.x = (lightProjectedPosition.x + 1) * 0.5;
            godRays.godRaysMaterial.uniforms.v2LightPosition.value.y = (lightProjectedPosition.y + 1) * 0.5;

            // Render normal scene.
            self.renderer.clearTarget(diffuseRT, true, true, false);
            if (self.background.enabled) {
                self.background.render(diffuseRT);
            }
            self.renderer.render(scene, camera, diffuseRT);

            // Render occlusion scene.
            self.renderer.setClearColor(occlusionClearColor);
            self.renderer.render(occlusionScene, camera, godRaysRT1, true);
            self.renderer.setClearColor(self.clearColor); // Restore clear color.

            // Blur.
            horizontalBlurMaterial.uniforms.tDiffuse.value = godRaysRT1.texture;
            quadScene.overrideMaterial = horizontalBlurMaterial;
            self.renderer.render(quadScene, camera, godRaysRT2);

            verticalBlurMaterial.uniforms.tDiffuse.value = godRaysRT2.texture;
            quadScene.overrideMaterial = verticalBlurMaterial;
            self.renderer.render(quadScene, camera, godRaysRT1);

            horizontalBlurMaterial.uniforms.tDiffuse.value = godRaysRT1.texture;
            quadScene.overrideMaterial = horizontalBlurMaterial;
            self.renderer.render(quadScene, camera, godRaysRT2);

            verticalBlurMaterial.uniforms.tDiffuse.value = godRaysRT2.texture;
            quadScene.overrideMaterial = verticalBlurMaterial;
            self.renderer.render(quadScene, camera, godRaysRT1);

            // Gen god rays.
            godRays.godRaysMaterial.uniforms.tDiffuse.value = godRaysRT1.texture;
            quadScene.overrideMaterial = godRays.godRaysMaterial;
            self.renderer.render(quadScene, camera, godRaysRT2);

            // Final pass - combine.
            additiveMaterial.uniforms.tDiffuse.value = diffuseRT.texture;
            additiveMaterial.uniforms.tAdd.value = godRaysRT2.texture;
            quadScene.overrideMaterial = additiveMaterial;
            self.renderer.render(quadScene, camera);
        };

        return godRays;

        function setupRenderTargets() {
            var rtParams = {
                minFilter: THREE.LinearFilter,
                magFilter: THREE.LinearFilter,
                format: THREE.RGBFormat
            };
            var w = container.offsetWidth,
                h = container.offsetHeight;
            var reductionFactor = 1;
            diffuseRT = new THREE.WebGLRenderTarget(w, h, rtParams);
            godRaysRT1 = new THREE.WebGLRenderTarget(w >> reductionFactor, h >> reductionFactor, rtParams);
            godRaysRT2 = new THREE.WebGLRenderTarget(w >> reductionFactor, h >> reductionFactor, rtParams);
        }
    }

    function createCircleGeometry(radius, thickness) {
        var shape = new THREE.Shape();
        shape.moveTo(0, radius);
        shape.quadraticCurveTo(radius, radius, radius, 0);
        shape.quadraticCurveTo(radius, -radius, 0, -radius);
        shape.quadraticCurveTo(-radius, -radius, -radius, 0);
        shape.quadraticCurveTo(-radius, radius, 0, radius);
        var extrudeSettings = {
            amount: thickness,
            bevelEnabled: true,
            bevelSegments: 2,
            steps: 2,
            bevelSize: 1,
            bevelThickness: 1
        };
        return new THREE.ExtrudeGeometry(shape, extrudeSettings);
    }

    function createCubesGeometry() {
        // Create an unindexed buffer.
        var numCubes = 10000;
        var numTrianglesPerCube = 12;
        var numTriangles = numTrianglesPerCube * numCubes;

        var halfSize = 0.45; // half cube side length.

        var v1 = new THREE.Vector3(-halfSize, -halfSize, -halfSize);
        var v2 = new THREE.Vector3(+halfSize, -halfSize, -halfSize);
        var v3 = new THREE.Vector3(+halfSize, +halfSize, -halfSize);
        var v4 = new THREE.Vector3(-halfSize, +halfSize, -halfSize);

        var v5 = new THREE.Vector3(-halfSize, -halfSize, +halfSize);
        var v6 = new THREE.Vector3(+halfSize, -halfSize, +halfSize);
        var v7 = new THREE.Vector3(+halfSize, +halfSize, +halfSize);
        var v8 = new THREE.Vector3(-halfSize, +halfSize, +halfSize);

        var positions = new Float32Array(numTriangles * 3 * 3); // 3 components per vertex and 3 vertices per triangle.
        var normals = new Float32Array(numTriangles * 3 * 3);
        var colors = new Float32Array(numTriangles * 3 * 3);
        var randoms1 = new Float32Array(numTriangles * 4 * 3); // 4 components per vertex and 3 vertices per triangle.
        var randoms2 = new Float32Array(numTriangles * 4 * 3);

        var na = new THREE.Vector3();
        var nb = new THREE.Vector3();

        var rv1 = new THREE.Vector3();
        var rv2 = new THREE.Vector4();
        var rv3 = new THREE.Vector4();

        for (var i = 0; i < numTriangles; i += numTrianglesPerCube) {            
            setRandomUnitVector(rv1);
            rv2.set(Math.random(), Math.random(), Math.random(), normallyDistributedRandom(-1, 1));
            rv3.set(
                Math.random() > 0.5 ? 1 : -1,
                Math.random() > 0.5 ? 1 : -1,
                normallyDistributedRandom(-1, 1),
                normallyDistributedRandom(-1, 1)
            );

            addTriangle(i + 0, v1, v2, v4, rv1, rv2, rv3);
            addTriangle(i + 1, v2, v3, v4, rv1, rv2, rv3);

            addTriangle(i + 2, v8, v6, v5, rv1, rv2, rv3);
            addTriangle(i + 3, v8, v7, v6, rv1, rv2, rv3);

            addTriangle(i + 4, v5, v2, v1, rv1, rv2, rv3);
            addTriangle(i + 5, v5, v6, v2, rv1, rv2, rv3);

            addTriangle(i + 6, v6, v3, v2, rv1, rv2, rv3);
            addTriangle(i + 7, v6, v7, v3, rv1, rv2, rv3);

            addTriangle(i + 8, v7, v4, v3, rv1, rv2, rv3);
            addTriangle(i + 9, v7, v8, v4, rv1, rv2, rv3);

            addTriangle(i + 10, v1, v4, v5, rv1, rv2, rv3);
            addTriangle(i + 11, v4, v8, v5, rv1, rv2, rv3);
        }

        function setRandomUnitVector(vector) {
            // Create random unit vector (uniform distribution).
            // Ref: http://www.gamedev.net/topic/499972-generate-a-random-unit-vector/
            var azimuth = Math.random() * 2 * Math.PI;
            var cosAzimuth = Math.cos(azimuth);
            var sinAzimuth = Math.sin(azimuth);
            var planarZ = Math.random() * 2 - 1; // in range [-1...1]
            var sqrtInvPlanarZSq = Math.sqrt(1 - planarZ * planarZ);
            var planarX = cosAzimuth * sqrtInvPlanarZSq;
            var planarY = sinAzimuth * sqrtInvPlanarZSq;
            vector.set(planarX, planarY, planarZ);
        }

        function normallyDistributedRandom(from, to) {
            var delta = to - from;
            var random = 0;
            for (var i = 0; i < 4; i++) {
                random += Math.random() * delta - delta * 0.5;
            }
            return random * 0.25;
        }

        function addTriangle(k, vc, vb, va, rv1, rv2, rv3) {
            // Setup positions.

            var j = k * 9;
            var l = k * 12;

            positions[j + 0] = va.x;
            positions[j + 1] = va.y;
            positions[j + 2] = va.z;

            positions[j + 3] = vb.x;
            positions[j + 4] = vb.y;
            positions[j + 5] = vb.z;

            positions[j + 6] = vc.x;
            positions[j + 7] = vc.y;
            positions[j + 8] = vc.z;

            // Setup flat face normals.

            na.subVectors(vc, vb);
            nb.subVectors(va, vb);
            na.cross(nb);
            na.normalize();
            
            normals[j + 0] = na.x;
            normals[j + 1] = na.y;
            normals[j + 2] = na.z;

            normals[j + 3] = na.x;
            normals[j + 4] = na.y;
            normals[j + 5] = na.z;

            normals[j + 6] = na.x;
            normals[j + 7] = na.y;
            normals[j + 8] = na.z;

            colors[j + 0] = rv1.x;
            colors[j + 1] = rv1.y;
            colors[j + 2] = rv1.z;

            colors[j + 3] = rv1.x;
            colors[j + 4] = rv1.y;
            colors[j + 5] = rv1.z;

            colors[j + 6] = rv1.x;
            colors[j + 7] = rv1.y;
            colors[j + 8] = rv1.z;

            randoms1[l + 0] = rv2.x;
            randoms1[l + 1] = rv2.y;
            randoms1[l + 2] = rv2.z;
            randoms1[l + 3] = rv2.w;

            randoms1[l + 4] = rv2.x;
            randoms1[l + 5] = rv2.y;
            randoms1[l + 6] = rv2.z;
            randoms1[l + 7] = rv2.w;

            randoms1[l + 8] = rv2.x;
            randoms1[l + 9] = rv2.y;
            randoms1[l + 10] = rv2.z;
            randoms1[l + 11] = rv2.w;

            randoms2[l + 0] = rv3.x;
            randoms2[l + 1] = rv3.y;
            randoms2[l + 2] = rv3.z;
            randoms2[l + 3] = rv3.w;

            randoms2[l + 4] = rv3.x;
            randoms2[l + 5] = rv3.y;
            randoms2[l + 6] = rv3.z;
            randoms2[l + 7] = rv3.w;

            randoms2[l + 8] = rv3.x;
            randoms2[l + 9] = rv3.y;
            randoms2[l + 10] = rv3.z;
            randoms2[l + 11] = rv3.w;
        }

        var result = new THREE.BufferGeometry();
        result.addAttribute('position', new THREE.BufferAttribute(positions, 3));
        result.addAttribute('normal', new THREE.BufferAttribute(normals, 3));
        result.addAttribute('color', new THREE.BufferAttribute(colors, 3));
        result.addAttribute('random1', new THREE.BufferAttribute(randoms1, 4));
        result.addAttribute('random2', new THREE.BufferAttribute(randoms2, 4));
        // result.computeBoundingSphere(); // used for frustum culling by three.js.
        return result;
    }
}
