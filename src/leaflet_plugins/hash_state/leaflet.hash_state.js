//@require leaflet
//@require hash_state.js
(function(){
    "use strict";
    L.Mixin.HashState = {
        enableHashState: function(key, defaults) {
            this._hash_state_key = key;
            var saveFunc = (function saveFunc(e) {
                var state = this._serializeState(e);
                window.hashState.saveState(key, state);
            }).bind(this);
            var loadFunc = this._unserializeState.bind(this);
            var eventSource = this.stateChangeEventsSource ? this[this.stateChangeEventsSource] : this;
            for (var i=0; i < this.stateChangeEvents.length; i++) {
                var event = this.stateChangeEvents[i];
                eventSource.on(event, saveFunc);
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