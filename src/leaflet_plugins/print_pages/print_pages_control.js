//@require leaflet
//@require print_pages_control.css
//@require knockout
//@require papersheet_feature.js
//@require leaflet.contextmenu
//@require lib/map_to_image.js
//@require lib/pdf.js
//@require fileutils
//@require knockout.progress

(function(){
    "use strict";

    ko.extenders.checkNumberRange = function(target, range) {
        var result = ko.pureComputed({
            read: target,  //always return the original observables value
            write: function(newValue) {
                newValue = parseFloat(newValue);
                if (newValue >= range[0] && newValue <= range[1]) {
                    target(newValue);
                } else {
                    target.notifySubscribers(target());
                }
            }
        }).extend({ notify: 'always' });
        return result;
    };

    L.Control.PrintPages = L.Control.extend({
        includes: [L.Mixin.Events, L.Mixin.HashState],
        stateChangeEvents: ['change'],
        options: {position: 'bottomleft'},
        
        srcZoomLevelOptions: ['auto', 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
        predefinedScales: [['100 m', 100], ['500 m', 500], ['1 km', 1000]],
        predefinedPaperSizes: [['A2', 420, 594], ['A3', 297, 420], ['A4', 210, 297], ['A5', 148, 210]],

        initialize: function(options) {
            L.Control.prototype.initialize.call(this, options);
            // knockout viewModel fields
            this.mapScale = ko.observable(500).extend({checkNumberRange: [0.01, 1000000]});
            this.printResolution = ko.observable(300).extend({checkNumberRange: [10, 9999]});
            this.srcZoomLevel = ko.observable('auto');
            this.pageWidth = ko.observable(210).extend({checkNumberRange: [10, 9999]});
            this.pageHeight = ko.observable(297).extend({checkNumberRange: [10, 9999]});
            this.settingsExpanded = ko.observable(false);
            this.makingPdf = ko.observable(false);
            this.downloadProgressRange = ko.observable(undefined);
            this.downloadProgressDone = ko.observable(undefined);
            this.marginLeft = ko.observable(3).extend({checkNumberRange: [0, 99]});
            this.marginRight = ko.observable(3).extend({checkNumberRange: [0, 99]});
            this.marginTop = ko.observable(3).extend({checkNumberRange: [0, 99]});
            this.marginBottom = ko.observable(3).extend({checkNumberRange: [0, 99]});
            this.sheets = ko.observableArray();
            this.mapMoveNotifier = ko.observable();
            this.suggestedZooms = ko.pureComputed(this.suggestZooms, this);
            this.printSize = ko.pureComputed(this._printSize, this);
            this.pageMoveNotifier = ko.observable();

            this.printSize.subscribe(this._replaceAllPages, this);
            this.mapScale.subscribe(this._replaceAllPages, this);
            ko.pureComputed(this._serializeState, this).subscribe(this.notifyChange, this);

        },

        onAdd: function(map) {
            this._map = map;
            this.sheets.removeAll();
            var dialogContainer = this._container = L.DomUtil.create('div', 'leaflet-control leaflet-control-printpages');
            dialogContainer.innerHTML = '\
                <table class="main-layout">\
                    <tr><td colspan="2">\
                            <a title="Add page in portrait orientation" class="button icon-addpageportrait" data-bind="click: addPagePortrait"></a>\
                            <a title="Add page in landscape orientation" class="button icon-addpagelandscape" data-bind="click: addPageLandscape"></a>\
                            <a title="Remove all pages" class="button right-side icon-removeallpages" data-bind="click: removeAllPages"></a>\
                    </td></tr>\
                    <tr>\
                        <td class="section-title">Print scale</td>\
                        <td>\
                            <div class="predefined-values" data-bind="foreach: predefinedScales">\
                                <a data-bind="text: $data[0], click: function() {$root.mapScale($data[1])}"></a>\
                            </div>\
                            <input type="text" style="width: 3.2em" maxlength="6" data-bind="value: mapScale">&nbsp;m in 1 cm\
                        </td>\
                    </tr>\
                    <tr data-bind="visible: settingsExpanded">\
                        <td class="section-title">Page size</td>\
                        <td>\
                            <div class="predefined-values" data-bind="foreach: predefinedPaperSizes">\
                                <a data-bind="text: $data[0],\
                                            click: function() {\
                                                $root.pageWidth($data[1]);\
                                                $root.pageHeight($data[2]);\
                                            }"></a>\
                            </div>\
                            <input type="text" maxlength="4" title="width" placeholder="width" style="width: 2.1em" data-bind="value: pageWidth">\
                            x <input type="text" maxlength="4" heigh="height" placeholder="height" style="width: 2.1em" data-bind="value: pageHeight"> mm\
                        </td>\
                    </tr>\
                    <tr data-bind="visible: settingsExpanded">\
                        <td class="section-title-middle">Margins</td>\
                        <td>\
                            <table class="margins">\
                                <tr><td></td><td><input "type="text" maxlength="2" value="3" style="width: 1.1em" data-bind="value: marginTop"></td><td></td></tr>\
                                <tr>\
                                    <td><input type="text" maxlength="2" value="3" style="width: 1.1em" data-bind="value: marginLeft"></td>\
                                    <td></td><td><input type="text" maxlength="2" value="3" style="width: 1.1em" data-bind="value: marginRight"> mm</td>\
                                </tr>\
                                <tr><td></td><td><input type="text" maxlength="2" value="3" style="width: 1.1em" data-bind="value: marginBottom"></td><td></td></tr>\
                            </table>\
                        </td>\
                    </tr>\
                    <tr data-bind="visible: settingsExpanded">\
                         <td class="section-title">Resolution</td>\
                        <td><input type="text" maxlength="4" style="width: 2.1em" data-bind="value: printResolution"> dpi</td>\
                    </tr>\
                    <tr data-bind="visible: settingsExpanded">\
                        <td class="section-title">Source zoom<br />level</td>\
                        <td>\
                            <select name="srczoom" data-bind="options: srcZoomLevelOptions, value: srcZoomLevel">\
                            </select>\
                        </td>\
                    </tr>\
                    <tr><td colspan="2">\
                            <a class="button icon-settings" data-bind="click: function() {settingsExpanded(!settingsExpanded())}"></a>\
                            <div class="settings-summary">\
                                <span data-bind="text: pageWidth"></span>&nbsp;x&nbsp;<span data-bind="text: pageHeight"></span>&nbsp;mm,<br/>\
                                <span data-bind="text: printResolution"></span>&nbsp;dpi,\
                                zoom&nbsp;<span data-bind="text: srcZoomLevel"></span>\
                                    <!-- ko if: srcZoomLevel()=== "auto" -->\
                                        (<span title="Zoom for satellite and scanned imagery" data-bind="text: suggestedZooms()[0]"></span>&nbsp;\
                                         /&nbsp;<span title="Zoom for maps like OSM and Google" data-bind="text: suggestedZooms()[1]"></span>)\
                                    <!-- /ko -->\
                            </div>\
                    </td></tr>\
                    <tr><td colspan="2">\
                        <div class="download-button-row">\
                            <a class="text-button download-pdf" data-bind="\
                                click: onDownloadButtonClick,\
                                visible: !makingPdf()">Download PDF</a>\
                            <div data-bind="\
                                component: { \
                                    name: \'progress-indicator\',\
                                    params: {progressRange: downloadProgressRange, progressDone: downloadProgressDone}\
                                },\
                                visible: makingPdf()"></div>\
                        </div>\
                    </td></tr>\
                </table>\
            ';
            ko.applyBindings(this, dialogContainer)
            
            if (!L.Browser.touch) {
                L.DomEvent
                    .disableClickPropagation(dialogContainer)
                    .disableScrollPropagation(dialogContainer);
            } else {
                L.DomEvent.on(dialogContainer, 'click', L.DomEvent.stopPropagation);
            }

            this._map.on('moveend', function() {this.mapMoveNotifier.valueHasMutated();}, this);
            return dialogContainer;
        },

        _printSize: function() {
            return [this.pageWidth() - this.marginLeft() - this.marginRight(),
                    this.pageHeight() - this.marginTop() - this.marginBottom()];
        },

        suggestZooms: function() {
            var reference_lat,
                mapScale = this.mapScale(),
                resolution = this.printResolution();
            this.mapMoveNotifier();
            this.pageMoveNotifier();
            var sheets = this.sheets();
            if (sheets.length > 0) {
                var reference_lat = 1e20;
                for (var i=0; i < sheets.length; i++) {
                    var sheet = sheets[i];
                    var sheet_lat = Math.abs(sheet.getLatLngBounds().getSouth());
                    if (Math.abs(sheet_lat < reference_lat)) {
                        reference_lat = sheet_lat;
                    }
                }
            } else {
                if (!this._map) {
                    return [null, null];
                }
                reference_lat = this._map.getCenter().lat;
            };
            var target_meters_per_pixel = mapScale / (resolution / 2.54) ;
            var map_units_per_pixel = target_meters_per_pixel / Math.cos(reference_lat * Math.PI / 180);
            var zoom_sat = Math.ceil(Math.log(40075016.4 / 256 / map_units_per_pixel)/Math.LN2);

            target_meters_per_pixel = mapScale / (90 / 2.54) / 1.5;
            map_units_per_pixel = target_meters_per_pixel / Math.cos(reference_lat * Math.PI / 180);
            var zoom_map = Math.round(Math.log(40075016.4 / 256 / map_units_per_pixel)/Math.LN2);
            return [zoom_sat, zoom_map];
        },

        onDownloadButtonClick: function() {
            var sheets = this.sheets(),
                resolution = this.printResolution();
            if (sheets.length) {
                this.fire('pdfstart');
                this.makingPdf(true);
                this.downloadProgressDone(undefined);
                this.downloadProgressRange(sheets.length * mapRender.getRenderableLayers(this._map).length);
                var pages = sheets.map(function(sheet, idx) {
                    var q = resolution / 25.4;
                    var page = {
                        latLngBounds: sheet.getLatLngBounds(),
                        pixelSize: [Math.round(sheet.paperSize[0] * q), Math.round(sheet.paperSize[1] * q)]
                    }
                    if (this.options.postprocess) {
                        page.postprocess = this.options.postprocess.bind(null, idx, page.latLngBounds);
                    }
                    return page;
                }.bind(this));
                var zooms = (this.srcZoomLevel() == 'auto') ? this.suggestZooms() : [this.srcZoomLevel(), this.srcZoomLevel()];
                var X = 0;
                var onTileLoad = function(x) {
                    X += x;
                    this.downloadProgressDone(X);
                }.bind(this);
                mapRender.mapToImages(this._map, pages, zooms, onTileLoad)
                .then(buildPDF.bind(null, resolution))
                .then(fileutils.saveStringToFile.bind(null, 'map.pdf', 'application/pdf'))
                .done(function() {
                    this.makingPdf(false);
                    console.log('DONE');
                }.bind(this), function(error) {
                    this.makingPdf(false);
                    if (error.statusText !== undefined) {
                        error = error.statusText || 'Server error or CORS violation';
                    }
                    alert('Failed to make PDF: ' + error);
                }.bind(this));
            } else {
                alert('Add some pages to print')
            }
        },

        addPagePortrait: function() {
            this._addPage();
        },

        addPageLandscape: function() {
            this._addPage(true);
        },

        _replacePage: function(feature) {
            var i = this.sheets.indexOf(feature);
            var center = feature.getLatLng();
            var newFeature = this._createPage(center, i, feature._rotated);
            this._map.removeLayer(feature);
            this.sheets.splice(i, 1, newFeature)
        },

        _replaceAllPages: function() {
            this.sheets().forEach(this._replacePage.bind(this));
        },

        _rotatePage: function(feature){
            feature._rotated = !feature._rotated;
            this._replacePage(feature);
        },

        _removePage: function(feature) {
            this.sheets.remove(feature);
            this._map.removeLayer(feature);
            this._replaceAllPages();
        },

        removeAllPages: function() {
            var sheets = this.sheets(),
                sheets_n = sheets.length;
            for (var i=0; i < sheets_n; i++) {
                this._map.removeLayer(sheets[i]);
            }
            this.sheets.removeAll();
        },

        _addPage: function(rotated) {
            var sheet = this._createPage(this._map.getCenter(), this.sheets().length, rotated);
            this.sheets.push(sheet);
        },

        _changePageOrder: function(feature, newIndex) {
            this.sheets.remove(feature);
            this.sheets.splice(newIndex, 0, feature);
            this._replaceAllPages();
        },

        _makePageContexmenuItems: function(feature, index) {
            var items = [
                  {text: 'Rotate', callback: this._rotatePage.bind(this, feature)},
                  '-',
                  {text: 'Delete', callback: this._removePage.bind(this, feature)}
            ];
            var sheets = this.sheets(),
                sheets_n = sheets.length;
            if (sheets_n > 1 || index == sheets_n) {
                items.push({text: 'Change order', separator: true})
                for (var i=0; i<sheets_n; i++) {
                    if (i != index) {
                        items.push({
                            text: i+1,
                            callback: this._changePageOrder.bind(this, feature, i)
                        });
                    }
                }
            }
            return items;
        },

        _createPage: function(center, index, rotated) {
            var size = this.printSize();
            if (rotated) {
                size = [size[1], size[0]];
            }
            var sheet = new L.PaperSheet(
                center,
                size,
                this.mapScale(),
                index + 1);
            sheet._rotated = !!rotated;
            sheet.addTo(this._map);
            sheet.on('click', this._rotatePage.bind(this, sheet));
            sheet.on('move', this.pageMoveNotifier.valueHasMutated);
            sheet.on('moveend', this.notifyChange, this)
            sheet.bindContextmenu(this._makePageContexmenuItems.bind(this, sheet, index));
            this.pageMoveNotifier.valueHasMutated();
            return sheet;
        },

        notifyChange: function() {
            this.fire('change');
        },

        _serializeState: function(){
            var sheets = this.sheets();
            var state = [];
            if (sheets.length) {
                state.push(this.mapScale());
                state.push(this.printResolution());
                state.push(this.srcZoomLevel());
                state.push(this.pageWidth());
                state.push(this.pageHeight());
                state.push(this.marginLeft());
                state.push(this.marginRight());
                state.push(this.marginTop());
                state.push(this.marginBottom());
                for (var i=0; i < sheets.length; i++) {
                    var sheet = sheets[i],
                        ll = sheet.getLatLng();
                    state.push(ll.lat.toFixed(5));
                    state.push(ll.lng.toFixed(5));
                    state.push(sheet._rotated ? 1 : 0);
                }
            }
            return state;
        },

        _unserializeState: function(values) {

            function validateFloat(value, min, max) {
                value = pasrseFloat(value);
                if (isNaN(value) || value < min || value > max) {
                    throw 'INVALID VALUE';
                }
                return value;
            }

            if (!values) {
                return false;
            }
            this.removeAllPages();
            values = values.slice();
            this.mapScale(values.shift());
            this.printResolution(values.shift());
            this.srcZoomLevel(values.shift());
            this.pageWidth(values.shift());
            this.pageHeight(values.shift());
            this.marginLeft(values.shift());
            this.marginRight(values.shift());
            this.marginTop(values.shift());
            this.marginBottom(values.shift());
            var lat, lng, rotated;
            while (values.length >= 3) {
                lat = parseFloat(values.shift());
                lng = parseFloat(values.shift());
                rotated = parseInt(values.shift(), 10);
                if (isNaN(lat) || isNaN(lng) || lat < -85 || lat > 85 || lng < -180 || lng > 180) {
                    break;
                }
                this.sheets.push(this._createPage([lat, lng], this.sheets().length, rotated));
            }
            return true;

        },

    });
})();
