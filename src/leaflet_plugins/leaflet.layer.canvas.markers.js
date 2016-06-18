//@require rbush
//@require leaflet
//@require leaflet.layer.canvas.markers.css

(function() {
    'use strict';

    /*
     Marker definition:
     {
     latlng: L.Latlng,
     icon: {url: string, center: [x, y]} or function(marker) returning icon,
     label: sting,
     tooltip: string,
     any other fields
     }
     */


    L.TileLayer.Markers = L.TileLayer.Canvas.extend({
            options: {
                async: true
            },

            initialize: function(markers) {
                this.rtree = rbush(9, ['.latlng.lng', '.latlng.lat', '.latlng.lng', '.latlng.lat']);
                this._regions = rbush();
                this._markerHasRegion = {};
                this._labelPositions = {};
                this._zoom = null;
                this.addMarkers(markers);
                this._images = {};
                this._tileQueue = [];
                this._hoverMarker = null;
                this.on('markerenter', this.onMarkerEnter, this);
                this.on('markerleave', this.onMarkerLeave, this);
            },

            addMarkers: function(markers) {
                if (markers) {
                    this.rtree.load(markers);
                }
                this.redraw();
            },

            findLabelPosition: function(iconCenter, iconSize, textWidth, textHeight) {
                var verticalPadding = -1,
                    xPositions = [iconCenter[0] + iconSize[0] / 2 + 2, iconCenter[0] - iconSize[0] / 2 - textWidth - 2],
                    yPositions = [iconCenter[1] - textHeight / 2 + verticalPadding,
                        iconCenter[1] - textHeight * .75 - iconSize[1] / 4 + verticalPadding,
                        iconCenter[1] - textHeight / 4 + iconSize[1] / 4 + verticalPadding,
                        iconCenter[1] - textHeight - iconSize[1] / 2 + verticalPadding,
                        iconCenter[1] + iconSize[1] / 2 + verticalPadding
                    ], i, j, bestX, bestY, minIntersectionSum, intersectionSum, x, y;

                var self = this;

                function calcIntersectionSum(rect) {
                    var regions = self._regions.search(rect),
                        sum = 0,
                        k, left, right, top, bottom, rect2;

                    for (k = 0; k < regions.length; k++) {
                        rect2 = regions[k];
                        left = Math.max(rect[0], rect2[0]);
                        right = Math.min(rect[2], rect2[2]);
                        top = Math.max(rect[1], rect2[1]);
                        bottom = Math.min(rect[3], rect2[3]);
                        if (top < bottom && left < right) {
                            sum += ((right - left) * (bottom - top));
                        }
                    }
                    return sum;
                }

                minIntersectionSum = 1e10;
                for (i = 0; i < xPositions.length; i++) {
                    x = xPositions[i];
                    for (j = 0; j < yPositions.length; j++) {
                        y = yPositions[j];
                        intersectionSum = calcIntersectionSum([x, y, x + textWidth, y + textHeight]);
                        if (intersectionSum < minIntersectionSum) {
                            minIntersectionSum = intersectionSum;
                            bestX = x;
                            bestY = y;
                            if (intersectionSum === 0) {
                                break;
                            }
                        }
                        if (intersectionSum === 0) {
                            break;
                        }
                    }
                }

                return [bestX, bestY];
            },

            drawIcon: function(ctx, tileOrigin, p, icon, marker) {
                var img = this._images[icon.url],
                    x = p.x - icon.center[0],
                    y = p.y - icon.center[1],
                    markerId;
                x = Math.round(x);
                y = Math.round(y);
                ctx.drawImage(img, x - tileOrigin.x, y - tileOrigin.y);
                markerId = L.stamp(marker);
                if (!(markerId in this._markerHasRegion)) {
                    this._regions.insert([x, y, x + img.width, y + img.height, marker]);
                    this._markerHasRegion[markerId] = true;
                }
                return {
                    iconCenter: [x + img.width / 2, y + img.height / 2],
                    iconSize: [img.width, img.height]
                }
            },

            drawLabel: function(ctx, tileOrigin, iconCenter, iconSize, marker) {
                var textWidth, markerId, labelPosition, x, y;
                markerId = L.stamp(marker);
                if (!marker.label) {
                    return;
                }
                textWidth = ctx.measureText(marker.label).width;
                if (markerId in this._labelPositions) {
                    labelPosition = this._labelPositions[markerId];
                    x = labelPosition[0];
                    y = labelPosition[1];
                } else {
                    labelPosition = this.findLabelPosition(iconCenter, iconSize, textWidth, 10);
                    x = labelPosition[0];
                    y = labelPosition[1];
                    this._labelPositions[markerId] = labelPosition;
                    this._regions.insert([x, y, x + textWidth, y + 10, marker]);
                }
                ctx.shadowBlur = 2;
                ctx.strokeText(marker.label, x - tileOrigin.x, y - tileOrigin.y);
                ctx.shadowBlur = 0;
                ctx.fillText(marker.label, x - tileOrigin.x, y - tileOrigin.y);
            },

            _iconPreloadFinished: function() {
                var url;
                for (url in this._images) {
                    if (!this._images[url].complete) {
                        return false;
                    }
                }
                return true;
            },

            _processTilesQueue: function() {
                while (this._tileQueue.length) {
                    (this._tileQueue.pop())();
                }
            },

            preloadIcons: function(urls, cb) {
                this._tileQueue.push(cb);
                var self = this,
                    url, i, img;
                for (i = 0; i < urls.length; i++) {
                    url = urls[i];
                    if (!(url in this._images)) {
                        img = new Image();
                        this._images[url] = img;
                        img.onload = function() {
                            if (self._iconPreloadFinished()) {
                                self._processTilesQueue();
                            }
                        };
                        console.log('preloading ', url);
                        img.src = url;
                    }
                }
                if (self._iconPreloadFinished()) {
                    self._processTilesQueue();
                }
            },

            drawTile: function(canvas, tilePoint, zoom) {
                console.time('draw tile ' + tilePoint.x + ',' + tilePoint.y);
                var bounds = this._getTileBounds(tilePoint, zoom).pad(0.5),
                    markers = this.rtree.search([bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()]),
                    tileOrigin = this._getTileProjectedOrigin(tilePoint),
                    iconUrls = [],
                    self = this,
                    marker, p, icon, image;

                for (var i = 0; i < markers.length; i++) {
                    marker = markers[i];
                    p = this._map.project(marker.latlng, zoom);
                    icon = marker.icon;
                    if (typeof icon === 'function') {
                        icon = icon(marker);
                    }
                    iconUrls.push(icon.url);
                }
                this.preloadIcons(iconUrls, function() {
                        var labelJobs = [], res, i, ctx;
                        if (!self._map) {
                            return;
                        }
                        ctx = canvas.getContext('2d');
                        for (i = 0; i < markers.length; i++) {
                            marker = markers[i];
                            p = self._map.project(marker.latlng, zoom);
                            icon = marker.icon;
                            if (typeof icon === 'function') {
                                icon = icon(marker);
                            }
                            res = self.drawIcon(ctx, tileOrigin, p, icon, marker);
                            labelJobs.push([res.iconCenter, res.iconSize, marker]);
                        }
                        ctx.font = "bold 10px Verdana, Arial, sans-serif";
                        ctx.textBaseline = 'top';
                        ctx.shadowColor = '#fff';
                        ctx.strokeStyle = '#fff';
                        ctx.lineWidth = 1;
                        ctx.fillStyle = '#000';
                        for (i = 0; i < labelJobs.length; i++) {
                            marker = markers[i];
                            self.drawLabel(ctx, tileOrigin, labelJobs[i][0], labelJobs[i][1], labelJobs[i][2]);
                        }
                        self.tileDrawn(canvas);
                        console.timeEnd('draw tile ' + tilePoint.x + ',' + tilePoint.y);
                    }
                );
                return this;
            },

            _getTileProjectedOrigin: function(tilePoint) {
                return tilePoint.multiplyBy(this.options.tileSize);
            },

            _getTileBounds: function(tilePoint, zoom) {
                var size = this.options.tileSize,
                    nw = tilePoint.multiplyBy(size),
                    se = nw.add([size, size]),
                    bounds = L.latLngBounds(this._map.unproject(se, zoom), this._map.unproject(nw, zoom));
                return bounds;
            },

            resetLabels: function() {
                console.log('RESET LABELS')
                this._markerHasRegion = {};
                this._labelPositions = {};
                this._regions.clear();
            },

            onMouseMove: function(e) {
                var p = this._map.project(e.latlng),
                    region = this._regions.search([p.x, p.y, p.x, p.y])[0],
                    marker;
                if (region) {
                    marker = region[4];
                } else {
                    marker = null;
                }
                if (this._hoverMarker !== marker) {
                    if (this._hoverMarker) {
                        this.fire('markerleave', {marker: this._hoverMarker});
                    }
                    if (marker) {
                        this.fire('markerenter', {marker: marker});
                    }
                    this._hoverMarker = marker;
                }
            },

            showTooltip: function(e) {
                var text;
                if (!e.marker.tooltip) {
                    return;
                }
                text = e.marker.tooltip;
                if (typeof text === 'function') {
                    text = text(e.marker);
                    if (!e.marker.tooltip) {
                        return;
                    }
                }
                this.toolTip.innerHTML = text;
                var p = this._map.latLngToLayerPoint(e.marker.latlng)
                L.DomUtil.setPosition(this.toolTip, p);
                L.DomUtil.addClass(this.toolTip, 'canvas-marker-tooltip-on');
            },

            onMarkerEnter: function(e) {
                this._map._container.style.cursor = 'pointer';
                this.showTooltip(e);

            },

            onMarkerLeave: function() {
                this._map._container.style.cursor = '';
                L.DomUtil.removeClass(this.toolTip, 'canvas-marker-tooltip-on');
            },

            onMouseOut: function() {
                if (this._hoverMarker) {
                    this._hoverMarker = null;
                    this.fire('markerleave', {marker: this._hoverMarker});
                }
            },

            onClick: function(e) {
                var p = this._map.project(e.latlng),
                    region = this._regions.search([p.x, p.y, p.x, p.y])[0],
                    marker;
                if (region) {
                    marker = region[4];
                    this.fire('markerclick', {marker: marker});
                }

            },

            onAdd: function(map) {
                if (this._lastZoom !== map.getZoom()) {
                    this.resetLabels();
                }
                L.TileLayer.Canvas.prototype.onAdd.call(this, map);
                map.on('viewreset', this.resetLabels, this);
                map.on('mousemove', this.onMouseMove, this);
                map.on('mouseout', this.onMouseOut, this);
                map.on('click', this.onClick, this);
                this.toolTip = L.DomUtil.create('div', 'canvas-marker-tooltip', this._map.getPanes().markerPane);
            },

            onRemove: function(map) {
                this._map.off('viewreset', this.resetLabels, this);
                this._map.off('mousemove', this.onMouseMove, this);
                this._map.off('mouseout', this.onMouseOut, this);
                this._map.off('click', this.onClick, this);
                if (this._hoverMarker) {
                    this._hoverMarker = null;
                    this.fire('markerleave', {marker: this._hoverMarker})
                }
                this._lastZoom = this._map.getZoom();
                this._map.getPanes().markerPane.removeChild(this.toolTip);
                L.TileLayer.Canvas.prototype.onRemove.call(this, map);
            }

        }
    );
})();