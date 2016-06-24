//@require leaflet
//@require promise

(function(){
    "use strict";
    L.TileLayer.Canvas.include({
        // clone method must be defined in canvas descendant
        // clone: function() {},

        getTilesInfo: function() {
            var this_layer = this;

            function getTiles() {
                var tiles_info = [],
                    canvas;
                for (var k in this_layer._tiles) {
                    canvas = this_layer._tiles[k];
                    tiles_info.push({img: canvas, left: canvas._leaflet_pos.x, top: canvas._leaflet_pos.y,
                        width: canvas.width, height: canvas.height});
                }
                return tiles_info;
            }

            return new Promise(
                function(resolve) {
                    var readyEvent = this_layer.readyEvent || 'load';
                    this_layer.once(readyEvent, function(){
                        resolve(getTiles());
                    });
                }
            );
        }
    });
})();
