//@require leaflet
//@require cors-proxy

(function() {
    'use strict';


    function getQuadKey(x, y, z) {
        var key = '0',
            s;
        y = (1 << z) - y - 1;
        z -= 1;
        while (z >= 0) {
            s = 1 << z;
            key += ((x & s) > 0 ? 1 : 0) + ((y & s) > 0 ? 2 : 0);
            z--;
        }
        return key;
    }

    function decodeWikimapiaTitles(s) {
        var titles = {};
        s = s.split('\x1f');
        for (var i = 0; i < s.length; i++) {
            if (typeof s[i] === 'string') {
                titles[(s[i].charCodeAt(0) - 32).toString()] = s[i].substring(1, s[i].length);
            }
        }
        return titles;
    }

    function chooseWikimapiaTitle(titles) {
        var popularLanguages = [1, 0, 3, 2, 5, 4, 9, 28, 17, 27];
        var langCode;
        for (var i = 0; i < popularLanguages.length; i++) {
            langCode = popularLanguages[i];
            if (langCode in titles) {
                return titles[langCode];
            }
        }
        for (langCode in titles) {
            return titles[langCode];
        }
    }

    function decodeWikimapiaPolygon(s) {
        var i = 0,
            coords = [],
            lat = 0,
            lng = 0;
        while (i < s.length) {
            var p, l = 0,
                c = 0;
            do {
                p = s.charCodeAt(i++) - 63;
                c |= (p & 31) << l;
                l += 5;
            } while (p >= 32);
            lng += c & 1 ? ~(c >> 1) : c >> 1;
            l = 0;
            c = 0;
            do {
                p = s.charCodeAt(i++) - 63;
                c |= (p & 31) << l;
                l += 5;
            } while (p >= 32);
            lat += c & 1 ? ~(c >> 1) : c >> 1;
            coords.push([lat / 1e6, lng / 1e6]);
        }
        return coords;
    }

    function parseWikimapiaTile(s) {
        var lines = s.split('\n');
        var places = [];
        var place, titles, coords;

        function parseBoundsCoord(x) {
            return parseInt(x, 10) / 1e7;
        }
        for (var i = 2; i < lines.length; i++) {
            place = {};
            var fields = lines[i].split('|');
            if (fields.length < 6) {
                continue;
            }
            //var objDisplayZoom = parseInt(fields[3], 10);
            place.id = parseInt(fields[0], 10);
            titles = decodeWikimapiaTitles(fields[5]);
            place.title = chooseWikimapiaTitle(titles);
            if (fields[6] != 1) {
                alert('Unknown wikimapia polygon encoding type: ', fields[6]);
            }
            coords = fields.slice(7).join('|');
            place.polygon = decodeWikimapiaPolygon(coords);
            place.boundsWESN = fields[2].split(',').map(parseBoundsCoord);
            places.push(place);
        }
        return places;
    }

    function isPointInPolygon(polygon, p) {
        var inside = false;
        var prevNode = polygon[polygon.length - 1],
            node, i;
        for (i = 0; i < polygon.length; i++) {
            node = polygon[i];
            if ((node[0] <= p[0] && p[0] < prevNode[0] || prevNode[0] <= p[0] && p[0] < node[0]) && p[1] < (prevNode[1] - node[1]) * (p[0] - node[0]) / (prevNode[0] - node[0]) + node[1]) {
                inside = !inside;
            }
            prevNode = node;
        }
        return inside;
    }

    var Label = L.Class.extend({
        initialize: function(text, latlng) {
            this.text = text;
            this.latlng = latlng;
        },

        onAdd: function(map) {
            this._map = map;
            this._container = L.DomUtil.create('div', 'leaflet-marker-icon leaflet-zoom-animated');
            this._container.innerHTML = this.text;
            L.Util.extend(this._container.style, {
                backgroundColor: '#FFFFA3',
                fontSize: '10pt',
                lineHeight: '1',
                border: '1px solid #777',
                borderRadius: '4px',
                // whiteSpace: 'nowrap',
                padding: '4px 6px',
                position: 'absolute',
                zIndex: '10000',
                maxWidth: '500px',
                boxSizing: 'borderBox'
            });
            map._container.appendChild(this._container);
            map.on('viewreset', this._updatePosition, this);
            map.on('mousemove', this.onMouseMove, this);
            this._updatePosition();
        },

        onRemove: function(map) {
            map.off('viewreset', this._updatePosition, this);
            map.off('mousemove', this.onMouseMove, this);
            map._container.removeChild(this._container);
        },

        onMouseMove: function(e) {
            this.latlng = e.latlng;
            this._updatePosition();
        },

        _updatePosition: function() {
            // var pos = this._map.latLngToLayerPoint(this.latlng);
            var pos = this._map.latLngToContainerPoint(this.latlng);
            var right = pos.x + this._container.clientWidth + 16 + 2;
            var x, y;
            y = pos.y - 16;
            x = pos.x;
            if (right > this._map._container.clientWidth) {
                x -= this._container.clientWidth + 16 + 2;
            } else {
                x += 16;
            }
            L.Util.extend(this._container.style, {
                top: y + 'px',
                left: x + 'px'
            });
        }
    });


    L.Wikimapia = L.TileLayer.Canvas.extend({
        options: {
            async: true,
            tileSize: 1024,
            updateWhenIdle: false,
            maxCacheSize: 20
        },

        initialize: function(options) {
            L.TileLayer.Canvas.prototype.initialize.call(this, options);
            this.tileCache = [];
        },

        onAdd: function(map) {
            L.TileLayer.prototype.onAdd.call(this, map);
            map.on('mousemove', this.highlightPlace, this);
            map.on('click', this.showPlaceDetails, this);
        },

        onRemove: function(map) {
            map.off('mousemove', this.highlightPlace, this);
            map.off('click', this.showPlaceDetails, this);
            if (this.highlightedPlace) {
                this._map.removeLayer(this.highlightedPlace.polygon);
                this._map.removeLayer(this.highlightedPlace.label);
                this.highlightedPlace = null;
            }
            L.TileLayer.prototype.onRemove.call(this, map);

        },

        getWikimapiaTile: function(x, y, zoomLevel, cb) {
            var tile;
            for (var i = 0; i < this.tileCache.length; i++) {
                tile = this.tileCache[i];
                if (tile.x == x && tile.y == y && tile.z == zoomLevel) {
                    console.log('CACHE HIT');
                    this.tileCache.pop(i);
                    this.tileCache.unshift(tile);
                    cb(tile);
                    return;
                }
            }
            console.log('CACHE MISS');
            var self = this;
            var tileId = getQuadKey(x, y, zoomLevel).replace(/(\d{3})(?!$)/g, '$1/');
            var url = 'http://wikimapia.org/z1/itiles/' + tileId + '.xy?342342';
            url = urlViaCorsProxy(url);
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url);
            xhr.onreadystatechange = function() {
                if (xhr.readyState == 4) {
                    if (!self._map) {
                        return;
                    }

                    tile = {
                        places: parseWikimapiaTile(xhr.response),
                        x: x,
                        y: y,
                        z: zoomLevel,
                        x0: x * 1024,
                        y0: y * 1024
                    };
                    self.makePolygonsLocal(x, y, zoomLevel + 2, tile.places);
                    self.tileCache.unshift(tile);
                    while (self.tileCache.length > self.options.maxCacheSize) {
                        self.tileCache.pop();
                    }
                    cb(tile);
                }
            };
            xhr.send();
        },

        _drawTile: function(canvas, places) {
            var canvasCtx = canvas.getContext('2d');
            canvasCtx.strokeStyle = '#CFA600';
            var points, p;
            for (var i = 0; i < places.length; i++) {
                points = places[i].localPolygon;
                var first = true;
                for (var j = 0; j < points.length; j++) {
                    p = points[j];
                    if (first) {
                        canvasCtx.moveTo(p[0], p[1]);
                    } else {
                        canvasCtx.lineTo(p[0], p[1]);
                    }
                    first = false;
                }
                canvasCtx.closePath();
            }
            canvasCtx.stroke();
        },

        makePolygonsLocal: function(tileX, tileY, viewZoom, places) {
            var x0 = tileX * 256 * 4,
                y0 = tileY * 256 * 4;
            var p0 = this._map.unproject([x0, y0]),
                p1 = this._map.unproject([x0 + 1, y0 + 1]),
                pixelDegSize = p0.lat - p1.lat;
            var latlngs, p, pixels, place, sw, ne;
            for (var i = 0; i < places.length; i++) {
                pixels = [];
                place = places[i];
                latlngs = place.polygon;
                latlngs = latlngs.map(L.point);
                latlngs = L.LineUtil.simplify(latlngs, pixelDegSize * 2);
                for (var j = 0; j < latlngs.length; j++) {
                    p = latlngs[j];
                    p = this._map.project([p.x, p.y], viewZoom);
                    pixels.push([p.x - x0, p.y - y0]);
                }
                place.localPolygon = pixels;

                sw = [place.boundsWESN[2], place.boundsWESN[0]];
                ne = [place.boundsWESN[3], place.boundsWESN[1]];
                sw = this._map.project(sw, viewZoom);
                ne = this._map.project(ne, viewZoom);
                place.localBoundsWESN = [sw.x - x0, ne.x - x0, sw.y - y0, ne.y - y0];
            }
        },

        getTileAtLayerPoint: function(x, y) {
            var i, tile;
            for (i = 0; i < this.tileCache.length; i++) {
                tile = this.tileCache[i];
                if (x >= tile.x0 && x < tile.x0 + 1024 && y >= tile.y0 && y < tile.y0 + 1024) {
                    return tile;
                }
            }
        },

        getPlaceAtLayerPoint: function(x, y, places) {
            var j, bounds, place;
            for (j = places.length - 1; j >= 0; j--) {
                place = places[j];
                bounds = place.localBoundsWESN;
                if (x >= bounds[0] && x <= bounds[1] && y >= bounds[3] && y <= bounds[2] && isPointInPolygon(place.localPolygon, [x, y])) {
                    return place;
                }
            }
        },

        highlightPlace: function(e) {
            var mouseLayerPoint = this._map.project(e.latlng);
            var i, j,
                viewZoom = this._map.getZoom();
            var bounds, place;
            var tile = this.getTileAtLayerPoint(mouseLayerPoint.x, mouseLayerPoint.y);
            if (tile) {
                place = this.getPlaceAtLayerPoint(mouseLayerPoint.x - tile.x0, mouseLayerPoint.y - tile.y0, tile.places);

            }
            if (this.highlightedPlace && (!place || this.highlightedPlace.id != place.id)) {
                this._map.removeLayer(this.highlightedPlace.polygon);
                this._map.removeLayer(this.highlightedPlace.label);
                this.highlightedPlace = null;
            }

            if (place && !this.highlightedPlace) {
                this.highlightedPlace = {
                    id: place.id,
                    polygon: L.polygon(place.polygon, {
                        weight: 0,
                        color: '#E6B800'
                    }),
                    label: (new Label(place.title, e.latlng))
                };
                this.highlightedPlace.polygon.addTo(this._map);
                this._map.addLayer(this.highlightedPlace.label);
            }
        },

        showPlaceDetails: function() {
            if (this.highlightedPlace) {
                var url = 'http://wikimapia.org/' + this.highlightedPlace.id + '/ru/';
                var width = 568,
                    left, top, height,
                    screenLeft = screen.availLeft || 0,
                    screenTop = screen.availTop || 0,
                    bordersWidth = 8;
                // if browser window is in the right half of screen, place new window on left half
                if (window.screenX - screenLeft - bordersWidth * 1.5 > width) {
                    left = window.screenX - width - bordersWidth * 1.5;
                // if browser window is in the left half of screen, place new window on right half
                } else if (window.screenX + window.outerWidth + width + bordersWidth * 1.5 < screenLeft + screen.availWidth) {
                    left = window.screenX + window.outerWidth + bordersWidth;
                // if screen is small or browser window occupies whole screen, place new window on top of current window
                } else {
                    left = window.screenX + window.outerWidth / 2 - width / 2;
                    if (left < 0) {
                        left = 0;
                    }
                }
                top = window.screenY;
                height = window.innerHeight;
                var features = 'width=' + width + ',height=' + height + ',left=' + left + ',top=' + top;
                features += ',resizable,scrollbars';
                window.open(url, 'wikimapia-details', features)
                    .focus();
            }
        },

        drawTile: function(canvas, tileXY, viewZoom) {
            console.log('TILE REQUEST', viewZoom - 2, tileXY.x, tileXY.y);
            var self = this;
            this.getWikimapiaTile(tileXY.x, tileXY.y, viewZoom - 2, function(tile) {
                if (!self._map) {
                    return;
                }
                var t = Date.now();
                self._drawTile(canvas, tile.places);
                self.tileDrawn(canvas);
                console.log('DRAW TILE ', Date.now() - t);
            });
        }
    });
})();