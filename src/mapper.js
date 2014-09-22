//@require leaflet
//@require layers.js
//@require leaflet.hash_state.Map
(function(){
    "use strict";

    var mapperApp = L.Class.extend({
        initialize: function(mapContainer) {
            this.setupMap(mapContainer);
        },

        setupMap: function(mapContainer) {
            var map = this._map = L.map(mapContainer, {fadeAnimation: false});
            var baseMaps = layers.getBaseMaps();
            L.control.layers(baseMaps, layers.getOverlays(), {collapsed: false})
                .addTo(map);
            map.addLayer(baseMaps['OpenStreetMap']);
            map.enableHashState('m', [10, 55.7, 37.5]);
        }

    });

    window.mapperApp = mapperApp;
}).call();