//@require leaflet
//@require layers.js
//@require leaflet.hash_state.Map
//@require leaflet.hash_state.Control.Layers
//@require leaflet.layers_control.hotkeys
(function(){
    "use strict";

    var mapperApp = L.Class.extend({
        initialize: function(mapContainer) {
            this.setupMap(mapContainer);
        },

        setupMap: function(mapContainer) {
            var map = this._map = L.map(mapContainer, {fadeAnimation: false});
            var baseMaps = layers.getBaseMaps();
            var layersControl = L.control.layers(baseMaps, layers.getOverlays(), {collapsed: false, hotkeys: true})
                .addTo(map);
            layersControl.enableHashState('l', ['O']);
            map.enableHashState('m', [10, 55.7, 37.5]);
        }

    });

    window.mapperApp = mapperApp;
}).call();