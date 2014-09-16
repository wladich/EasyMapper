//@require leaflet
//@require layers.js
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
            map.setView([55, 37], 10);
        }

    });

    window.mapperApp = mapperApp;
}).call();