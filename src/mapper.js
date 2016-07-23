//@require leaflet
//@require layers.js
//@require leaflet.hash_state.Map
//@require leaflet.hash_state.Control.Layers
//@require leaflet.layers_control.hotkeys
//@require leaflet.track_list
//@require leaflet.track_list_hash_state
//@require leaflet.print_pages
//@require lib/draw_utils.js
//@require leaflet.buttons
//@require leaflet.jnx
//@require leaflet.layers_control.custom_layers
//@require leaflet.coordinates

(function(){
    "use strict";

    var mapperApp = L.Class.extend({
        trackPrintColors: ['#77f', '#f95', '#0ff', '#f77', '#f7f', '#ee5'],
        trackPrintWidth: 1,

        initialize: function(mapContainer) {
            this.setupMap(mapContainer);
        },

        postprocessPage: function(index, bounds, canvas) {
            var projectedTopLeft = this._map.project(bounds.getNorthWest(), 24),
                projectedBottomRight = this._map.project(bounds.getSouthEast(), 24),
                scale = (projectedBottomRight.x - projectedTopLeft.x) / canvas.width,
                self = this;

            var latlngToPagePixel = function(latLng) {
                var projected = self._map.project(latLng, 24);
                return [(projected.x - projectedTopLeft.x) / scale, (projected.y - projectedTopLeft.y) / scale];
            };

            var lines = [];
            this._tracksForPrint.forEach(function(track) {
                if (track.visible && bounds.intersects(track.bounds)) {
                    track.segments.forEach(function(segment) {
                        lines.push({
                            points: segment.map(latlngToPagePixel),
                            color: self.trackPrintColors[track.color],
                            ticks: track.measureTicksShown ? track.measureTicks.map(function(tick) {
                                return {
                                    label: '\u2014 ' + Math.round((tick.distanceValue / 10)) / 100 + ' km',
                                    position: latlngToPagePixel(tick.position),
                                    transformMatrix: tick.transformMatrix
                                };
                            }) : []
                        });
                    });
                }
            });
            var lineWidthPixels = this.trackPrintWidth / 25.4 * this._printDpi;
            var ticksPixelSize = 2.5 / 25.4 * this._printDpi;

            drawLinesOnCanvas(canvas, lines, lineWidthPixels, ticksPixelSize);
        },

        beforePdfBuild: function() {
            this.trackList.stopActiveDraw();
            this._printDpi = this.printPagesControl.printResolution();
            this._tracksForPrint = this.trackList.exportTracks(1.5 * this.printPagesControl.mapScale());
        },

        startRuler: function() {
            this.trackList.addNewTrack('Ruler').measureTicksShown(true);
        },

        updateJnxLayer: function() {
            var layers = this._map._layers,
                layerId, layer, name;
            var layersIds = Object.keys(layers).sort();
            for (var i = layersIds.length - 1; i >= 0; i--) {
                layerId = layersIds[i];
                if (layers[layerId].options && layers[layerId].options.jnx) {
                    break;
                }
            }
            if (i < 0) {
                this.jnx.setSourceLayer(null);
                return;
            }
            layerId = layersIds[i];
            layer = layers[layerId];
            layers = this.layersControl._layers;
            for (layerId in layers) {
                if (layers[layerId].layer == layer) {
                    name = layers[layerId].name;
                    break;
                }
            }
            this.jnx.setSourceLayer(layer, name, L.Util.stamp(layer));
        },

        setupMap: function(mapContainer) {
            var map = this._map = L.map(mapContainer, {fadeAnimation: false, attributionControl: false});
            map.enableHashState('m', [10, 55.7, 37.5]);

            var baseMaps = layers.getBaseMaps();
            this.layersControl = L.control.layers(baseMaps, layers.getOverlays(), {collapsed: false, hotkeys: true})
                .addTo(map);

            this.printPagesControl = new L.Control.PrintPages({postprocess: this.postprocessPage.bind(this)})
                .addTo(map);
            this.jnx = new L.Control.JNX();
            this.jnx.addTo(map);
            this.trackList = new L.Control.TrackList()
                .addTo(map);
            var btn = L.functionButtons([{content: '<div title="Measure distance" class="leaflet-mapper-button-ruler"></div>'}], {position: 'topleft'})
                .addTo(map);

            this.layersControl.loadCustomLayers();
            this.layersControl.enableHashState('l', ['O']);

            this.printPagesControl.enableHashState('p');
            this.jnx.enableHashState('j');
            if (!window.location.href.match(/[&#]nktk=/)) {
                this.loadTracksFromStorage();
            }
            this.trackList.enableHashState('nktk');
            window.onbeforeunload = this.saveTracksToStorage.bind(this);


            btn.on('clicked', this.startRuler, this);
            map.on('baselayerchange overlayadd overlayremove', function () {
                setTimeout(this.updateJnxLayer.bind(this), 0);
            }, this);
            this.printPagesControl.on('pdfstart', this.beforePdfBuild, this);
            this.updateJnxLayer();
            this.coordinatesControl = new L.Control.Coordinates().addTo(map);
            //FIXME: remove after migratirng to leaflet 1.0
            L.DomEvent.on(document, 'keydown', function(e) {
                var key = e.keyCode;
                if (key === 27) {
                    map.closePopup();
                }
            })
        },

        loadTracksFromStorage: function() {
            if (!(window.Storage && window.localStorage)) {
                return;
            }
            var i, key, m, s,
                geodata,
                maxKey = -1;

            for (i = 0; i < localStorage.length; i++) {
                key = localStorage.key(i);
                m = key.match(/^trackList_(\d+)$/);
                if (m && m[1] !== undefined) {
                    if (+m[1] > maxKey) {
                        maxKey = +m[1];
                    }
                }
            }
            if (maxKey > -1) {
                key = 'trackList_' + maxKey;
                s = localStorage.getItem(key);
                localStorage.removeItem(key);
                if (s) {
                    geodata = parseGeoFile('', s);
                    this.trackList.addTracksFromGeodataArray(geodata);
                }
            }
        },

        saveTracksToStorage: function() {
            var maxSessions = 10;
            if (!(window.Storage && window.localStorage)) {
                return;
            }
            var tracks = this.trackList.tracks(),
                serialized = [],
                maxKey = -1,
                i, track, s, key, m, keys = [];

            for (i = 0; i < localStorage.length; i++) {
                key = localStorage.key(i);
                m = key.match(/^trackList_(\d+)$/);
                if (m && m[1] !== undefined) {
                    if (+m[1] > maxKey) {
                        maxKey = +m[1];
                    }
                }
            }
            key = 'trackList_' + (maxKey + 1);

            if (tracks.length === 0) {
                localStorage.setItem(key, '');
                return;
            }
            for (i = 0; i < tracks.length; i++) {
                track = tracks[i];
                s = this.trackList.trackToString(track);
                serialized.push(s);
            }
            if (serialized.length === 0) {
                return;
            }
            s = '#nktk=' + serialized.join('/');

            localStorage.setItem(key, s);

            //cleanup stale records
            for (i = 0; i < localStorage.length; i++) {
                key = localStorage.key(i);
                m = key.match(/^trackList_(\d+)$/);
                if (m && m[1] !== undefined) {
                    keys.push(+m[1]);
                }
            }
            if (keys.length > maxSessions) {
                keys.sort(function(a, b) {return a - b});
                for (i = 0; i < keys.length - maxSessions; i++) {
                    key = 'trackList_' + keys[i];
                    localStorage.removeItem(key);
                }
            }

        }

    });

    window.mapperApp = mapperApp;
}).call();