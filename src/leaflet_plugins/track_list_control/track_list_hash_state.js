//@require track_list.js
//@require leaflet.hash_state

(function() {
    'use strict';

    L.Control.TrackList.include(L.Mixin.HashState);
    L.Control.TrackList.include({
            stateChangeEvents: [],

            _serializeState: function(e) {
                return [];
            },

            _unserializeState: function(values) {
                if (values && values.length) {
                    var geodata = parseGeoFile('', window.location.href);
                    this.addTracksFromGeodataArray(geodata);
                }
                window.hashState.saveState(this._hash_state_key, []);
            }
        }
    );

})();
