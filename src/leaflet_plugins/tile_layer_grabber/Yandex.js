//@require leaflet
//@require promise
//@require leaflet.yandex
(function(){
    "use strict";
    L.Yandex.include({
        clone: function() {
            return new L.Yandex(this._mapType, this.options);
        }
    });

})();