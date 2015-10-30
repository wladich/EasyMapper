//@require leaflet.bing

(function() {
    "use strict";
    L.BingLayer.include({
        clone: function() {
            return new L.BingLayer(this._key, this.options);
        }
    });
})();
