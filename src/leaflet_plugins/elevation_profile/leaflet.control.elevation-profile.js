//@require leaflet
//@require leaflet.control.elevation-profile.css
//@require fileutils

(function() {
    'use strict';

    function createSvg(tagName, attributes, parent) {
        var element = document.createElementNS('http://www.w3.org/2000/svg', tagName);
        if (attributes) {
            var keys = Object.keys(attributes),
                key, value;
            for (var i = 0; i < keys.length; i++) {
                key = keys[i];
                value = attributes[key];
                element.setAttribute(key, value);
            }
        }
        if (parent) {
            parent.appendChild(element);
        }
        return element;
    }

    function pointOnSegmentAtDistance(p1, p2, dist) {
        //FIXME: we should place markers along projected line to avoid transformation distortions
        var q = dist / p1.distanceTo(p2),
            x = p1.lng + (p2.lng - p1.lng) * q,
            y = p1.lat + (p2.lat - p1.lat) * q;
        return L.latLng(y, x);
    }


    function gradientToAngle(g) {
        return Math.round(Math.atan(g) * 180 / Math.PI);
    }

    function pathRegularSamples(latlngs, step) {
        var samples = [],
            lastSampleDist = 0,
            lastPointDistance = 0,
            nextPointDistance = 0,
            segmentLength, i;

        samples.push(latlngs[0]);
        for (i = 1; i < latlngs.length; i++) {
            segmentLength = latlngs[i].distanceTo(latlngs[i - 1]);
            nextPointDistance = lastPointDistance + segmentLength;
            if (nextPointDistance >= lastSampleDist + step) {
                while (lastSampleDist + step <= nextPointDistance) {
                    lastSampleDist += step;
                    samples.push(
                        pointOnSegmentAtDistance(latlngs[i - 1], latlngs[i], lastSampleDist - lastPointDistance)
                    );
                }
            }
            lastPointDistance = nextPointDistance;
        }
        if (samples.length < 2) {
            samples.push(latlngs[latlngs.length - 1]);
        }
        return samples;
    }

    function offestFromEvent(e) {
        if (e.offsetX === undefined) {
            console.log('1');
            var rect = e.target.getBoundingClientRect();
            return {
                offsetX: e.clientX - rect.left,
                offestY: e.clientY - rect.top
            }
        } else {
            return {
                offsetX: e.offsetX,
                offestY: e.offsetY
            }
        }
    }

    var DragEvents = L.Class.extend({
        options: {
            dragTolerance: 2,
            dragButtons: {0: true}
        },

        includes: L.Mixin.Events,

        initialize: function (eventsSource, eventsTarget, options) {
            options = L.setOptions(this, options);
            if (eventsTarget) {
                this.eventsTarget = eventsTarget;
            } else {
                this.eventsTarget = this;
            }
            this.dragStartPos = [];
            this.isDragging = [];

            L.DomEvent.on(eventsSource, 'mousemove', this.onMouseMove, this);
            L.DomEvent.on(eventsSource, 'mouseup', this.onMouseUp, this);
            L.DomEvent.on(eventsSource, 'mousedown', this.onMouseDown, this);
            L.DomEvent.on(eventsSource, 'mouseleave', this.onMouseLeave, this);
        },

        onMouseDown: function(e) {
            if (this.options.dragButtons[e.button]) {
                e._offset = offestFromEvent(e);
                this.dragStartPos[e.button] = e;
            }
        },

        onMouseUp: function(e) {
            if (this.options.dragButtons[e.button]) {
                this.dragStartPos[e.button] = null;
                if (this.isDragging[e.button]) {
                    this.isDragging[e.button] = false;
                    this.fire('dragend', L.extend({dragButton: e.button, origEvent: e}, offestFromEvent(e)));
                } else {
                    this.fire('click', L.extend({dragButton: e.button, origEvent: e}, offestFromEvent(e)));
                }
            }
        },

        onMouseMove: function(e) {
            var i, button, self=this;

            function exceedsTolerance(button) {
                var tolerance = self.options.dragTolerance;
                return Math.abs(e.clientX - self.dragStartPos[button].clientX) > tolerance ||
                       Math.abs(e.clientY - self.dragStartPos[button].clientY) > tolerance;
            }

            var dragButtons = Object.keys(this.options.dragButtons);
            for (i = 0; i < dragButtons.length; i++) {
                button = dragButtons[i];
                if (this.isDragging[button]) {
                    this.eventsTarget.fire('drag', L.extend({dragButton: e.button, origEvent: e}, offestFromEvent(e)));
                } else if (this.dragStartPos[button] && exceedsTolerance(button)) {
                    this.isDragging[button] = true;
                    this.eventsTarget.fire('dragstart', L.extend(
                        {dragButton: button, origEvent: this.dragStartPos[button]},
                        this.dragStartPos[button]._offset));
                    this.eventsTarget.fire('drag', L.extend({dragButton: e.button, origEvent: e}, offestFromEvent(e)));
                }
            }
        },

        onMouseLeave: function(e) {
            var i, button;
            var dragButtons = Object.keys(this.options.dragButtons);
            for (i = 0; i < dragButtons.length; i++) {
                button = dragButtons[i];
                if (this.isDragging[button]) {
                    this.isDragging[button] = false;
                    this.fire('dragend', {dragButton: button, origEvent: e});
                }
            }
            this.dragStartPos = {};
        }
    });

    L.Control.ElevationProfile = L.Class.extend({
            options: {
                elevationsServer: 'http://elevation.nakarte.tk/',
                samplingInterval: 100
            },

            initialize: function(latlngs, options) {
                L.setOptions(this, options);
                // this.polyline = polyline;
                this.path = latlngs;
                var samples = this.samples = pathRegularSamples(this.path, this.options.samplingInterval);
                var self = this;
                this._getElevation(samples).done(function(values) {
                    self.values = values;
                    self.updateGraph();
                });
                this.values = null;
            },

            addTo: function(map) {
                this._map = map;
                var container = this._container = L.DomUtil.create('div', 'elevation-profile-container');
                if (!L.Browser.touch) {
                    L.DomEvent
                        .disableClickPropagation(container)
                        .disableScrollPropagation(container);
                } else {
                    L.DomEvent.on(container, 'click', L.DomEvent.stopPropagation);
                }
                this._map._controlContainer.appendChild(container);
                this.setupContainerLayout();
                this.updateGraph();
                this.trackMarker = L.marker([1000, 0], {clickable: false});
                this.polyline = L.polyline(this.path, {weight: 20, opacity: 0}).addTo(map);
                this.polyline.on('mousemove', this.onLineMouseMove, this);
                this.polyline.on('mouseover', this.onLineMouseEnter, this);
                this.polyline.on('mouseout', this.onLineMouseLeave, this);
                this.polyLineSelection = L.polyline([], {weight: 20, opacity: .5, color: 'yellow'});
                return this;
            },

            setupContainerLayout: function() {
                var horizZoom = this.horizZoom = 1;
                var container = this._container;
                this.propsContainer = L.DomUtil.create('div', 'elevation-profile-properties', container);
                this.leftAxisLables = L.DomUtil.create('div', 'elevation-profile-left-axis', container);
                this.closeButton = L.DomUtil.create('div', 'elevation-profile-close', this.leftAxisLables);
                L.DomEvent.on(this.closeButton, 'click', this.onCloseButtonClick, this);
                this.drawingContainer = L.DomUtil.create('div', 'elevation-profile-drawingContainer', container);
                this.graphCursor = L.DomUtil.create('div', 'elevation-profile-cursor elevation-profile-cursor-hidden',
                    this.drawingContainer);
                this.graphCursorLabel = L.DomUtil.create('div', 'elevation-profile-cursor-label elevation-profile-cursor-hidden',
                    this.drawingContainer);
                this.graphSelection = L.DomUtil.create('div', 'elevation-profile-selection elevation-profile-cursor-hidden',
                    this.drawingContainer);
                var svgWidth = this.svgWidth = this.drawingContainer.clientWidth * horizZoom,
                    svgHeight = this.svgHeight = this.drawingContainer.clientHeight;
                var svg = this.svg = createSvg('svg', {width: svgWidth, height: svgHeight}, this.drawingContainer);
                L.DomEvent.on(svg, 'mousemove', this.onSvgMouseMove, this);
                L.DomEvent.on(svg, 'mouseenter', this.onSvgEnter, this);
                L.DomEvent.on(svg, 'mouseleave', this.onSvgLeave, this);
                this.svgDragEvents = new DragEvents(svg);
                this.svgDragEvents.on('dragstart', this.onSvgDragStart, this);
                this.svgDragEvents.on('dragend', this.onSvgDragEnd, this);
                this.svgDragEvents.on('drag', this.onSvgDrag, this);
                this.svgDragEvents.on('click', this.onSvgClick, this);
            },

            removeFrom: function(map) {
                if (!this._map) {
                    return;
                }
                this._map._controlContainer.removeChild(this._container);
                map.removeLayer(this.polyline);
                map.removeLayer(this.trackMarker);
                this._map = null;
                return this;
            },

            onSvgDragStart: function(e) {
                // FIXME: restore hiding when we make display of selection on map
                // this.cursorHide();
                L.DomUtil.removeClass(this.graphSelection, 'elevation-profile-cursor-hidden');
                this.polyLineSelection.addTo(this._map).bringToBack();
                this.dragStart = e.offsetX;
            },

            onSvgDragEnd: function(e) {
                this.cursorShow();
                var x = e.offsetX;
                var selStart = Math.min(x, this.dragStart);
                selStart = Math.round(selStart / (this.svgWidth - 1) * (this.values.length - 1));
                var selEnd = Math.max(x, this.dragStart);
                selEnd = Math.round(selEnd / (this.svgWidth - 1) * (this.values.length - 1));

                var stats = this.calcProfileStats(this.values.slice(selStart, selEnd + 1), true);
                this.updatePropsDisplay(stats);
                L.DomUtil.addClass(this.propsContainer, 'elevation-profile-properties-selected');

            },

            onSvgDrag: function(e) {
                var x = e.offsetX;
                var selStart = Math.min(x, this.dragStart);
                var selEnd = Math.max(x, this.dragStart);
                this.graphSelection.style.left = selStart + 'px';
                this.graphSelection.style.width = (selEnd - selStart)+ 'px';
                var selStartInd = Math.round(selStart / (this.svgWidth - 1) * (this.values.length - 1)),
                    selEndInd = Math.round(selEnd / (this.svgWidth - 1) * (this.values.length - 1));
                this.polyLineSelection.setLatLngs(this.samples.slice(selStartInd, selEndInd + 1));
            },

            onSvgClick: function() {
                L.DomUtil.addClass(this.graphSelection, 'elevation-profile-cursor-hidden');
                L.DomUtil.removeClass(this.propsContainer, 'elevation-profile-properties-selected');
                this._map.removeLayer(this.polyLineSelection);
                if (this.stats) {
                    this.updatePropsDisplay(this.stats);
                }
            },


            updateGraph: function() {
                if (!this._map || !this.values) {
                    return;
                }

                this.stats = this.calcProfileStats(this.values);
                this.updatePropsDisplay(this.stats);
                this.setupGraph();
            },

            updatePropsDisplay: function(stats) {
                if (!this._map) {
                    return;
                }
                this.propsContainer.innerHTML = '';
                var ascentAngleStr = isNaN(stats.angleAvgAscent) ? '-' : L.Util.template('{avg} / {max}&deg;',
                    {avg: stats.angleAvgAscent, max: stats.angleMaxAscent});
                var descentAngleStr = isNaN(stats.angleAvgDescent) ? '-' : L.Util.template('{avg} / {max}&deg;',
                    {avg: stats.angleAvgDescent, max: stats.angleMaxDescent});

                this.propsContainer.innerHTML =
                    '<table>' +
                    '<tr><td>Max elevation:</td><td>' + stats.max + '</td></tr>' +
                    '<tr><td>Min elevation:</td><td>' + stats.min + '</td></tr>' +
                    '<tr><td>Start elevation:</td><td>' + stats.start + '</td></tr>' +
                    '<tr><td>Finish elevation:</td><td>' + stats.end + '</td></tr>' +
                    '<tr><td>Overall elevation change:</td><td>' + stats.finalAscent + '</td></tr>' +
                    '<tr><td>Avg / Max ascent inclination:</td><td>' + ascentAngleStr + '</td></tr>' +
                    '<tr><td>Avg / Max descent inclination:</td><td>' + descentAngleStr + '</td></tr>' +
                    '<tr><td>Distance:</td><td>' + (stats.distance / 1000).toFixed(1) + ' km</td></tr>' +
                    '<tr><td>Total ascent:</td><td>'+ stats.ascent +'</td></tr>' +
                    '<tr><td>Total descent:</td><td>'+ stats.descent +'</td></tr>' +
                    '</table>'
            },

            calcGridValues: function(minValue, maxValue) {
                var ticksNs = [3, 4, 5],
                    tickSteps = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000],
                    ticks = [],
                    i, j, k, ticksN, tickStep, tick1, tick2;
                for (i = 0; i < tickSteps.length; i++) {
                    tickStep = tickSteps[i];
                    for (j = 0; j< ticksNs.length; j++) {
                        ticksN = ticksNs[j];
                        tick1 = Math.floor(minValue / tickStep);
                        tick2 = Math.ceil(maxValue / tickStep);
                        if ((tick2 - tick1) < ticksN) {
                            for (k = tick1; k < tick1 + ticksN; k++) {
                                ticks.push(k * tickStep);
                            }
                            return ticks;
                        }
                    }
                }
            },

            filterElevations: function(values, tolerance) {
                var filtered = values.slice(0);
                if (filtered.length < 3) {
                    return filtered;
                }
                var scanStart, scanEnd, job, linearValue, linearDelta, maxError, maxErrorInd, i, error;
                var queue = [[0, filtered.length - 1]];
                while (queue.length) {
                    job = queue.pop();
                    scanStart = job[0];
                    scanEnd = job[1];
                    linearValue = filtered[scanStart];
                    linearDelta = (filtered[scanEnd] - filtered[scanStart]) / (scanEnd - scanStart);
                    maxError = null;
                    maxErrorInd = null;
                    for (i = scanStart + 1; i < scanEnd; i++) {
                        linearValue += linearDelta;
                        error = Math.abs(filtered[i] - linearValue);
                        if (error === null || error > maxError) {
                            maxError = error;
                            maxErrorInd = i;
                        }
                    }
                    if (maxError > tolerance) {
                        if (scanEnd > scanStart + 2) {
                            queue.push([scanStart, maxErrorInd]);
                            queue.push([maxErrorInd, scanEnd]);
                        }
                    } else {
                        filtered.splice(scanStart + 1, scanEnd - scanStart - 1);
                    }
                }
                return filtered;
            },

            calcProfileStats: function(values, partial) {
                var stats = {},
                    gradient, i;
                stats.min = Math.min.apply(null, values);
                stats.max = Math.max.apply(null, values);
                stats.finalAscent = values[values.length - 1] - values[0];
                var ascents = [],
                    descents = [];
                for (i = 1; i < values.length; i++) {
                    gradient = (values[i] - values[i - 1]);
                    if (gradient > 0) {
                        ascents.push(gradient);
                    } else if (gradient < 0) {
                        descents.push(-gradient);
                    }
                }
                function sum(a, b) {
                    return a + b;
                }
                stats.gradientAvgAscent = ascents.reduce(sum, 0) / ascents.length / this.options.samplingInterval;
                stats.gradientMinAscent = Math.min.apply(null, ascents) / this.options.samplingInterval;
                stats.gradientMaxAscent = Math.max.apply(null, ascents) / this.options.samplingInterval;
                stats.gradientAvgDescent = descents.reduce(sum, 0) / descents.length / this.options.samplingInterval;
                stats.gradientMinDescent = Math.min.apply(null, descents) / this.options.samplingInterval;
                stats.gradientMaxDescent = Math.max.apply(null, descents) / this.options.samplingInterval;

                stats.angleAvgAscent = gradientToAngle(stats.gradientAvgAscent);
                stats.angleMinAscent = gradientToAngle(stats.gradientMinAscent);
                stats.angleMaxAscent = gradientToAngle(stats.gradientMaxAscent);
                stats.angleAvgDescent = gradientToAngle(stats.gradientAvgDescent);
                stats.angleMinDescent = gradientToAngle(stats.gradientMinDescent);
                stats.angleMaxDescent = gradientToAngle(stats.gradientMaxDescent);

                stats.start = values[0];
                stats.end = values[values.length - 1];
                stats.distance = (values.length - 1) * this.options.samplingInterval;

                var filterTolerance;
                if (partial) {
                    filterTolerance = Math.max((this.stats.max - this.stats.min) / 25, 5)
                } else {
                    filterTolerance = Math.max((stats.max - stats.min) / 25, 5);
                }
                var filtered = this.filterElevations(values, filterTolerance);
                var ascent = 0,
                    descent = 0,
                    delta;
                for (i = 1; i < filtered.length; i++) {
                    delta = filtered[i] - filtered[i - 1];
                    if (delta < 0) {
                        descent += -delta;
                    } else {
                        ascent += delta;
                    }
                }
                stats.ascent = ascent;
                stats.descent = descent;

                return stats;

            },

            setCursorPosition: function(ind) {
                var distance = this.options.samplingInterval * ind;
                distance = (distance / 1000).toFixed(2) + ' km';
                var gradient = (this.values[Math.ceil(ind)] - this.values[Math.floor(ind)]) / this.options.samplingInterval;
                var angle = Math.round(Math.atan(gradient) * 180 / Math.PI);
                gradient = Math.round(gradient * 100);

                var x = ind / (this.values.length - 1) * (this.svgWidth - 1);
                var indInt = Math.round(ind);
                var elevation = this.values[indInt];
                this.graphCursorLabel.innerHTML = L.Util.template('{ele}<br>{dist}<br>{angle}&deg;',
                    {ele: elevation, dist: distance, grad: gradient, angle: angle});

                this.graphCursor.style.left = x + 'px';
                this.graphCursorLabel.style.left = x + 'px';
                if (this.drawingContainer.getBoundingClientRect().left - this.drawingContainer.scrollLeft + x +  this.graphCursorLabel.offsetWidth >= this._container.getBoundingClientRect().right) {
                    L.DomUtil.addClass(this.graphCursorLabel, 'elevation-profile-cursor-label-left');
                } else {
                    L.DomUtil.removeClass(this.graphCursorLabel, 'elevation-profile-cursor-label-left');
                }

                var markerPos;
                if (ind <= 0) {
                    markerPos = this.samples[0];
                } else if (ind >= this.samples.length - 1) {
                    markerPos = this.samples[this.samples.length - 1];
                } else {
                    var p1 = this.samples[Math.floor(ind)],
                        p2 = this.samples[Math.ceil(ind)],
                        indFrac = ind - Math.floor(ind);
                    markerPos = [p1.lat + (p2.lat - p1.lat) * indFrac, p1.lng + (p2.lng - p1.lng) * indFrac];
                }
                this.trackMarker.setLatLng(markerPos);
                var label = L.Util.template('{ele}<br>{dist}<br>{angle}&deg;',
                    {ele: elevation, dist: distance, grad: gradient, angle: angle});
                var icon = L.divIcon({className: 'elevation-profile-marker',
                    html: '<div class="elevation-profile-marker-icon"></div><div class="elevation-profile-marker-label">' + label + '</div>'});
                this.trackMarker.setIcon(icon);
            },

            onSvgMouseMove: function(e) {
                if (!this.values) {
                    return;
                }
                var x = offestFromEvent(e).offsetX;
                var ind = (x / (this.svgWidth - 1) * (this.values.length - 1));
                this.setCursorPosition(ind);
            },

            cursorShow: function() {
                L.DomUtil.removeClass(this.graphCursor, 'elevation-profile-cursor-hidden');
                L.DomUtil.removeClass(this.graphCursorLabel, 'elevation-profile-cursor-hidden');
                this._map.addLayer(this.trackMarker);
            },

            cursorHide: function() {
                L.DomUtil.addClass(this.graphCursor, 'elevation-profile-cursor-hidden');
                L.DomUtil.addClass(this.graphCursorLabel, 'elevation-profile-cursor-hidden');
                this._map.removeLayer(this.trackMarker);
            },

            onSvgEnter: function() {
                this.cursorShow();
            },

            onSvgLeave: function() {
                this.cursorHide();
            },

            onLineMouseEnter: function() {
                this.cursorShow();
            },

            onLineMouseLeave: function() {
                this.cursorHide();
            },

            onLineMouseMove: function(e) {
                function sqrDist(latlng1, latlng2) {
                    var dx = (latlng1.lng - latlng2.lng);
                    var dy = (latlng1.lat - latlng2.lat);
                    return dx * dx + dy * dy;
                }

                var nearestInd = null,
                    minDist = null,
                    mouseLatlng = e.latlng,
                    i, sampleLatlng, dist;
                for (i = 0; i < this.samples.length; i++) {
                    sampleLatlng = this.samples[i];
                    dist  = sqrDist(sampleLatlng, mouseLatlng);
                    if (nearestInd === null || dist < minDist) {
                        nearestInd = i;
                        minDist = dist;
                    }
                }

                if (nearestInd !== null) {
                    if (nearestInd > 0) {
                        var prevDist = sqrDist(mouseLatlng, this.samples[nearestInd - 1]),
                            prevSampleDist = sqrDist(this.samples[nearestInd], this.samples[nearestInd - 1]);
                    }
                    if (nearestInd < this.samples.length - 1) {
                        var nextDist = sqrDist(mouseLatlng, this.samples[nearestInd + 1]),
                            nextSampleDist = sqrDist(this.samples[nearestInd], this.samples[nearestInd + 1]);
                    }

                    if (nearestInd === 0) {
                        if (nextDist < minDist + nextSampleDist) {
                            nearestInd += (minDist - nextDist) / 2 / nextSampleDist + 1/2;
                        } else {
                            nearestInd = .001;
                        }
                    } else if (nearestInd === this.samples.length - 1) {
                        if (prevDist < minDist + prevSampleDist) {
                            nearestInd -= ((minDist - prevDist) / 2 / prevSampleDist + 1 / 2);
                        } else {
                            nearestInd -= .001
                        }
                    } else {
                        if (prevDist < nextDist) {
                            nearestInd -= ((minDist - prevDist) / 2 / prevSampleDist + 1 / 2);
                        } else {
                            nearestInd += (minDist - nextDist) / 2 / nextSampleDist + 1/2;

                        }
                    }

                    this.setCursorPosition(nearestInd);
                }

            },


            setupGraph: function() {
                if (!this._map) {
                    return;
                }

                var maxValue = Math.max.apply(null, this.values),
                    minValue = Math.min.apply(null, this.values),
                    svg = this.svg,
                    path, i, horizStep, verticalMultiplier, x, y, gridValues, label;


                var paddingBottom = 8 + 16,
                    paddingTop = 8;

                gridValues = this.calcGridValues(minValue, maxValue);
                var gridStep = (this.svgHeight - paddingBottom - paddingTop) / (gridValues.length - 1);
                for (i = 0; i < gridValues.length; i++) {
                    y = Math.round(i * gridStep - 0.5) + 0.5 + paddingTop;
                    path = L.Util.template('M{x1} {y} L{x2} {y}', {x1: 0, x2: this.svgWidth * this.horizZoom, y: y});
                    createSvg('path', {d: path, 'stroke-width': '1px', stroke: 'green', fill: 'none'}, svg);

                    label = L.DomUtil.create('div', 'elevation-profile-grid-label', this.leftAxisLables);
                    label.innerHTML = gridValues[gridValues.length - i - 1];
                    label.style.top = (gridStep * i + paddingTop) + 'px';
                }

                horizStep = this.svgWidth / (this.values.length - 1);
                verticalMultiplier = (this.svgHeight - paddingTop - paddingBottom) / (gridValues[gridValues.length - 1] - gridValues[0]);

                path = [];
                for (i = 0; i < this.values.length; i++) {
                    path.push(i ? 'L' : 'M');
                    x = i * horizStep;
                    y = (this.values[i] - gridValues[0]) * verticalMultiplier;
                    y = this.svgHeight - y - paddingBottom;
                    path.push(x + ' ' + y + ' ');
                }
                path = path.join('');
                createSvg('path', {d: path, 'stroke-width': '1px', stroke: 'brown', fill: 'none'}, svg);
            },

            _getElevation: function(latlngs) {
                function parseResponse(s) {
                    var values = [], v;
                    s = s.split('\n');
                    for (var i = 0; i < s.length; i++) {
                        if (s[i]) {
                            if (s[i] == 'NULL') {
                                v = 0;
                            } else {
                                v = parseFloat(s[i]);
                            }
                            values.push(v);
                        }
                    }
                    return values;
                }

                var req = [];
                for (var i = 0; i < latlngs.length; i++) {
                    req.push(latlngs[i].lat.toFixed(5) + ' ' + latlngs[i].lng.toFixed(5));
                }
                req = req.join('\n');
                return fileutils.get(this.options.elevationsServer, {postData: req})
                    .then(
                        function(xhr){
                            return parseResponse(xhr.responseText);
                        },
                        function() {
                            console.log('ERROR', arguments);
                        });
            },
            onCloseButtonClick: function() {
                this.removeFrom(this._map);
            }
        }
    );

})();