//@require leaflet
//@require print_pages_control.css
(function(){
    "use strict";
    L.Control.PrintPages = L.Control.extend({
        includes: [L.Mixin.Events, L.Mixin.HashState],
        options: {position: 'bottomleft'},
        
        
        onAdd: function(map) {
            this._map = map;
            this.sheets = [];
            var dialogContainer = this._container = L.DomUtil.create('div', 'leaflet-control leaflet-control-printpages');
            dialogContainer.innerHTML = '\
                <table class="main-layout">\
                    <tr><td colspan="2">\
                            <a title="Add page in portrait orientation" class="button icon-addpageportrait"></a>\
                            <a title="Add page in landscape orientation" class="button icon-addpagelandscape"></a>\
                            <a title="Remove all pages" class="button right-side icon-removeallpages"></a>\
                    </td></tr>\
                    <tr>\
                        <td class="section-title">Map scale</td>\
                        <td>\
                            <div class="predefined-values">\
                                <a mapscale=100>100 m</a>\
                                <a mapscale=1000>500 m</a>\
                                <a mapscale=500>1 km</a>\
                            </div>\
                            <input type="text" size="3" pattern="\\d+" maxlength="6" value="500">&nbsp;m in 1 cm\
                        </td>\
                    </tr>\
                    <tr>\
                        <td class="section-title">Page size</td>\
                        <td>\
                            <div class="predefined-values">\
                                <a pagewidth="420" pageheight="594">A2</a>\
                                <a pagewidth="297" pageheight="420">A3</a>\
                                <a pagewidth="210" pageheight="297">A4</a>\
                                <a pagewidth="148" pageheight="210">A5</a>\
                            </div>\
                            <input type="text" pattern="\\d+" maxlength="4" title="width" placeholder="width" value="210" style="width: 2em">\
                            x <input type="text" pattern="\\d+" maxlength="4" heigh="height" placeholder="height" value="297" style="width: 2em"> mm\
                        </td>\
                    </tr>\
                    <tr>\
                        <td class="section-title-middle">Margins</td>\
                        <td>\
                            <table class="margins">\
                                <tr><td></td><td><input "type="text" pattern="\\d+" maxlength="2" value="3" style="width: 1.1em"></td><td></td></tr>\
                                <tr>\
                                    <td><input type="text" pattern="\\d+" maxlength="2" value="3" style="width: 1.1em"></td>\
                                    <td></td><td><input type="text" pattern="\\d+" maxlength="2" value="3" style="width: 1.1em"> mm</td>\
                                </tr>\
                                <tr><td></td><td><input type="text" pattern="\\d+" maxlength="2" value="3" style="width: 1.1em"></td><td></td></tr>\
                            </table>\
                        </td>\
                    </tr>\
                    <tr>\
                        <td class="section-title">Resolution</td>\
                        <td><input type="text" pattern="\\d+" maxlength="4" value=300 style="width: 2em"> dpi</td>\
                    </tr>\
                    <tr>\
                        <td class="section-title">Source zoom<br />level</td>\
                        <td>\
                            <select name="srczoom">\
                                <option value="auto">auto</option>\
                                <option value="7">7</option>\
                                <option value="8">8</option>\
                                <option value="9">9</option>\
                                <option value="10">10</option>\
                                <option value="11">11</option>\
                                <option value="12">12</option>\
                                <option value="13">13</option>\
                                <option value="14">14</option>\
                                <option value="15">15</option>\
                                <option value="16">16</option>\
                                <option value="17">17</option>\
                                <option value="18">18</option>\
                            </select>\
                        </td>\
                    </tr>\
                    <tr><td colspan="2">\
                            <a class="button icon-settings"></a>\
                            <div class="settings-summary">\
                                <span>222</span>&nbsp;x&nbsp;<span>333</span>&nbsp;mm,<br/>\
                                <span>300</span>&nbsp;dpi, zoom&nbsp;<span>auto</span>\
                            </div>\
                    </td></tr>\
                    <tr><td colspan="2">\
                        <div class="download-button-row">\
                            <a class="text-button download-pdf">Download PDF</a><br/>\
                            <div class="progress-unknown"></div><br/>\
                            <div class="progress">\
                                <div class="leaflet-control-progress-bkg">\
                                    <div class="leaflet-control-progress-bar"></div>\
                                </div>\
                            </div>\
                        </div>\
                    </td></tr>\
                </table>\
            ';
            
            return dialogContainer;
        },
    });
})();
