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
                this._iconPositions = {};
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
                var tileSize = this.options.tileSize,
                    tileN = tilePoint.y * tileSize,
                    tileW = tilePoint.x * tileSize,
                    tileS = tileN + tileSize,
                    tileE = tileW + tileSize,

                    iconsHorPad = 520,
                    iconsVertPad = 50,
                    labelsHorPad = 256,
                    labelsVertPad = 20,
                    iconsBounds = L.latLngBounds(this._map.unproject([tileW - iconsHorPad, tileS + iconsHorPad], zoom),
                                                 this._map.unproject([tileE + iconsHorPad, tileN - iconsVertPad], zoom)),
                    labelsBounds = L.latLngBounds(this._map.unproject([tileW - labelsHorPad, tileS + labelsHorPad], zoom),
                                                  this._map.unproject([tileE + labelsHorPad, tileN - labelsVertPad], zoom)),
                    iconUrls = [],
                    markerJobs={},
                    marker, p, icon, markerId, img;

                var markers = this.rtree.search(
                    [iconsBounds.getWest(), iconsBounds.getSouth(), iconsBounds.getEast(), iconsBounds.getNorth()]
                );

                for (var i = 0; i < markers.length; i++) {
                    marker = markers[i];
                    p = this._map.project(marker.latlng, zoom);
                    icon = marker.icon;
                    if (typeof icon === 'function') {
                        icon = icon(marker);
                    }
                    iconUrls.push(icon.url);
                    markerId = L.stamp(marker);
                    markerJobs[markerId] = {marker: marker, icon: icon, projectedXY: p}; 
                }
                var self = this;
                this.preloadIcons(iconUrls, function() {
                    var markerId, i, regionsInTile, isLabel, job, x, y, imgW, imgH,
                        label, textWidth, textHeight, ctx, p;
                    if (!self._map) {
                        return;
                    }
                    ctx = canvas.getContext('2d');
                    ctx.font = "bold 10px Verdana, Arial, sans-serif";
                    for (markerId in markerJobs) {
                        job = markerJobs[markerId];
                        img = self._images[job.icon.url];
                        job.img = img;
                        imgW = img.width;
                        imgH = img.height;
                        if (!(markerId in self._iconPositions)) {
                            x = job.projectedXY.x - job.icon.center[0];
                            y = job.projectedXY.y - job.icon.center[1];
                            x = Math.round(x);
                            y = Math.round(y);
                            self._iconPositions[markerId] = [x, y];
                            self._regions.insert([x, y, x + imgW, y + imgH, job.marker, false]);
                        }
                        p = self._iconPositions[markerId];
                        x = p[0];
                        y = p[1];
                        job.iconCenter = [x + imgW / 2, y + imgH / 2];
                        job.iconSize = [imgW, imgH];
                    }
                    markers = self.rtree.search([labelsBounds.getWest(), labelsBounds.getSouth(),
                                                 labelsBounds.getEast(), labelsBounds.getNorth()]);
                    for (i = 0; i < markers.length; i++) {
                        marker = markers[i];
                        markerId = L.stamp(marker);
                        job = markerJobs[markerId];
                        label = job.marker.label;
                        if (label) {
                            if (typeof label === 'function') {
                                label = label(job.marker);
                            }
                            job.label = label;
                            if (!(markerId in self._labelPositions)) {
                                textWidth = ctx.measureText(label).width;
                                textHeight = 10;
                                p = self.findLabelPosition(job.iconCenter, job.iconSize, textWidth, textHeight);
                                self._labelPositions[markerId] = p;
                                x = p[0];
                                y = p[1];
                                self._regions.insert([x, y, x + textWidth, y + 10, job.marker, true]);
                            }
                        } else {
                            self._labelPositions[markerId] = null;
                        }
                    }

                    regionsInTile = self._regions.search([tileW, tileN, tileE, tileS]);
                    for (i = 0; i < regionsInTile.length; i++) {
                        marker = regionsInTile[i][4];
                        isLabel = regionsInTile[i][5];
                        markerId = L.stamp(marker);
                        job = markerJobs[markerId];
                        if (isLabel) {
                            p = self._labelPositions[markerId];
                            x = p[0] - tileW;
                            y = p[1] - tileN;
                            ctx.font = "bold 10px Verdana, Arial, sans-serif";
                            ctx.textBaseline = 'top';
                            ctx.shadowColor = '#fff';
                            ctx.strokeStyle = '#fff';
                            ctx.fillStyle = '#000';
                            ctx.lineWidth = 1;
                            ctx.shadowBlur = 2;

                            ctx.strokeText(job.label, x , y);
                            ctx.shadowBlur = 0;
                            ctx.fillText(job.label, x, y);
                        } else {
                            if (!job) {
                                continue
                            }
                            p = self._iconPositions[markerId];
                            x = p[0] - tileW;
                            y = p[1] - tileN;
                            ctx.drawImage(job.img, x, y);
                        }
                    }
                    self.tileDrawn(canvas);
                });
                return this;
            },

            resetLabels: function() {
                console.log('RESET LABELS')
                this._iconPositions = {};
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