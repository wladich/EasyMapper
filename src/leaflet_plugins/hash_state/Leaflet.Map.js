//@require leaflet
//@require leaflet.hash_state.js
(function() {
    "use strict";
    L.Map.include(L.Mixin.HashState);

    L.Map.include({
        stateChangeEvents: ['moveend'],

        _serializeState: function() {
            var center = this.getCenter();
            var zoom = this.getZoom();
            var precision = Math.max(0, Math.ceil(Math.log(zoom) / Math.LN2));
            var state = [
                zoom,
                center.lat.toFixed(precision),
                center.lng.toFixed(precision),
            ];
           return state;
        },

        _unserializeState: function(values) {
            if (!values || values.length != 3)
                return false;
            var zoom = parseInt(values[0], 10),
                lat  = parseFloat(values[1]),
                lng  = parseFloat(values[2]);
            if (isNaN(zoom) || isNaN(lat) || isNaN(lng))
                return false;
            this._updating_state = true;
            this.setView([lat, lng], zoom);
            this._updating_state = false;
            return true;
        },
    });
})();
