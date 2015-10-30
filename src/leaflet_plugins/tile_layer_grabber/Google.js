//@require leaflet.google
//@require promise
(function() {
    "use strict";
    
    L.Google.include({
        clone: function(){
            return new L.Google(this._type, this.options);
        },

        getTilesInfo: function(){
            var container = this._container;
            function getUrls() {
                var tiles_info = [];
                var mapRect = container.getBoundingClientRect();
                var imgs = container.getElementsByTagName('img');
                
                for (var i=0; i < imgs.length; i++){
                    var img = imgs[i];
                    if (img.style &&
                        img.style.getPropertyValue('width') == '256px' &&
                        img.style.getPropertyValue('height') == '256px' &&
                        img.src.indexOf('transparent.png') == -1) {
                            var imgRect = img.getBoundingClientRect(),
                                imgRelLeft = imgRect.left - mapRect.left,
                                imgRelTop  = imgRect.top - mapRect.top;
                            //tiles_info.push([url, imgRelLeft, imgRelTop, 256]);
                            tiles_info.push({url: img.src, left: imgRelLeft, top: imgRelTop, width: 256,
                                height: 256});
                    }
                }
                return tiles_info;
            }

            var this_ = this;
            return new Promise(
                function(resolve) {
                    google.maps.event.addListenerOnce(this_._google, "tilesloaded", function() {
                        resolve(getUrls());
                    });
                }
            );
        },

        getMaxZoomAtPoint: function(latlng){
            if (this._type == 'SATELLITE' || this._type == 'HYBRID') {
                return new Promise(function(resolve, reject) {
                    var maxZoomService = new google.maps.MaxZoomService();
                    maxZoomService.getMaxZoomAtLatLng(
                        new google.maps.LatLng(latlng.lat, latlng.lng),
                        function(response) {
                            if (response.status == google.maps.MaxZoomStatus.OK) {
                                resolve(response.zoom);
                            } else {
                                reject('Failed to get info about max zoom level for Google Sattelite layer');
                            }
                        });
                    });
            } else {
                return Promise.resolve(19);
            }
        }

    });
})();