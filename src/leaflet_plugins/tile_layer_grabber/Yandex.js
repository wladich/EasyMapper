//@require leaflet.yandex
//@require promise
(function() {
    "use strict";
    ymaps.ready(function(){
        ymaps.layer.tileContainer.CanvasContainer.prototype = ymaps.layer.tileContainer.DomContainer.prototype;
    });

    L.Yandex.include({
        clone: function(){
            var this_ = this;
            var yamap = new L.Yandex(this._type.replace(/^yandex#/, ''), this.options);
            return yamap;
        },

        getTilesInfo: function(){
            var container = this._container;
            var this_ = this;
            function getUrls(){
                var children = container.getElementsByTagName('ymaps');
                var tiles = [];
                var map_rect = container.getBoundingClientRect();
                var total_tiles = 0;
                var tiles_in_page = 0;
                var expected_tiles;
                for (var i=0; i<children.length; i++){
                    var child = children[i];
                    if (child.style.getPropertyValue('width') == '256px' && child.style.getPropertyValue('height') == '256px') {
                        var img_rect = child.getBoundingClientRect();
                        var img_rel_left = img_rect.left - map_rect.left;
                        var img_rel_top  = img_rect.top  - map_rect.top;
                        var src = child.style.getPropertyValue('background-image');
                        
                        var intersects_page = (img_rel_left > -256 && img_rel_top > -256 && img_rel_left < this_._map._size.x && img_rel_top < this_._map._size.y);
                        var loaded = src || child.style.getPropertyValue('background-color') != 'transparent';
                        if (loaded) {
                            total_tiles += 1;
                            if (intersects_page) {
                                tiles_in_page += 1;
                            }
                            if (expected_tiles === undefined) {
                                var x = img_rel_left;
                                var y = img_rel_top;
                                while (x < 0) {x += 256;}
                                while (y < 0) {y += 256;}
                                var map_size = this_._map._size;
                                var phase = x % 256;
                                var t_width = phase? 1 : 0;
                                if (phase < map_size.x) {
                                    t_width += Math.ceil((map_size.x - phase) / 256);
                                }
                                phase = y % 256;
                                var t_height = phase? 1 : 0;
                                if (phase < map_size.y) {
                                    t_height += Math.ceil((map_size.y - phase) / 256);
                                }
                                expected_tiles = t_width * t_height;
                            }
                        }
                        
                        if (src && intersects_page) {
                            src = src.replace(/^url\("?([^"]+)"?\)$/, '$1');
                            //tiles.push([src, img_rel_left, img_rel_top, 256]);
                            tiles.push({url: src, left: img_rel_left, top: img_rel_top, size: 256});
                        }
                    }
                }
                console.log('Total tiles ', total_tiles, 'in page ', tiles_in_page, 'expected ', expected_tiles);
                if (expected_tiles === undefined || tiles_in_page < expected_tiles) {
                    return null;
                }
                return tiles;
            }
            
            return new Promise(function(resolve) {
                var wait = function(){
                    var urls = getUrls();
                    if (urls === null){
                        console.log('Still waiting Yandex');
                        setTimeout(wait, 200);
                    } else {
                        resolve(urls);
                    }
                };
                wait();
            });
        },

        getMaxZoomAtPoint: function(latlng){
            return Promise.from(
                ymaps.getZoomRange(this._type, [latlng.lat, latlng.lng])
            ).then(function(range) {
                return range[1];
            });
        }

    });
})();