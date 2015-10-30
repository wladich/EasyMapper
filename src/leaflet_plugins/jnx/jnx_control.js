//@require jnx_control.css
//@require leaflet
//@require leaflet.buttons
//@require ../print_pages/lib/map_to_image.js
//@require promise
//@require fileutils
//@require cors-proxy
//@require leaflet.tile_layer_grabber
//@require binstream
//@require filesaver
//@require knockout
//@require knockout.progress
//@require leaflet.contextmenu
//@require leaflet.hash_state

(function(){
    "use strict";
    
    var MAX_MAP_SIZE = 4096;

    L.RectangleSelect = L.Rectangle.extend({
        includes: [L.Mixin.Events],

        options: {
            opacity: 0
        },

        onAdd: function(map) {
            var self = this;
            L.Rectangle.prototype.onAdd.call(this, map);
            var icon = L.divIcon();
            this.markers = this._boundsToLatLngs(this.getBounds()).map(function(latlng) {
                var marker = L.marker(latlng, {draggable: true, icon: icon});
                marker.addTo(self._map);
                marker.on('drag', function() {self.onMarkerMoved(marker);}, self);
                marker.on('dragend', function() {
                        setTimeout(function() {
                            self.fire('change');
                        }, 0);});
                return marker;
            });
            this.markers[0].i1 = 0;
            this.markers[0].i2 = 0;
            this.markers[1].i1 = 1;
            this.markers[1].i2 = 0;
            this.markers[2].i1 = 1;
            this.markers[2].i2 = 1;
            this.markers[3].i1 = 0;
            this.markers[3].i2 = 1;
        },

        onRemove: function(map) {
            var self = this;
            this.markers.forEach(function(marker){
                self._map.removeLayer(marker);
            });
            this.markers = null;
            L.Rectangle.prototype.onRemove.call(this, map);
        },

        onMarkerMoved: function(marker) {
            var bounds = this.getBounds();
            var latlng = marker.getLatLng();
            bounds = [[bounds.getSouth(), bounds.getWest()], [bounds.getNorth(), bounds.getEast()]];
            bounds[marker.i1][0] = latlng.lat;
            bounds[marker.i2][1] = latlng.lng;
            this.setBounds(bounds);
        },

        setBounds: function(bounds) {
            L.Rectangle.prototype.setBounds.call(this, bounds);
            var coords = this._boundsToLatLngs(bounds);
            for (var i=0; i < 4; i++) {
                this.markers[i].setLatLng(coords[i]);
            }
        }
    });


    function jnxCoordinates(extents) {
        function toJnx(x) {
            return Math.round(x / 180.0 * 0x7fffffff);
        }
        return [toJnx(extents.north), toJnx(extents.east), toJnx(extents.south), toJnx(extents.west)];
    }

    var JnxWriter = L.Class.extend({
        initialize: function(productName, productId, zOrder) {
            this.tiles = {};
            this.productName = productName || 'Raster map';
            this.productId = productId || 0;
            this.zOrder = zOrder;
        },

        addTile: function(tileData, level, extents) {
            this.tiles[level] = this.tiles[level] || [];
            tileData = new Blob([tileData]).slice(2);
            this.tiles[level].push({data: tileData, extents: extents});
        },

        getJnx: function() {
            console.log('making jnx');
            var HEADER_SIZE = 52,
                LEVEL_INFO_SIZE = 17,
                TILE_INFO_SIZE = 28;

            var west = 1e10,
                east= -1e10,
                north = -1e10,
                south = 1e10,
                offset = 0,
                levels_n = Object.keys(this.tiles).length,
                level, tiles, extents,
                i, tile;
            for (level in this.tiles) {
                this.tiles[level].forEach(function(tile) {
                    west = (west < tile.extents.west) ? west : tile.extents.west;
                    east = (east > tile.extents.east) ? east : tile.extents.east;
                    north = (north > tile.extents.north) ? north : tile.extents.north;
                    south = (south < tile.extents.south) ? south: tile.extents.south;
                });
            }
            var stream = new BinStream(1024, true);
            // header
            stream.writeInt32(4); // version
            stream.writeInt32(0); // device id
            extents = jnxCoordinates({south: south, north: north, west: west, east: east});
            stream.writeInt32(extents[0]); // north
            stream.writeInt32(extents[1]); // west
            stream.writeInt32(extents[2]); // south
            stream.writeInt32(extents[3]); // east
            stream.writeInt32(levels_n); // number of zoom levels
            stream.writeInt32(0); //expiration date
            stream.writeInt32(this.productId);
            stream.writeInt32(0); // tiles CRC32
            stream.writeInt32(0); // signature version
            stream.writeUint32(0); // signature offset
            stream.writeInt32(this.zOrder);
            stream.seek(HEADER_SIZE + LEVEL_INFO_SIZE * levels_n);
            // map description
            stream.writeInt32(9); // section version
            stream.writeString('12345678-1234-1234-1234-123456789ABC', true); // GUID
            stream.writeString(this.productName, true);
            stream.writeString('', true);
            stream.writeInt16(this.productId);
            stream.writeString(this.productName, true);
            stream.writeInt32(levels_n);
            // levels descriptions
            for (level in this.tiles) {
                stream.writeString('', true);
                stream.writeString('', true);
                stream.writeString('', true);
                stream.writeInt32(level);
            }
            var tileDescriptorOffset = stream.tell();
            // level info
            var jnxScale;
            stream.seek(HEADER_SIZE);
            for (level in this.tiles) {
                level = parseInt(level, 10);
                stream.writeInt32(this.tiles[level].length);
                stream.writeUint32(tileDescriptorOffset);
                //jnxScale = JnxScales[level + 3];
                jnxScale = 34115555 / (Math.pow(2, level)) * Math.cos((north + south) / 2 / 180 * Math.PI) / 1.1;
                stream.writeInt32(jnxScale);
                stream.writeInt32(2);
                stream.writeUint8(0);
                tileDescriptorOffset += TILE_INFO_SIZE * this.tiles[level].length;
            }
            // tiles descriptors
            stream.seek(stream.size);
            var tileDataOffset = tileDescriptorOffset;
            for (level in this.tiles) {
                tiles = this.tiles[level];
                for (i = 0; i < tiles.length; i++) {
                    tile = tiles[i];
                    extents = jnxCoordinates(tile.extents);
                    stream.writeInt32(extents[0]); // north
                    stream.writeInt32(extents[1]); // west
                    stream.writeInt32(extents[2]); // south
                    stream.writeInt32(extents[3]); // east
                    stream.writeInt16(256); // width
                    stream.writeInt16(256); // height
                    stream.writeInt32(tile.data.size);
                    stream.writeUint32(tileDataOffset);
                    tileDataOffset += tile.data.size;
                }
            }

            var blob = [];
            blob.push(stream.getBuffer());
            for (level in this.tiles) {
                tiles = this.tiles[level];
                for (i = 0; i < tiles.length; i++) {
                    tile = tiles[i];
                    blob.push(tile.data);
                }
            }

            blob.push('BirdsEye');
            console.log('jnx ready');
            return new Blob(blob);
        }
    });

    function getTempMap(width, height, center, zoom) {
        var container = L.DomUtil.create('div', '', document.body);
        container.style.position = 'absolute';
        container.style.left = '20000px';
        container.style.width = width + 'px';
        container.style.height = height + 'px';
        var map = new L.Map(container, {fadeAnimation: false, zoomAnimation: false, inertia: false});
        map.setView(center, zoom, {animate: false});
        return new Promise(
            function(resolve){
                map.whenReady(function(){resolve(map);});
            });
    }

    function disposeMap(map) {
        var container = map.getContainer();
        container.parentNode.removeChild(container);
    }

    function getLayerTiles(layer, width, height, center, zoom) {
        var tmpMap,
            layerCopy;
        return getTempMap(width, height, center, zoom)
        .then(function(tmpMap_) {
            tmpMap = tmpMap_;
            layerCopy = layer.clone();
            tmpMap.addLayer(layerCopy);
            return layerCopy.getTilesInfo();
        })
        .then(function(tiles) {
            disposeMap(tmpMap);
            tiles.forEach(function(tile) {
                var northWest = tmpMap.containerPointToLatLng([tile.left, tile.top]),
                    southEast = tmpMap.containerPointToLatLng([tile.left + tile.width, tile.top + tile.height]);
                tile.south = southEast.lat;
                tile.north = northWest.lat;
                tile.west = northWest.lng;
                tile.east = southEast.lng;
                tile.zoom = zoom;
            });
            return tiles;
        });
    }

    function checkImage(s){
            return  (fileutils.arrayBufferToString(s.slice(0, 4)) == '\x89PNG' &&
                     fileutils.arrayBufferToString(s.slice(-8)) == 'IEND\xae\x42\x60\x82') ||
                    (fileutils.arrayBufferToString(s.slice(0, 2)) == '\xff\xd8' &&
                     fileutils.arrayBufferToString(s.slice(-2)) == '\xff\xd9');
        }

    function convertToJpeg(s) {
        var dataUrl = 'data:image/png;base64,' + btoa(fileutils.arrayBufferToString(s));
        var image = new Image();
        return new Promise(function(resolve, reject) {
            image.onload = resolve.bind(null, image);
            image.onerror = reject.bind(null, 'Tile image corrupt');
            image.src = dataUrl;
        }).then(function(img) {
            var canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            var ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);
            var dataURL = canvas.toDataURL("image/jpeg");
            s = atob(dataURL.replace(/^data:image\/(png|jpg|jpeg);base64,/, ""));
            var ar = new Uint8Array(s.length);
            for (var i = 0;  i < s.length; i++) {
                ar[i] = s.charCodeAt(i);
            }
            return ar;
        });

    }

    function layerToJnx(layer, layerName, map, bounds, zoomLevels, jnxProductId, zOrder, setProgressRange, incProgress) {
        var zoomLevel,
            topLeft, bottomRight, x1, y1, x2, y2, center,
            jnx = new JnxWriter(layerName, jnxProductId, zOrder),
            tiles = {}, q;
        var regionsN = 0;
        setProgressRange(undefined);
        bounds = L.latLngBounds(bounds);

        function processTile(tile) {
            var url = layer.options.noCors ? urlViaCorsProxy(tile.url) : tile.url;
            return fileutils.get(url, {
                responseType: 'arraybuffer',
                maxTries: 3,
                isResponseSuccessful: function(xhr) {
                    return (xhr.status == 200 && checkImage(xhr.response)) || xhr.status == 404;
                },
                shouldRetry: function(xhr) {
                    return xhr.status < 400 || xhr.status >= 500;
                }
            }).then(function(xhr) {
                var imageData;
                if (xhr.response && xhr.status == 200) {
                    if (fileutils.arrayBufferToString(xhr.response.slice(0, 2)) == '\xff\xd8') {
                        imageData = Promise.resolve(xhr.response);
                    } else {
                        imageData = convertToJpeg(xhr.response);
                    }
                    return imageData;
                }
            }).then(function(imageData) {
                if (imageData) {
                    jnx.addTile(imageData, tile.zoom, tile);
                }
            });
        }

        q = Promise.resolve(null);
        for (var i=0; i < zoomLevels.length; i++) {
            zoomLevel = zoomLevels[i];
            topLeft = map.project(bounds.getNorthWest(), zoomLevel);
            bottomRight = map.project(bounds.getSouthEast(), zoomLevel);
            y2 = y1 = topLeft.y;
            while (y2 < bottomRight.y) {
                y2 = Math.min(bottomRight.y, y1 + MAX_MAP_SIZE);
                x2 = x1 = topLeft.x;
                while (x2 < bottomRight.x) {
                    var tmpMap;
                    x2 = Math.min(bottomRight.x, x1 + MAX_MAP_SIZE);
                    center = [(x1 + x2) / 2, (y1 + y2) / 2];
                    center = map.unproject(center, zoomLevel);
                    regionsN += 1;
                    q = q.then(getLayerTiles.bind(null, layer, x2 - x1, y2 - y1, center, zoomLevel))
                        .then(function(fragmentTiles) {
                            fragmentTiles.forEach(function(tile) {
                                tiles[tile.url] = tile;
                            });
                            incProgress(1 / regionsN * 0.75);
                        });
                    x1 = x2;
                }
                y1 = y2;
            }

        }
        console.log('Collecting tile urls in regions: ', regionsN);
        setProgressRange(1);
        return q.then(function() {
            tiles = Object.keys(tiles).map(function(url) {
                return processTile(tiles[url]).
                    then(function() {
                        incProgress(1 / tiles.length * 0.25);
                    });
            });
            console.log('Collected all tiles: ', tiles.length);
        }).then(function() {
            return Promise.all(tiles).then(jnx.getJnx.bind(jnx));
        });
    }

    L.RectangleSelect.include(L.Mixin.Contextmenu);

    L.Control.JNX = L.Control.extend({
        includes: [L.Mixin.Events, L.Mixin.HashState],
        stateChangeEvents: ['selectionchange'],

        options: {
            position: 'bottomleft',
        },

        initialize: function(options) {
            L.Control.prototype.initialize.call(this, options);
            this.makingJnx = ko.observable(false);
            this.downloadProgressRange = ko.observable();
            this.downloadProgressDone = ko.observable();
        },

        onAdd: function(map) {
            this._map = map;
            var container = this._container = L.DomUtil.create('div', 'leaflet-control leaflet-control-jnx');
            container.innerHTML = (
                '<a class="button" data-bind="visible: !makingJnx(), click: onButtonClicked">JNX</a>' +
                '<div data-bind="component: ' +
                    '{name: \'progress-indicator\',' +
                    'params: {progressRange: downloadProgressRange, progressDone: downloadProgressDone}}, ' +
                    'visible: makingJnx()"></div>'
            );
            ko.applyBindings(this, container);
            if (!L.Browser.touch) {
                L.DomEvent
                    .disableClickPropagation(container)
                    .disableScrollPropagation(container);
            } else {
                L.DomEvent.on(container, 'click', L.DomEvent.stopPropagation);
            }
            return container;
        },

        makeSelector: function(bounds) {
            var self = this;
            this._selector = new L.RectangleSelect(bounds)
                    .addTo(this._map);
                this._selector.on('change', function() {
                    this.fire('selectionchange');
                }, this);
                var items = function() {
                    if (self.makingJnx()) {
                        return [];
                    }
                    var items = [{text: '<b>' + self.sourceLayerName + '</b>'}];
                    var maxZoom = self.sourceLayer.options.maxNativeZoom || self.sourceLayer.options.maxZoom || 18;
                    var zoom = maxZoom;
                    var bounds = self._selector.getBounds();
                    var lat = bounds.getCenter().lat;
                    var resolution = 156543.0339 / Math.pow(2, maxZoom) * Math.cos(lat / 180 * Math.PI);
                    var topLeft, bottomRight, x1, x2, y1, y2, tilesN;
                    while (zoom >= 0 && zoom >= maxZoom - 6) {
                        topLeft = self._map.project(bounds.getNorthWest(), zoom);
                        bottomRight = self._map.project(bounds.getSouthEast(), zoom);
                        x1 = Math.floor(topLeft.x / 256);
                        y1 = Math.floor(topLeft.y / 256);
                        x2 = Math.ceil(bottomRight.x / 256);
                        y2 = Math.ceil(bottomRight.y / 256);
                        tilesN = Math.ceil((x2 - x1) * (y2 - y1) * 4 / 3);

                        items.push({
                            //text: 'Zoom ' + zoom + ', ' + resolution.toFixed(2) + ' m/pixel, ' + ,
                            text: L.Util.template('Zoom {zoom} ({res} m/pixel) &mdash; {n} tiles (~{size} Mb)', {
                                zoom: zoom,
                                res: resolution.toFixed(2),
                                n: tilesN,
                                size: (tilesN * 0.02).toFixed(1)
                            }),
                            callback: self.makeJnx.bind(self, zoom)
                        });
                        zoom -= 1;
                        resolution *= 2;
                    }
                    return items;
                };
                this._selector.bindContextmenu(items);
                this.fire('selectionchange');
        },

        onButtonClicked: function() {
            if (this._selector) {
                if (this._selector.getBounds().intersects(this._map.getBounds().pad(-0.05))) {
                    this._map.removeLayer(this._selector);
                    this._selector = null;
                    this.fire('selectionchange');
                } else {
                    this._selector.setBounds(this._map.getBounds().pad(-0.25));
                }

            } else {
                this.makeSelector(this._map.getBounds().pad(-0.25));
            }
            
        },

        setSourceLayer: function(layer, layerName, layerUid) {
            this.sourceLayer = layer;
            this.sourceLayerName = layerName;
            this.jnxProductId = layerUid;
        },

        makeJnx: function(maxZoom) {
            var self = this;
            this.makingJnx(true);
            var layer = this.sourceLayer;
            var zooms = [maxZoom];
            var zoom = maxZoom - 1;
            while (zoom > 0 && zooms.length < 5) {
                zooms.push(zoom);
                zoom -= 1;
            }
            var region = this._selector.getBounds();
            self.downloadProgressDone(0);
            var incProgress = function(d) {self.downloadProgressDone(self.downloadProgressDone() + d);};
            var filename = 'nakarte.tk_' + this.sourceLayerName.toLowerCase().replace(/[ ()]+/, '_') + '.jnx';
            var zOrder = 30 + this.jnxProductId;
            layerToJnx(layer, this.sourceLayerName, this._map, region, zooms, this.jnxProductId, zOrder, this.downloadProgressRange, incProgress)
                .then(function (jnxData) {
                    console.log('saving');
                    saveAs(jnxData, filename);
                    self.makingJnx(false);
                }).then(null, function(err) {
                    self.makingJnx(false);
                    alert('Failed to make JNX file: ' + err);
                });

        },

        _serializeState: function() {
            var state;
            if (this._selector) {
                var bounds = this._selector.getBounds();
                state = [
                    bounds.getSouth().toFixed(5),
                    bounds.getWest().toFixed(5),
                    bounds.getNorth().toFixed(5),
                    bounds.getEast().toFixed(5)];
            } else {
                state = [];
            }
            return state;
        },

        _unserializeState: function(values) {
            function validateFloat(value, min, max) {
                value = parseFloat(value);
                if (isNaN(value) || value < min || value > max) {
                    throw 'INVALID VALUE';
                }
                return value;
            }

            if (values) {
                try {
                    var south = validateFloat(values[0], -86, 86),
                        west = validateFloat(values[1], -180, 180),
                        north = validateFloat(values[2], -86, 86),
                        east = validateFloat(values[3], -180, 180);
                } catch (e) {
                    if (e == 'INVALID VALUE') {
                        return false;
                    }
                    throw e;
                }
                this.makeSelector([[south, west], [north, east]]);
                return true;
            } else {
                return false;
            }
            return true;
        }

    });
})();