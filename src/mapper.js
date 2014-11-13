//@require leaflet
//@require layers.js
//@require leaflet.hash_state.Map
//@require leaflet.hash_state.Control.Layers
//@require leaflet.layers_control.hotkeys
//@require leaflet.track_list
//@require leaflet.print_pages
//@require lib/draw_utils.js
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
            this._printDpi = this.printPagesControl.printResolution();
            this._tracksForPrint = this.trackList.exportTracks(1.5 * this.printPagesControl.mapScale());
        },

        setupMap: function(mapContainer) {
            var map = this._map = L.map(mapContainer, {fadeAnimation: false, attributionControl: false});
            var baseMaps = layers.getBaseMaps();
            var layersControl = L.control.layers(baseMaps, layers.getOverlays(), {collapsed: false, hotkeys: true})
                .addTo(map);
            layersControl.enableHashState('l', ['O']);
            map.enableHashState('m', [10, 55.7, 37.5]);
            this.printPagesControl = new L.Control.PrintPages({postprocess: this.postprocessPage.bind(this)})
                .addTo(map);
            this.printPagesControl.enableHashState('p');
            this.trackList = new L.Control.TrackList()
                .addTo(map);

            this.printPagesControl.on('pdfstart', this.beforePdfBuild, this);
        }

    });

    window.mapperApp = mapperApp;
}).call();