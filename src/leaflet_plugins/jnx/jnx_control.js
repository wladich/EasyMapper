//@require leaflet.buttons

(function(){
    "use strict";

    L.Control.JNX = L.Control.extend({
        initialize: function(options) {
            L.Control.prototype.initialize.call(this, options);
        },

        onAdd: function(map) {
            this.btn = L.functionButtons([{content: 'JNX'}], {position: 'bottomleft'})
                .addTo(map)
                .on('clicked', this.makeJnx, this);
        },

        makeJnx: function() {
            console.log('JNX!');
        }

    });
})();