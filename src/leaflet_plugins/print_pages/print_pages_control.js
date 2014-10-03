//@require leaflet
//@require print_pages_control.css
//@require knockout
//@require papersheet_feature.js

(function(){
    "use strict";
    ko.components.register('progress-indicator', {
        template:   '<div class="progress-unknown" data-bind="visible: progress() === undefined"></div>' +
                    '<div class="progress" data-bind="visible: progress() !== undefined">' +
                        '<div class="leaflet-control-progress-bkg">' +
                            '<div class="leaflet-control-progress-bar"  data-bind="style: {width: progress() + \'%\'}"></div>' +
                        '</div>' +
                    '</div>',
        viewModel: function(params) {
            this.progress = params.progress;
        }
    });

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
        options: {position: 'bottomleft'},
        
        srcZoomLevelOptions: ['auto', 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
        predefinedScales: [['100 m', 100], ['500 m', 500], ['1 km', 1000]],
        predefinedPaperSizes: [['A2', 420, 594], ['A3', 297, 420], ['A4', 210, 297], ['A5', 148, 210]],

        initialize: function() {
            L.Control.prototype.initialize.call(this);
            // knockout viewModel fields
            this.mapScale = ko.observable(500).extend({checkNumberRange: [0.01, 1000000]});
            this.printResolution = ko.observable(300).extend({checkNumberRange: [10, 9999]});
            this.srcZoomLevel = ko.observable('auto');
            this.pageWidth = ko.observable(210).extend({checkNumberRange: [10, 9999]});
            this.pageHeight = ko.observable(297).extend({checkNumberRange: [10, 9999]});
            this.settingsExpanded = ko.observable(false);
            this.makingPdf = ko.observable(false);
            this.progress = ko.observable(undefined);
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
                            <a title="Remove all pages" class="button right-side icon-removeallpages"></a>\
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
                                    params: {progress: progress}\
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
            console.log('Start download');
            this.makingPdf(true);
            this.progress(undefined);
            setTimeout(function(){
                console.log('0% done');
                this.progress(0);
            }.bind(this), 500);
            setTimeout(function(){
                console.log('70% done');
                this.progress(70);
            }.bind(this), 1000);
            setTimeout(function(){
                console.log('All done');
                this.makingPdf(false);
            }.bind(this), 1500);

        },

        addPagePortrait: function() {
            this._addPage(this.printSize());
        },

        addPageLandscape: function() {
            var size = this.printSize();
            size = [size[1], size[0]];
            this._addPage(size);
        },

        _replacePage: function(feature) {
            var i = this.sheets.indexOf(feature);
            var center = feature.getLatLng();
            var size = this.printSize();
            if (feature._rotated) {
                size = [size[1], size[0]];
            }
            var newFeature = this._createPage(center, size, i+1);
            newFeature._rotated = feature._rotated;
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

        _addPage: function(size) {
            var sheet = this._createPage(this._map.getCenter(), size, this.sheets().length+1);
            this.sheets.push(sheet);
        },

        _createPage: function(center, size, label) {
            var sheet = new L.PaperSheet(
                center,
                size,
                this.mapScale(),
                label);
            sheet.addTo(this._map);
            sheet.on('click', function() {this._rotatePage(sheet);}, this);
            sheet.on('move', function() {this.pageMoveNotifier.valueHasMutated();}, this)
            this.pageMoveNotifier.valueHasMutated();
            return sheet;
        }
    });
})();
