'use strict';

function addControls(simulation) {
    var gui = new dat.GUI();
    gui.close();

    var folder = gui.addFolder('CubesSimulation');
    folder.open();

    addObjectToDatGUI(folder, 'ClearColor', simulation.clearColor, function(color) {
        simulation.renderer.setClearColor(color);
    });
    addObjectToDatGUI(folder, "LightColor", simulation.godRays.lightMaterial.color)

    folder.add(simulation.godRays, 'enabled').name('GodRaysEnabled');
    folder.add(simulation.background, 'enabled').name('BackgroundEnabled');

    addMaterialToDatGUI("Cubes", simulation.cubesDiffuseMaterial);
    addMaterialToDatGUI("God Rays", simulation.godRays.godRaysMaterial);

    function addMaterialToDatGUI(name, material) {
        var folder = gui.addFolder(name);
        for (var property in material.uniforms) {
            // Check if is own property and filter age uniforms.
            if (material.uniforms.hasOwnProperty(property) && property !== 'fAge') {
                var uniform = material.uniforms[property];
                var value = uniform.value;
                // Do not add textures.
                if (uniform.type === 't') continue;

                if (typeof value === 'object') {
                    addObjectToDatGUI(folder, getName(uniform, property), value);
                } else {
                    folder.add(uniform, 'value').name(getName(uniform, property)).step(0.01);
                }
            }
        }
        folder.open();

        function getName(uniform, property) {
            return property.substring(uniform.type.length);
        }
    }

    function addObjectToDatGUI(folder, name, value, onChange) {
        var subfolder = folder.addFolder(name);
        for (var property in value) {
            if (value.hasOwnProperty(property)) {
                var ctrl = subfolder.add(value, property).step(0.01);
                if (onChange) {
                    ctrl.onChange(function(propertyValue) {
                        onChange(value);
                    });
                }
            }
        }
    }
}
