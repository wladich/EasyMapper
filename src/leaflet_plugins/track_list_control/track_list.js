//@require track_list.css
//@require leaflet
//@require fileutils
//@require knockout
//@require lib/geo_file_formats.js
//@require lib/geo_file_exporters.js
//@require leaflet.contextmenu
//@require knockout.progress
//@require leaflet.measured_line
//@require leaflet.edit_line
//@require leaflet.simplify_latlngs

(function() {
    "use strict";

    var MeasuredEditableLine = L.MeasuredLine.extend({});
    MeasuredEditableLine.include(L.Polyline.EditMixin);

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
            this._lastTrackColor = 0;
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
                    '<a class="button add-track" title="New track" data-bind="click: function(){this.addNewTrack()}"></a>' +
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
                    '<tr data-bind="event: {contextmenu: $parent.showTrackMenu.bind($parent)}">' +
                        '<td><input type="checkbox" class="visibility-switch" data-bind="checked: track.visible"></td>' +
                        '<td><div class="color-sample" data-bind="style: {backgroundColor: $parent.colors[track.color()]}, click: $parent.onColorSelectorClicked.bind($parent)"></div></td>' +
                        '<td><div class="track-name-wrapper"><div class="track-name" data-bind="text: track.name, attr: {title: track.name}, click: $parent.setViewToTrack.bind($parent)"></div></div></td>' +
                        '<td><div class="button-length" data-bind="text: track.length, css: {\'ticks-enabled\': track.measureTicksShown}, click: $parent.switchMeasureTicksVisibility.bind($parent)"></div></td>' +
                        '<td><a class="track-text-button" title="Actions" data-bind="click: $parent.showTrackMenu.bind($parent)">&hellip;</a></td>' +
                    '</tr>' +
                '</table>'
             );

            L.DomEvent.disableClickPropagation(container);
            ko.applyBindings(this, container);
            // FIXME: add onRemove method and unsubscribe
            L.DomEvent.addListener(map.getContainer(), 'drop', this.onFileDragDrop, this);
            L.DomEvent.addListener(map.getContainer(), 'dragover', this.onFileDraging, this);
            return container;
        },

        onFileDraging: function(e) {
            L.DomEvent.stopPropagation(e);
            L.DomEvent.preventDefault(e);
            e.dataTransfer.dropEffect = 'copy';
        },

        onFileDragDrop: function(e) {
            L.DomEvent.stopPropagation(e);
            L.DomEvent.preventDefault(e);
            this.loadFilesFromFilesObject(e.dataTransfer.files);
        },

        onEnterPressedInInput: function(this_, e) {
            if (e.keyCode == 13) {
                this_.loadFilesFromUrl();
            } else {
                return true;
            }
        },

        addNewTrack: function(name) {
            if (!name) {
                name = this.url().slice(0, 50);
                if (!name.length) {
                    name = 'New track';
                } else {
                    this.url('');
                }
            }
            var track = this.addTrack({name: name}),
                line = this.addTrackSegment(track);
            this.startEditTrackSegement(track, line);
            line.startDrawingLine();
            return track;
        },

        loadFilesFromFilesObject: function(files) {
            fileutils.readFiles(files).done(function(fileDataArray) {
                var geodataArray = fileDataArray.map(function(fileData) {
                    return parseGeoFile(fileData.filename, fileData.data);
                }).reduce(function(prev, next) {
                    Array.prototype.push.apply(prev, next);
                    return prev;
                }, []);
                this.addTracksFromGeodataArray(geodataArray);
            }.bind(this));
        },

        loadFilesFromDisk: function() {
            fileutils.openFiles(true).done(this.loadFilesFromFilesObject.bind(this));
        },

        loadFilesFromUrl: function() {
            var url = this.url().trim();
            try {
                url = decodeURIComponent(url);
            } catch (e) {}
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
                    geodata.tracks = geodata.tracks.map(function(line) {
                        return L.LineUtil.simplifyLatlngs(line, 360 / (1<<24));
                    });
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
            var visible = track.measureTicksShown(),
                lines = track.feature.getLayers();
            for (var i in lines) {
                lines[i].setMeasureTicksVisible(visible);
            }
        },

        switchMeasureTicksVisibility: function(track) {
            track.measureTicksShown(!(track.measureTicksShown()));
        },

        onColorSelectorClicked: function(track, e) {
            track._contextmenu.showOnMouseEvent(e);
        },

        setViewToTrack: function(track) {
            if (track.feature.getLayers().length) {
                this.map.fitBounds(track.feature.getBounds());
            }
        },

        attachColorSelector: function(track) {
            var items = this.colors.map(function(color, index) {
                return {
                    text: '<div style="display: inline-block; vertical-align: middle; width: 50px; height: 0; border-top: 4px solid ' + color + '"></div>',
                    callback: track.color.bind(null, index)
                };
            }.bind(this));
            track._contextmenu = new L.Contextmenu(items);
        },

        attachActionsMenu: function(track) {
            var items = [
                function() {return {text: track.name(), disabled: true};},
                '-',
                {text: 'Delete', callback: this.removeTrack.bind(this, track)},
                {text: 'Add segment', callback: function() {
                    var polyline = this.addTrackSegment(track, []);
                    this.startEditTrackSegement(track, polyline);
                    polyline.startDrawingLine(1);
                }.bind(this)},
                {text: 'Rename', callback: this.renameTrack.bind(this, track)},
                {text: 'Duplicate', callback: this.duplicateTrack.bind(this, track)},
                {text: 'Reverse', callback: this.reverseTrack.bind(this, track)},
                '-',
                {text: 'Download GPX', callback: this.saveTrackAsFile.bind(this, track, geoExporters.saveGpx, '.gpx')},
                {text: 'Download KML', callback: this.saveTrackAsFile.bind(this, track, geoExporters.saveKml, '.kml')},
                {text: 'Copy link to clipboard', callback: this.copyLinkToClipboard.bind(this, track)},
            ];
            track._actionsMenu = new L.Contextmenu(items);
        },
        
        duplicateTrack: function(track) {
            var segments = [], segment,
                line,
                lines = track.feature.getLayers();
            for (var i = 0; i < lines.length; i++) {
                segment = [];
                line = lines[i].getLatLngs();
                for (var j = 0; j < line.length; j++) {
                    segment.push([line[j].lat, line[j].lng]);
                }
                segments.push(segment);
            }
            this.addTrack({name: track.name(), tracks: segments});
        },

        reverseTrackSegment: function(trackSegment) {
            trackSegment.stopDrawingLine();
            var latlngs = trackSegment.getLatLngs();
            latlngs = latlngs.map(function(ll) {
                return [ll.lat, ll.lng];
            });
            latlngs.reverse();
            var isEdited = (this._editedLine === trackSegment);
            this.deleteTrackSegment(trackSegment);
            var newTrackSegment = this.addTrackSegment(trackSegment._parentTrack, latlngs);
            if (isEdited) {
                this.startEditTrackSegement(trackSegment._parentTrack, newTrackSegment);
            }
        },

        reverseTrack: function(track) {
            var self = this;
            track.feature.getLayers().forEach(function(trackSegment) {
                self.reverseTrackSegment(trackSegment);
            });
        },

        copyLinkToClipboard: function(track) {
            this.stopActiveDraw();
            var lines = track.feature.getLayers()
                .map(function(line) {
                    var points = line.getLatLngs();
                    points = L.LineUtil.simplifyLatlngs(points, 360 / (1<<24));
                    return points;
                });
            var s = geoExporters.saveToString(lines, track.name(), track.color(), track.measureTicksShown());
            var url = window.location + '&nktk=' + s;
            if (!s) {
                alert('Track is empty, nothing to save');
                return;
            }
            fileutils.copyToClipboard(url);
        },

        saveTrackAsFile: function(track, exporter, extension) {
            this.stopActiveDraw();
            var lines = track.feature.getLayers()
                .map(function(line) {
                    return line.getLatLngs();
                });
            var name = track.name(),
                i = name.lastIndexOf('.');
            if (i > -1 && i >= name.length - 5) {
                name = name.slice(0, i);
            }

            var fileText = exporter(lines, name);
            if (!fileText) {
                alert('Track is empty, nothing to save');
                return;
            }
            var filename = name + extension;
            fileutils.saveStringToFile(filename, 'application/download', fileText);
          },

        renameTrack: function(track) {
            var newName = prompt('Enter new name', track.name());
            if (newName && newName.length) {
                track.name(newName);
            }
        },

        showTrackMenu: function(track, e) {
            track._actionsMenu.showOnMouseEvent(e);
        },

        stopActiveDraw: function() {
            if (this._editedLine) {
                this._editedLine.stopDrawingLine();
            }
        },

        onTrackSegmentClick: function(track, trackSegment) {
            if (this._lineJoinCursor) {
                this.joinTrackSegments(trackSegment);
            } else {
                this.startEditTrackSegement(track, trackSegment);
            }
        },

        startEditTrackSegement: function(track, polyline) {
            if (this._editedLine && this._editedLine !== polyline) {
                this._editedLine.stopEdit();
            }
            polyline.startEdit();
            this._editedLine = polyline;
            polyline.once('editend', function() {
                setTimeout(this.onLineEditEnd.bind(this, track, polyline), 0);
            }.bind(this));
        },

        joinTrackSegments: function(newSegment) {
            this.stopLineJoinSelection();
            var originalSegment = this._editedLine;
            var latlngs = originalSegment.getLatLngs(),
                latngs2 = newSegment.getLatLngs();
            if (this._lineJoinToStart == this._lineJoinFromStart) {
                latngs2.reverse();
            }
            if (this._lineJoinFromStart) {
                latlngs.unshift.apply(latlngs, latngs2);
            } else {
                latlngs.push.apply(latlngs, latngs2);
            }
            latlngs = latlngs.map(function(ll) {
                return [ll.lat, ll.lng];
            });
            this.deleteTrackSegment(originalSegment);
            if (originalSegment._parentTrack == newSegment._parentTrack) {
                this.deleteTrackSegment(newSegment);
            }
            this.addTrackSegment(originalSegment._parentTrack, latlngs);

        },
        
        onLineEditEnd: function(track, polyline) {
            if (polyline.getLatLngs().length < 2) {
                track.feature.removeLayer(polyline);
            }
            this.onTrackLengthChanged(track);
            if (this._editedLine === polyline) {
                this._editedLine = null;
            }
        },

        addTrackSegment: function(track, sourcePoints) {
            var polyline = new MeasuredEditableLine(sourcePoints || [], {
                weight: 6,
                color: this.colors[track.color()],
                lineCap: 'butt',
                className: 'leaflet-editable-line'
            });
            polyline._parentTrack = track;
            polyline.setMeasureTicksVisible(track.measureTicksShown());
            polyline.on('click', this.onTrackSegmentClick.bind(this, track, polyline));
            polyline.on('nodeschanged', this.onTrackLengthChanged.bind(this, track));
            polyline.on('noderightclick', this.onNodeRightClickShowMenu, this);
            polyline.on('segmentrightclick', this.onSegmentRightClickShowMenu, this);
            polyline.on('mousemove', this.onMouseMoveOnSegmentUpdateLineJoinCursor, this);

            //polyline.on('editingstart', polyline.setMeasureTicksVisible.bind(polyline, false));
            //polyline.on('editingend', this.setTrackMeasureTicksVisibility.bind(this, track));
            track.feature.addLayer(polyline);
            return polyline;
        },

        onNodeRightClickShowMenu: function(e) {
            var items = [];
            if (e.nodeIndex > 0 && e.nodeIndex < e.line.getLatLngs().length - 1) {
                items.push({text: 'Cut',
                            callback: this.splitTrackSegment.bind(this, e.line, e.nodeIndex)});
            }
            if (e.nodeIndex === 0 || e.nodeIndex == e.line.getLatLngs().length - 1) {
                items.push({text: 'Join', callback: this.startLineJoinSelection.bind(this, e)});
            }
            items.push({text: 'Reverse', callback: this.reverseTrackSegment.bind(this, e.line)});
            items.push({text: 'Delete segment', callback: this.deleteTrackSegment.bind(this, e.line)});
            var menu = new L.Contextmenu(items);
            menu.showOnMouseEvent(e.mouseEvent);

        },

        onSegmentRightClickShowMenu: function(e) {
            var menu = new L.Contextmenu([
                                        {text: 'Cut',
                                         callback: this.splitTrackSegment.bind(this, e.line, e.nodeIndex, e.mouseEvent.latlng)},
                                        {text: 'Reverse', callback: this.reverseTrackSegment.bind(this, e.line)},
                                        {text: 'Delete segment', callback: this.deleteTrackSegment.bind(this, e.line)}
                                        ]);
            menu.showOnMouseEvent(e.mouseEvent);
        },

        startLineJoinSelection: function(e) {
            this.stopLineJoinSelection();
            this._editedLine.stopDrawingLine();
            this._lineJoinFromStart = (e.nodeIndex === 0);
            var p = this._editedLine.getLatLngs()[e.nodeIndex];
            p = [p.lat, p.lng];
            this._lineJoinCursor = L.polyline([p, e.mouseEvent.latlng], {
                clickable: false, 
                color: 'red',
                weight: 1.5,
                opacity: 1,
                dashArray: '7,7'
                })
            .addTo(this.map);
            this.map.on('mousemove', this.onMouseMoveUpdateLineJoinCursor, this);
            this.map.on('click', this.stopLineJoinSelection, this);
            L.DomEvent.on(document, 'keyup', this.onEscPressedStopLineJoinSelection, this);
            var self = this;
            setTimeout(function() {
                self._editedLine.preventStopEdit = true;
            }, 0);
        },

        onMouseMoveUpdateLineJoinCursor: function(e) {
            if (this._lineJoinCursor) {
                this._lineJoinCursor.spliceLatLngs(1, 1, e.latlng);
                this._lineJoinCursor.setStyle({color: 'red'});
            }
        },

        onMouseMoveOnSegmentUpdateLineJoinCursor: function(e) {
            if (!this._lineJoinCursor) {
                return;
            }
            var trackSegment = e.target,
                latlngs = trackSegment.getLatLngs(),
                distToStart = e.latlng.distanceTo(latlngs[0]),
                distToEnd = e.latlng.distanceTo(latlngs[latlngs.length - 1]);
            this._lineJoinToStart = (distToStart < distToEnd);
            var cursorEnd = this._lineJoinToStart ? latlngs[0] : latlngs[latlngs.length - 1];
            this._lineJoinCursor.setStyle({color: 'green'});
            this._lineJoinCursor.spliceLatLngs(1, 1, cursorEnd);
            L.DomEvent.stopPropagation(e.originalEvent);
        },

        onEscPressedStopLineJoinSelection: function(e) {
            if ('input' == e.target.tagName.toLowerCase()) {
                return;
            }
            switch (e.keyCode) {
                case 27:
                case 13:
                    this.stopLineJoinSelection();
                    break;
            }
        },

        stopLineJoinSelection: function() {
            if (this._lineJoinCursor) {
                this.map.off('mousemove', this.onMouseMoveUpdateLineJoinCursor, this);
                this.map.off('click', this.stopLineJoinSelection, this);
                L.DomEvent.off(document, 'keyup', this.onEscPressedStopLineJoinSelection, this);
                this.map.removeLayer(this._lineJoinCursor);
                this._lineJoinCursor = null;
                var self = this;
                setTimeout(function() {
                    self._editedLine.preventStopEdit = false;
                }, 0);
            }
        },

        splitTrackSegment: function(trackSegment, nodeIndex, latlng) {
            var latlngs = trackSegment.getLatLngs();
            latlngs = latlngs.map(function(ll) {
                return [ll.lat, ll.lng];
            });
            var latlngs1 = latlngs.slice(0, nodeIndex + 1),
                latlngs2 = latlngs.slice(nodeIndex + 1);
            if (latlng) {
                var p = this.map.project(latlng),
                    p1 = this.map.project(latlngs[nodeIndex]),
                    p2 = this.map.project(latlngs[nodeIndex + 1]),
                    pnew = L.LineUtil.closestPointOnSegment(p, p1, p2);
                latlng = this.map.unproject(pnew);
                latlngs1.push(latlng);
                latlng = [latlng.lat, latlng.lng];
            } else {
                latlng = latlngs[nodeIndex];
            }
            latlngs2.unshift(latlng);
            this.deleteTrackSegment(trackSegment);
            var segment1 = this.addTrackSegment(trackSegment._parentTrack, latlngs1);
            this.addTrackSegment(trackSegment._parentTrack, latlngs2);
            this.startEditTrackSegement(trackSegment._parentTrack, segment1);
        },

        deleteTrackSegment: function(trackSegment) {
            trackSegment._parentTrack.feature.removeLayer(trackSegment);
        },

        addTrack: function(geodata) {
            //var polylines = [];
            var color =  geodata.color;
            if (color >= 0 && color < this.colors.length) {
            } else {
                color = this._lastTrackColor;
                this._lastTrackColor = (this._lastTrackColor + 1) % this.colors.length;
            }
            var track = {
                name: ko.observable(geodata.name),
                color: ko.observable(color),
                visible: ko.observable(true),
                length: ko.observable('empty'),
                measureTicksShown: ko.observable(geodata.measureTicksShown || false),
                feature: L.featureGroup([])
            };
            (geodata.tracks || []).forEach(this.addTrackSegment.bind(this, track));

            this.tracks.push(track);

            track.visible.subscribe(this.onTrackVisibilityChanged.bind(this, track));
            track.measureTicksShown.subscribe(this.setTrackMeasureTicksVisibility.bind(this, track));
            track.color.subscribe(this.onTrackColorChanged.bind(this, track));
            
            //this.onTrackColorChanged(track);
            this.onTrackVisibilityChanged(track);
            this.attachColorSelector(track);
            this.attachActionsMenu(track);
            this.onTrackLengthChanged(track);
            return track;
        },

        removeTrack: function(track) {
            track.visible(false);
            this.tracks.remove(track);
        },

        exportTracks: function(minTicksIntervalMeters) {
            return this.tracks()
                .filter(function(track) {return track.feature.getLayers().length;})
                .map(function(track) {
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