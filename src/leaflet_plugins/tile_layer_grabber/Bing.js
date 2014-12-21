//@require TileLayer.js

(function() {
    "use strict";
    L.TileLayer.include({
        clone: function() {
            return new L.BingLayer(this._key, this.options);
        }
    });
})();