//@require track_list.css
//@require leaflet
//@require fileutils
//@require knockout
//@require lib/geo_file_formats.js
//@require leaflet.contextmenu
//@require knockout.progress
//@require leaflet.measured_line

(function() {
    "use strict";
    L.Control.TrackList = L.Control.extend({
        options: {position: 'bottomright'},

        colors: ['#77f', '#f95', '#0ff', '#f77', '#f7f', '#ee5'],

        
        initialize: function() {
            L.Control.prototype.initialize.call(this);
            this.tracks = ko.observableArray();
            this.url = ko.observable('');
            this.readingFiles = ko.observable(false);
            this.readProgressRange = ko.observable(10);
            this.readProgressDone = ko.observable(2);
        },

        onAdd: function(map){
            this.map = map;
            this.tracks.removeAll();
            var container = L.DomUtil.create('div', 'leaflet-control leaflet-control-tracklist');
            container.innerHTML = (
                '<div class="hint">' +
                    'GPX Ozi GoogleEarth ZIP YandexMaps' +
                '</div>' +
                '<div class="inputs-row" data-bind="visible: !readingFiles()">' +
                    '<a class="button open-file" title="Open file" data-bind="click: loadFilesFromDisk"></a>' +
                    '<input type="text" class="input-url" placeholder="Track URL" data-bind="textInput: url, event: {keypress: onEnterPressedInInput}">' +
                    '<a class="button download-url" title="Download URL" data-bind="click: loadFilesFromUrl"></a>' +
                '</div>' +
                '<div style="text-align: center"><div data-bind="' +
                    'component: {' +
                        'name: \'progress-indicator\',' +
                        'params: {progressRange: readProgressRange, progressDone: readProgressDone}' +
                    '},' +
                    'visible: readingFiles"></div>' +
                '</div>' +
                '<table class="tracks-rows" data-bind="foreach: {data: tracks, as: \'track\'}">' +
                    '<tr>' +
                        '<td><input type="checkbox" class="visibility-switch" data-bind="checked: track.visible"></td>' +
                        '<td><div class="color-sample" data-bind="style: {backgroundColor: $parent.colors[track.color()]}, click: $parent.onColorSelectorClicked.bind($parent)"></div></td>' +
                        '<td><div class="track-name-wrapper"><div class="track-name" data-bind="text: track.name, attr: {title: track.name}, click: $parent.setViewToTrack.bind($parent)"></div></div></td>' +
                        '<td><div class="button-length" data-bind="text: track.length, css: {\'ticks-enabled\': track.measureTicksShown}, click: $parent.setTrackMeasureTicksVisibility.bind($parent)"></div></td>' +
                        '<td><a class="track-text-button" title="Remove track" data-bind="click: $parent.removeTrack.bind($parent)">X</a></td>' +
                    '</tr>' +
                '</table>'
             );

            L.DomEvent.disableClickPropagation(container);
            ko.applyBindings(this, container);
            return container;
            
        },

        onEnterPressedInInput: function(this_, e) {
            if (e.charCode == 13) {
                this_.loadFilesFromUrl();
            } else {
                return true;
            }
        },

        loadFilesFromDisk: function() {
            fileutils.openFiles(true).then(function(files) {
                return files.map(function(file) {
                    return parseGeoFile(file.filename, file.data);
                }).reduce(function(prev, next) {
                    Array.prototype.push.apply(prev, next);
                    return prev;
                }, []);
            }).done(this.addTracksFromGeodataArray.bind(this));
        },

        loadFilesFromUrl: function() {
            var url = this.url().trim();
            var geodata;
            if (url.length > 0) {
                this.readingFiles(true);
                this.readProgressDone(undefined);
                this.readProgressRange(1);
                geodata = parseGeoFile('', url);
                if (geodata.length > 1 || geodata[0].error != 'UNSUPPORTED') {
                    this.addTracksFromGeodataArray(geodata);
                } else {
                    // FIXME: error if https and using proxy and with other schemas
                    var url_for_request = urlViaCorsProxy(url);
                    var name = url
                               .split('#')[0]
                               .split('?')[0]
                               .replace(/\/*$/, '')
                               .split('/')
                               .pop();
                    fileutils.get(url_for_request, {responseType: 'binarystring'})
                    .done(function(xhr) {
                        var geodata = parseGeoFile(name, xhr.responseBytes);
                        this.addTracksFromGeodataArray(geodata);
                    }.bind(this),
                    function() {
                        var geodata = [{name: url, error: 'NETWORK'}];
                        this.addTracksFromGeodataArray(geodata);
                    }.bind(this));
                }
            }
            this.url('');
        },

        addTracksFromGeodataArray: function(geodata_array) {
            var messages = [];
            geodata_array.forEach(function(geodata) {
                var data_empty = !((geodata.tracks  && geodata.tracks.length) || (geodata.points && geodata.points.length));
                
                if (!data_empty) {
                    this.addTrack(geodata);
                }

                var error_messages = {
                    'CORRUPT': 'File "{name}" is corrupt',
                    'UNSUPPORTED': 'File "{name}" has unsupported format or is badly corrupt',
                    'NETWORK': 'Could not download file from url "{name}"'
                };
                var message;
                if (geodata.error) {
                    message = error_messages[geodata.error] || geodata.error;
                    if (data_empty) {
                        message += ', no data could be loaded';
                    } else {
                        message += ', loaded data can be invalid or incomplete';
                    }
                } else if (data_empty) {
                    message = 'File "{name}" contains no data';
                }
                if (message) {
                    message = L.Util.template(message, {name: geodata.name});
                    messages.push(message);
                }
            }.bind(this));
            this.readingFiles(false);
            if (messages.length) {
                alert(messages.join('\n'));
            }
        },


        onTrackColorChanged: function(track) {
            var color = this.colors[track.color()];
            track.feature.getLayers().forEach(
                function(polyline) {
                    polyline.setStyle({color: color});
                });
        },

        onTrackVisibilityChanged: function(track) {
            if (track.visible()) {
                this.map.addLayer(track.feature);
            } else {
                this.map.removeLayer(track.feature);
            }
        },

        onTrackLengthChanged: function(track) {
            var lines = track.feature.getLayers(),
                length = 0;
            for (var i in lines) {
                length += lines[i].getLength();
            }
            if (length < 10000) {
                length = Math.round(length / 10) / 100;
            } else if (length < 100000) {
                length = Math.round(length / 100) / 10;
            } else {
                length = Math.round(length / 1000);
            }
            track.length(length + ' km');
        },

        setTrackMeasureTicksVisibility: function(track) {
            track.measureTicksShown(!track.measureTicksShown());
            var lines = track.feature.getLayers();
            for (var i in lines) {
                lines[i].setMeasureTicksVisible(track.measureTicksShown());
            }
        },

        onColorSelectorClicked: function(track, e) {
            track._contextmenu.showOnMouseEvent(e);
        },

        setViewToTrack: function(track) {
            this.map.fitBounds(track.feature.getBounds());
        },

        attachColorSelector: function(track) {
            var items = this.colors.map(function(color, index) {
                return {
                    //text: '<div style="display: inline-block; vertical-align: middle; width: 50px; height: 4px; background-color: ' + color + '"></div>',
                    text: '<div style="display: inline-block; vertical-align: middle; width: 50px; height: 0; border-top: 4px solid ' + color + '"></div>',
                    callback: track.color.bind(null, index)
                };
            }.bind(this));
            track._contextmenu = new L.Contextmenu(items);
        },

        addTrack: function(geodata) {
            this._lastTrackColor = ((this._lastTrackColor | 0) + 1) % this.colors.length;
            var polylines = [];
            for (var i in geodata.tracks) {
                var points = geodata.tracks[i],
                    polyline = L.measuredLine(points);
                polyline.on('lengthchanged', this.onTrackLengthChanged, this);
                polylines.push(polyline);
            }

            var track = {
                name: geodata.name,
                feature: L.featureGroup(polylines),
                color: ko.observable(this._lastTrackColor),
                visible: ko.observable(true),
                length: ko.observable('empty'),
                measureTicksShown: ko.observable(false)
            };
            this.tracks.push(track);
            track.visible.subscribe(this.onTrackVisibilityChanged.bind(this, track));
            track.color.subscribe(this.onTrackColorChanged.bind(this, track));
            this.onTrackColorChanged(track);
            this.onTrackVisibilityChanged(track);
            this.attachColorSelector(track);
            this.onTrackLengthChanged(track);
        },

        removeTrack: function(track) {
            track.visible(false);
            this.tracks.remove(track);
        },

        exportTracks: function(minTicksIntervalMeters) {
            return this.tracks().map(function(track) {
                var capturedTrack = track.feature.getLayers().map(function(pl) {
                        return pl.getLatLngs().map(function(ll) {
                            return [ll.lat, ll.lng];
                        });
                    });
                var bounds = track.feature.getBounds();
                var capturedBounds = [[bounds.getSouth(), bounds.getWest()], [bounds.getNorth(), bounds.getEast()]];
                return {
                    color: track.color(),
                    visible: track.visible(),
                    segments: capturedTrack,
                    bounds: capturedBounds,
                    measureTicksShown: track.measureTicksShown(),
                    measureTicks: [].concat.apply([], track.feature.getLayers().map(function(pl) {
                       return pl.getTicksPositions(minTicksIntervalMeters);
                    }))
                };
            });
        },

    });


})();