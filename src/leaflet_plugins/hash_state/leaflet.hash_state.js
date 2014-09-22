//@require leaflet
//@require hash_state.js
(function(){
    "use strict";
    L.Mixin.HashState = {
        enableHashState: function(key, defaults) {
            this._hash_state_key = key;
            var saveFunc = (function saveFunc() {
                var state = this._serializeState();
                window.hashState.saveState(key, state);
            }).bind(this);
            var loadFunc = this._unserializeState.bind(this);
            for (var i=0; i < this.stateChangeEvents.length; i++) {
                this.on(this.stateChangeEvents[i], saveFunc);
            }
            window.hashState.addEventListener(key, loadFunc);
            var state = window.hashState.getState(key);
            if (!loadFunc(state)) {
                loadFunc(defaults);
                saveFunc();
            }
        }
    };
})();