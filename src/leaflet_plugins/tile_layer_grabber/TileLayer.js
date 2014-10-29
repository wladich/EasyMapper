//@require leaflet
//@require promise
(function(){
    "use strict";
    L.TileLayer.include({
        clone: function() {
            return new L.TileLayer(this._url, this.options);
        },

        getTilesInfo: function() {
            var this_layer = this;
            function getUrls() {
                var tiles_info = [];
                for (var k in this_layer._tiles) {
                    var img = this_layer._tiles[k];
                    //tiles_info.push([img.src, img._leaflet_pos.x, img._leaflet_pos.y, img.width]);
                    tiles_info.push({url: img.src, left: img._leaflet_pos.x, top: img._leaflet_pos.y, size: img.width});
                }
                return tiles_info;
            }
            
            return new Promise(
                function(resolve) {
                    this_layer.once('load', function(){
                        resolve(getUrls());
                    });
                }
            );
        },

        getMaxZoomAtPoint: function(latlng) {
            return Promise.resolve(this.options.maxNativeZoom || this.options.maxZoom || this._map.options.maxZoom || 18);
        }
    });
})();