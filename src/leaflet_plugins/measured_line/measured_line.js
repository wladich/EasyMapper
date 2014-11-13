//@require leaflet
//@require measured_line.css

(function (){
    "use strict";

    function pointOnSegmentAtDistance(p1, p2, dist) {
        var q = dist / distance(p1, p2),
            x = p1.lng + (p2.lng - p1.lng) * q,
            y = p1.lat + (p2.lat - p1.lat) * q;
        return L.latLng(y, x);

    }

    function distance(p1, p2) {
        var rad = Math.PI / 180,
            x1 = p1.lng * rad, y1 = p1.lat * rad,
            x2 = p2.lng * rad, y2 = p2.lat * rad,
            dy = y2 - y1,
            dx = (x2 - x1) * Math.cos(y1 + dy / 2),
            dist = Math.sqrt(dx * dx + dy * dy) * 6371009;
            return dist;
    }

    function sinCosFromSegment(segment) {
        var p1=segment[0],
            p2 = segment[1],
            dx = p2.x - p1.x,
            dy = p2.y - p1.y,
            len = Math.sqrt(dx * dx + dy * dy),
            sin = dy / len,
            cos = dx / len;
        return [sin, cos];
    }

    L.MeasuredLine = L.Polyline.extend({
        options: {
            minTicksIntervalMm: 15,
        },

        onAdd: function (map) {
            L.Polyline.prototype.onAdd.call(this, map);
            this._ticks = [];
            this.updateTicks();
            this._map.on('zoomend', this.updateTicks, this);
            this._map.on('dragend', this.updateTicks, this);

        },

        onRemove: function(map) {
            this._map.off('zoomend', this.updateTicks, this);
            this._map.off('dragend', this.updateTicks, this);
            this._clearTicks();
            L.Polyline.prototype.onRemove.call(this, map);
        },

        _clearTicks: function() {
            if (this._map) {
                this._ticks.forEach(this._map.removeLayer.bind(this._map));
                this._ticks = [];
            }

        },

        _addTick: function(tick) {
            var transformMatrixString = 'matrix(' + tick.transformMatrix.join(',') + ')',
                labelText = '&mdash;' + Math.round((tick.distanceValue / 10)) / 100 + ' km',
                icon = L.divIcon(
                                 {html: '<div class="measure-tick-icon-text" style="transform:' + transformMatrixString + '">'+labelText+'</div>',
                                 className: 'measure-tick-icon'}),
                marker = L.marker(tick.position, {icon: icon, clickable: false, keyboard: false});
            this._ticks.push(marker);
            marker.addTo(this._map);
        },

        setMeasureTicksVisible: function(visible) {
            this.options.measureTicksShown = visible;
            this.updateTicks();
        },

        getTicksPositions: function(minTicksIntervalMeters, bounds) {
            var steps = [500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000, 1000000];
            var ticks = [],
                self = this,
                step;

            function addTick(position, segment, distanceValue) {
                if (bounds && (!bounds.contains(position))) {
                    return;
                }
                segment = [self._map.project(segment[0], 1), self._map.project(segment[1], 1)];
                var sinCos = sinCosFromSegment(segment),
                    sin = sinCos[0], cos = sinCos[1],
                    transformMatrix, labelText;

                if (sin > 0) {
                    transformMatrix = [sin, -cos, cos, sin, 0, 0];
                } else {
                    transformMatrix = [-sin, cos, -cos, -sin, 0, 0];
                }
                ticks.push({position: position, distanceValue: distanceValue, transformMatrix: transformMatrix});
            }

            for (i=0; i < steps.length; i++) {
                step = steps[i];
                if (step >= minTicksIntervalMeters) {
                    break;
                }
            }

            var lastTickMeasure = 0,
                lastPointMeasure = 0,
                points=this._latlngs,
                points_n = points.length,
                nextPointMeasure,
                segmentLength;
            if (points_n < 2) {
                return ticks;
            }

            for (var i=1; i < points_n; i++) {
                segmentLength = distance(points[i], points[i-1]);
                nextPointMeasure = lastPointMeasure + segmentLength;
                if (nextPointMeasure >= lastTickMeasure + step) {
                    while (lastTickMeasure + step <= nextPointMeasure) {
                        lastTickMeasure += step;
                        addTick(
                                pointOnSegmentAtDistance(points[i-1], points[i], lastTickMeasure-lastPointMeasure),
                                [points[i-1], points[i]],
                                lastTickMeasure);
                    }
                }
                lastPointMeasure = nextPointMeasure;
            }
            if (lastPointMeasure > step/2) {
                addTick(points[0], [points[0], points[1]], 0);
                addTick(points[points_n-1], [points[points_n-2], points[points_n-1]], lastPointMeasure);
            }
            return ticks;
        },

        updateTicks: function() {
            this._clearTicks();
            if (!this._map || !this.options.measureTicksShown) {
                return;
            }
            var bounds = this._map.getBounds().pad(1),
                rad = Math.PI / 180,
                dpi = 96,
                mercatorMetersPerPixel = 20003931 / (this._map.project([180, 0]).x),
                realMetersPerPixel = mercatorMetersPerPixel * Math.cos(this.getBounds().getCenter().lat * rad),
                mapScale = 1 / dpi * 2.54 / 100 / realMetersPerPixel,
                minTicksIntervalMeters = this.options.minTicksIntervalMm / mapScale / 1000,
                ticks = this.getTicksPositions(minTicksIntervalMeters, bounds);
            ticks.forEach(this._addTick.bind(this));
        },

        getLength: function() {
            var points=this._latlngs,
                points_n = points.length,
                length = 0;

            for (var i=1; i<points_n; i++) {
                length += distance(points[i], points[i-1]);
            }
            return length;
        }
    });


    L.measuredLine = function(latlngs, options){
        return new L.MeasuredLine(latlngs, options);
    };
})();