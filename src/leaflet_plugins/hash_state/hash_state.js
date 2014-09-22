(function() {
    "use strict";

    function arrayItemsEqual(l1, l2) {
        l1 = l1 || [];
        l2 = l2 || [];
        if (l1.length != l2.length)
            return false;
        for (var i=0; i < l1.length; i++) {
            if (l1[i] != l2[i]) {
                return false;
            }
        }
        return true;
    }

    var hashStateSingleton = {
        _listeners: [],
        _state: {},
        _updating: false,

        addEventListener: function(key, callback) {
            this._listeners.push([key, callback]);
        },

        removeEventListener: function(key, callback) {
            for (var i=0; i < this._listeners.length; i++){
                var listener = this._listeners[i];
                if (listener[0] == key && listener[1] == callback){
                    this._listeners.splice(i, 1);
                    return true;
                }
            }
        },

        _parseHash: function(){
            var hash = location.hash;
            var args = {};

            var i = hash.indexOf('#');
            if (i >= 0) {
                hash = hash.substr(i+1).trim();
                var pairs = hash.split('&');
                for (var j=0, len=pairs.length; i < len; i++) {
                    var key_value = pairs[j].split('=');
                    if (key_value.length === 2) {
                        var key = key_value[0];
                        var value = key_value[1].split('/');
                        value = value.map(decodeURIComponent);
                        args[key] = value;
                    }
                }
            }
            return args;
        },

        _saveStateToHash: function() {
            var stateItems = [];
            for (var key in this._state) {
                var values = this._state[key].join('/');
                stateItems.push(key + '=' + values);
            }
            var hashString = '#' + stateItems.join('&');
            location.replace(hashString);
        },

        saveState: function(key, values){
            this._state[key] = values;
            this._saveStateToHash();
        },

        getState: function(key){
            return this._state[key] || [];
        },

        onHashChanged: function() {
            var state = this._parseHash();
            var changed_keys = {};
            var key;
            for (key in state) {
                if (!arrayItemsEqual(state[key], this._state[key])) {
                    changed_keys[key] = 1;
                }
            }
            for (key in this._state) {
                if (!(key in state)) {
                    changed_keys[key] = 1;
                }
            }
            for (var i=0; i < this._listeners.length; i++) {
                key = this._listeners[i][0];
                if (key in changed_keys) {
                    var callback = this._listeners[i][1];
                    setTimeout(callback.bind(null, state[key]), 0);
                }
            }
            this._state = state;
        }
    };

    window.hashState = hashStateSingleton;
    window.addEventListener('hashchange', window.hashState.onHashChanged.bind(window.hashState));
    window.hashState.onHashChanged();

})();
