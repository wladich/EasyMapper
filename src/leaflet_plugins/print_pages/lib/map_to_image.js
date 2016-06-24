//@require leaflet.tile_layer_grabber
//@require promise
//@require fileutils
//@require cors-proxy
var mapRender = (function() {
    "use strict";

    function _latLngBoundsToSizeInPixels(map, bounds, zoom) {
        var p1 = map.project(bounds.getSouthWest(), zoom);
        var p2 = map.project(bounds.getNorthEast(), zoom);
        var pixel_width = p2.x - p1.x;
        var pixel_height = p1.y - p2.y;
        return L.point(pixel_width, pixel_height, true);
    }
    
    function _getTempMap(width, height, center, zoom) {
        var container = L.DomUtil.create('div', '', document.body);
        container.style.position = 'absolute';
        container.style.left = '20000px';
        container.style.width = width + 'px';
        container.style.height = height + 'px';
        var map = new L.Map(container, {fadeAnimation: false, zoomAnimation: false, inertia: false});
        map.setView(center, zoom, {animate: false});
        return new Promise(
            function(resolve){
                map.whenReady(function(){resolve(map);});
            });
    }

    function _disposeMap(map){
        var container = map.getContainer();
        container.parentNode.removeChild(container);
    }

    function checkImage(s){
        return  (s.substring(0, 4) == '\x89PNG' && s.substring(s.length-8) == 'IEND\xae\x42\x60\x82') ||
                (s.substring(0, 2) == '\xff\xd8' && s.substring(s.length-2) == '\xff\xd9');
    }

    function _layerToImage(latLngBounds, zooms, notifyTileLoad, layer) {
        var zoom = layer.options.scaleDependent ? zooms[1] : zooms[0],
            canvasSize = _latLngBoundsToSizeInPixels(layer._map, latLngBounds, zoom),
            canvas, canvasCtx, tempMap;
        
        function imageFromString(s) {
            if (s) {
                var dataUrl = 'data:image/png;base64,' + btoa(s);
                var image = new Image();
                return new Promise(function(resolve, reject) {
                    image.onload = resolve.bind(null, image);
                    image.onerror = reject.bind(null, 'Tile image corrupt');
                    image.src = dataUrl;
                });
            } else {
                return null;
            }
        }

        function drawTile(tile) {
            if ('img' in tile) {
                canvasCtx.drawImage(tile.img, tile.left, tile.top, tile.width, tile.height);
                return Promise.resolve(null);
            } else {
                var url = layer.options.noCors ? urlViaCorsProxy(tile.url) : tile.url;
                return fileutils.get(url, {
                        responseType: 'binarystring',
                        maxTries: 3,
                        isResponseSuccessful: function(xhr) {
                            return (xhr.status == 200 && checkImage(xhr.responseBytes)) || xhr.status == 404;
                        },
                        shouldRetry: function(xhr) {
                            return xhr.status < 400 || xhr.status >= 500;
                        }
                    }
                ).then(function(xhr) {
                        if (xhr.responseBytes) {
                            return imageFromString(xhr.responseBytes)
                                .then(function(image) {
                                        canvasCtx.drawImage(image, tile.left, tile.top, tile.width, tile.height);
                                    }
                                );
                        }
                    }
                );
            }
        }

        canvas = L.DomUtil.create('canvas');
        canvas.width = canvasSize.x;
        canvas.height = canvasSize.y;
        canvasCtx = canvas.getContext('2d');

        return _getTempMap(canvasSize.x, canvasSize.y, latLngBounds.getCenter(), zoom)
            .then(function(tempMap_) {
                tempMap = tempMap_;
                var layerCopy = layer.clone();
                var tilesInfo = layerCopy.getTilesInfo();
                tempMap.addLayer(layerCopy);
                return tilesInfo;
            })
            .then(function(tiles) {
                _disposeMap(tempMap);
                console.log('downloading tiles');
                return Promise.all(tiles.map(function(tile) {
                    return drawTile(tile).then(notifyTileLoad.bind(null, 1 / tiles.length));
                }));
            }).then(function() {
                console.log('CANVAS READY');
                return canvas;
            });
    }

    function blendImages(destSize, images) {
        var canvas = L.DomUtil.create('canvas'),
            ctx;
        canvas.width = destSize[0];
        canvas.height = destSize[1];
        ctx = canvas.getContext('2d');
        images.forEach(function(image) {
            ctx.drawImage(image, 0, 0, destSize[0], destSize[1]);
        });
        return canvas;
    }


    /*
    pages: [{latLngBounds: , pixelSize: [width, height]}, postprocess: function(canvas)...]
    */
    function mapToImages(map, pages, zooms, notifyTileLoad) {
        return new Promise(function(resolve, reject) {
            var images = [];
            var pagesCopy = pages.slice(0);
            function mapToImage(page) {
                var layers = getRenderableLayers(map);
                return Promise.all(
                    layers.map(
                        _layerToImage.bind(undefined, page.latLngBounds, zooms, notifyTileLoad)
                    )
                ).then(blendImages.bind(null, page.pixelSize))
                .then(function(canvas) {
                    if (page.postprocess) {
                        canvas = page.postprocess(canvas) || canvas;
                    }
                    return canvas;
                })
                .then(canvasToData);
            }

            function takeNextPage() {
                var page = pagesCopy.shift();
                mapToImage(page)
                .then(function(image) {
                    images.push({width: page.pixelSize[0], height: page.pixelSize[1], data: image});
                })
                .done(function() {
                    console.log('PAGES READY', images.length);
                    if (pagesCopy.length) {
                        takeNextPage();
                    } else {
                        console.log('ALL PAGES READY');
                        resolve(images);
                    }
                }, reject);
            }
            takeNextPage();
        });
    }
    
    function canvasToData(canvas){
        var data = canvas.toDataURL("image/jpeg");
        data = data.substring(data.indexOf(',') + 1);
        data = atob(data);
        return data;
    }

    function getRenderableLayers(map) {
        var layers = [],
            layer_ids = Object.keys(map._layers).sort(),
            layer;
        for (var i=0; i<layer_ids.length; i++) {
            layer = map._layers[layer_ids[i]];
            if (layer.getTilesInfo !== undefined && layer.clone !== undefined) {
                layers.push(layer);
            }
        }
        return layers;
    }

    return {
        getRenderableLayers: getRenderableLayers,
        mapToImages: mapToImages

    };
})();