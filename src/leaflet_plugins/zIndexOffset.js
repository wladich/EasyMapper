//@require leaflet
(function () {
   'use strict';

    var originalSetZIndex= L.TileLayer.prototype.setZIndex;
    L.TileLayer.include({
        setZIndex: function(z) {
            z += this.options.zIndexOffset || 0;
            originalSetZIndex.call(this, z);
        }
    });
})();
