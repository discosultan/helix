'use strict';

function addMenuMovement(container, simulation) {
    var CAMERA_ROTATION_AMOUNT = Math.PI * 0.25;
    var CAMERA_ROTATION_SECONDS = 0.4;
    var MINIMUM_NUMBER_OF_ELEMENTS = 5;

    var isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
    var transitionInProgress = false;

    var elements = container.getElementsByClassName('menu-element');
    var elementCount = elements.length;
    // Ensure we have at least 5 elements in the menu. If we have less,
    // then simply duplicate all existing elements until we do.
    while (elementCount < MINIMUM_NUMBER_OF_ELEMENTS) {
        for (var i = 0; i < elementCount; i++) {
            var element = elements[i];
            var newElement = element.cloneNode(true);
            container.appendChild(newElement);
        }
        elementCount = elements.length;
    }

    for (var i = 0; i < elementCount; i++) {
        var element = elements[i];
        // Assign an index. This index will be used to determine the element's
        // current position on the menu (for example, 0 - left, 1 - center, etc).
        element.dataset.index = i;
        // Rotate menu elements when clicking on left/right menu element.
        element.addEventListener('click', function() {
            if (transitionDisabled()) return;
            var index = parseInt(this.dataset.index);
            if (index === 0) { // left
                rotateElementsRight(elements);
            } else if (index === 2) { // right
                rotateElementsLeft(elements);
            }
        });
    }

    // Rotate menu elements with left/right keyboard arrows.
    window.addEventListener('keydown', function(evt) {
        if (transitionDisabled()) return;
        if (evt.keyCode === 37) { // Left arrow.
            rotateElementsRight(elements);
        } else if (evt.keyCode === 39) { // Right arrow.
            rotateElementsLeft(elements);
        }
    }, false);

    // Rotate menu elements with swipe touch gestures.
    var hammer = new Hammer.Manager(document.body);
    hammer.add(new Hammer.Swipe());
    hammer.on('swipeleft', function() {
        if (transitionDisabled()) return;
        rotateElementsLeft(elements);
    });
    hammer.on('swiperight', function() {
        if (transitionDisabled()) return;
        rotateElementsRight(elements);
    });

    assignElementsClasses(elements);

    var previousTimestamp = 0;
    var processes = [];
    requestAnimationFrame(update);

    function transitionDisabled() {
        // On Firefox browser, allow transitioning only one menu element at a time.
        // Otherwise, there was weird flickering with css animations.
        return isFirefox && self.transitionInProgress;
    }

    function update(timestamp) {
        var deltaSeconds = (timestamp - previousTimestamp) * 0.001;
        previousTimestamp = timestamp;

        for (var i = processes.length - 1; i >= 0; i--) {
            var process = processes[i];
            process.update(deltaSeconds);
            if (process.finished) {
                processes.splice(i, 1);
            }
        }

        self.transitionInProgress = processes.length > 0;

        requestAnimationFrame(update);
    }

    function rotateElementsLeft(elements) {
        var count = elements.length;
        for (var i = 0; i < count; i++) {
            var element = elements[i];
            var index = parseInt(element.dataset.index);
            index -= 1;
            if (index < 0) {
                index = count - 1;
            }
            element.dataset.index = index;
        }
        assignElementsClasses(elements);
        processes.push(new CameraRotationProcess(CAMERA_ROTATION_AMOUNT, CAMERA_ROTATION_SECONDS));
    }

    function rotateElementsRight(elements) {
        var count = elements.length;
        for (var i = 0; i < count; i++) {
            var element = elements[i];
            var index = parseInt(element.dataset.index);
            index = (index + 1) % count;
            element.dataset.index = index;
        }
        assignElementsClasses(elements);
        processes.push(new CameraRotationProcess(-CAMERA_ROTATION_AMOUNT, CAMERA_ROTATION_SECONDS));
    }

    function assignElementsClasses(elements) {
        var lastIndex = elements.length - 1;
        for (var i = 0; i < elements.length; i++) {
            var element = elements[i];
            element.classList.remove('left-out');
            element.classList.remove('left');
            element.classList.remove('center');
            element.classList.remove('right');
            element.classList.remove('right-out');
            var index = parseInt(element.dataset.index);
            switch (index) {
                case 0:
                    element.classList.add('left');
                    break;
                case 1:
                    element.classList.add('center');
                    break;
                case 2:
                    element.classList.add('right');
                    break;
                case 3:
                    element.classList.add('right-out');
                    break;
                default:
                    if (index === lastIndex) {
                        element.classList.add('left-out');
                    }
                    break;
            }
        }
    }

    function CameraRotationProcess(amount, seconds) {
        var self = this;
        this.finished = false;
        this.elapsedSeconds = 0;
        this.rotAmountProgess = 0;

        var bezier = new UnitBezier(0.250, 0.100, 0.250, 1.000);

        this.update = function(deltaSeconds) {
            self.elapsedSeconds += deltaSeconds;
            if (self.elapsedSeconds >= seconds) {
                self.finished = true;
            }

            var age = self.elapsedSeconds / seconds;
            var progress = bezier.sampleCurveY(age);
            var newRotAmountProgess = lerp(0, amount, progress);

            simulation.cameraRotation += newRotAmountProgess - self.rotAmountProgess;
            self.rotAmountProgess = newRotAmountProgess;
        }

        function lerp(v0, v1, t) {
            return v0 + t * (v1 - v0);
        }

        /**
         * Solver for cubic bezier curve with implicit control points at (0,0) and (1.0, 1.0)
         * Ref: http://stackoverflow.com/a/11697909/1466456
         */
        function UnitBezier(p1x, p1y, p2x, p2y) {
            // pre-calculate the polynomial coefficients
            // First and last control points are implied to be (0,0) and (1.0, 1.0)
            this.cx = 3.0 * p1x;
            this.bx = 3.0 * (p2x - p1x) - this.cx;
            this.ax = 1.0 - this.cx - this.bx;

            this.cy = 3.0 * p1y;
            this.by = 3.0 * (p2y - p1y) - this.cy;
            this.ay = 1.0 - this.cy - this.by;
        }

        UnitBezier.prototype.sampleCurveY = function(t) {
            return ((this.ay * t + this.by) * t + this.cy) * t;
        }
    }
}
