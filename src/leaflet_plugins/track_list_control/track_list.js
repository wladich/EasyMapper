//@require track_list.css
//@require leaflet
//@require fileutils
//@require knockout
//@require lib/geo_file_formats.js
//@require leaflet.contextmenu

(function() {
    "use strict";
    L.Control.TrackList = L.Control.extend({
        options: {position: 'topright'},

        colors: ['#77f', '#f95', '#0ff', '#f77', '#f7f', '#ee5'],

        
        initialize: function() {
            L.Control.prototype.initialize.call(this);
            this.tracks = ko.observableArray();
            this.url = ko.observable('');
        },

        onAdd: function(map){
            this.map = map;
            this.tracks.removeAll();
            var container = L.DomUtil.create('div', 'leaflet-control leaflet-control-tracklist');
            container.innerHTML = (
                '<div class="hint">' +
                    'GPX Ozi GoogleEarth ZIP YandexMaps' +
                '</div>' +
                '<div class="inputs-row">' +
                    '<a class="button open-file" title="Open file" data-bind="click: loadFilesFromDisk"></a>' +
                    '<input type="text" class="input-url" placeholder="Track URL" data-bind="value: url">' +
                    '<a class="button download-url" title="Download URL" data-bind="click: loadFilesFromUrl"></a>' +
                '</div>' +
                '<!-- ko foreach: {data: tracks, as: "track"} -->' +
                    '<div class="track-item">' +
                        '<input type="checkbox" class="visibility-switch" data-bind="checked: track.visible">' +
                        '<div class="color-sample" data-bind="style: {backgroundColor: $parent.colors[track.color()]}, click: $parent.onColorSelectorClicked.bind($parent)"></div>' +
                        '<span class="track-name" data-bind="text: track.name, attr: {title: track.name}, click: $parent.setViewToTrack.bind($parent)"></span>' +
                        '<a class="delete-button" title="Remove track" data-bind="click: $parent.removeTrack.bind($parent)">X</a>' +
                    '</div>' +
                '<!-- /ko -->'

             );

            L.DomEvent.disableClickPropagation(container);
            ko.applyBindings(this, container);
            return container;
            
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
            var track = {
                name: geodata.name,
                feature: L.featureGroup(geodata.tracks.map(L.polyline)),
                color: ko.observable(this._lastTrackColor),
                visible: ko.observable(true)
            };
            this.tracks.push(track);
            track.visible.subscribe(this.onTrackVisibilityChanged.bind(this, track));
            track.color.subscribe(this.onTrackColorChanged.bind(this, track));
            this.onTrackColorChanged(track);
            this.onTrackVisibilityChanged(track);
            this.attachColorSelector(track);
        },

        removeTrack: function(track) {
            track.visible(false);
            this.tracks.remove(track);
        }


    });


})();