//@require leaflet
//@require leaflet.markercluster
//@require leaflet.layer.canvas.markers
//@require westraPasses.css


(function() {
    "use strict";
    var MyMarkerClusterGroup = L.MarkerClusterGroup.extend({
            _getExpandedVisibleBounds: function() {
                if (!this.options.removeOutsideVisibleBounds) {
                    return this._mapBoundsInfinite;
                } else if (L.Browser.mobile) {
                    return this._checkBoundsMaxLat(this._map.getBounds());
                }
                return this._checkBoundsMaxLat(this._map.getBounds().pad(0.5)); // Padding expands the bounds by its own dimensions but scaled with the given factor.
            }
        }
    );

    function cached(f) {
        var cache = {};
        return function(arg) {
            if (!(arg in cache)) {
                cache[arg] = f(arg);
            }
            return cache[arg];
        }
    }

    function _iconFromBackground(className) {
        var container = L.DomUtil.create('div', '', document.body),
            el = L.DomUtil.create('div', className, container),
            st = window.getComputedStyle(el),
            url = st.backgroundImage.replace(/^url\("?/, '').replace(/"?\)$/, ''),
            icon;
        container.style.position = 'absolute';
        icon = {'url': url, 'center': [-el.offsetLeft, -el.offsetTop]};
        document.body.removeChild(container);
        container.removeChild(el);
        return icon;
    }

    var iconFromBackground = cached(_iconFromBackground);

    window.mapperOpenDetailsWindow = function(url, width) {
        var left, top, height,
            screenLeft = screen.availLeft || 0,
            screenTop = screen.availTop || 0,
            bordersWidth = 8;
        // if browser window is in the right half of screen, place new window on left half
        if (window.screenX - screenLeft - bordersWidth * 1.5 > width) {
            left = window.screenX - width - bordersWidth * 1.5;
            // if browser window is in the left half of screen, place new window on right half
        } else if (window.screenX + window.outerWidth + width + bordersWidth * 1.5 < screenLeft + screen.availWidth) {
            left = window.screenX + window.outerWidth + bordersWidth;
            // if screen is small or browser window occupies whole screen, place new window on top of current window
        } else {
            left = window.screenX + window.outerWidth / 2 - width / 2;
            if (left < 0) {
                left = 0;
            }
        }
        top = window.screenY;
        height = window.innerHeight;
        var features = 'width=' + width + ',height=' + height + ',left=' + left + ',top=' + top;
        features += ',resizable,scrollbars';
        // to open single instance replace null with some string
        window.open(url, null, features)
            .focus();
    };

    L.Util.AjaxLoader = L.Class.extend({
            initialize: function(url, callback, xhrOptions) {
                this.isLoading = false;
                this.hasLoaded = false;
                this.url = url;
                this.callback = callback;
                this.options = xhrOptions;
            },

            tryLoad: function() {
                if (this.isLoading || this.hasLoaded) {
                    return;
                }
                this.isLoading = true;
                var xhr = new XMLHttpRequest();
                xhr.open('GET', this.url);
                L.extend(xhr, this.options);
                var self = this;
                xhr.onreadystatechange = function() {
                    if (xhr.readyState == 4) {
                        if (xhr.status == 200 && xhr.response) {
                            self.callback(xhr);
                            self.hasLoaded = true;
                        } else {
                            console.log('Failed getting data for geojson layer from url', self.url)
                        }
                        self.isLoading = false;
                    }
                };
                xhr.send();

            }
        }
    );

    L.Util.ajaxLoader = function(url, callback, options) {
        return new L.Util.AjaxLoader(url, callback, options);
    };


    L.GeoJSONAjax = L.GeoJSON.extend({
            options: {
                requestTimeout: 10000,
            },

            initialize: function(url, options) {
                L.GeoJSON.prototype.initialize.call(this, null, options);
                this.url = url;
                this.loader = L.Util.ajaxLoader(url, this.onDataLoaded.bind(this), {
                        responseType: 'json', timeout: this.options.requestTimeout
                    }
                );
            },

            onAdd: function(map) {
                L.GeoJSON.prototype.onAdd.call(this, map);
                this.loader.tryLoad();
            },

            loadData: function() {
                this.loader.tryLoad();
            },

            onDataLoaded: function(xhr) {
                this.addData(xhr.response);
                this.fireEvent('loaded');
            }
        }
    );

    var westraPases = L.Class.extend({
            options: {
                filePasses: 'westra_passes.json',
                fileRegions1: 'westra_regions_geo1.json',
                fileRegions2: 'westra_regions_geo2.json'
            },

            initialize: function(baseUrl, options) {
                L.setOptions(this, options);

                this.markers = new L.TileLayer.Markers();
                this.markers.on('markerclick', this.showPassDescription, this);
                this.passLoader = L.Util.ajaxLoader(baseUrl + this.options.filePasses,
                    this._loadMarkers.bind(this),
                    {responseType: 'json', timeout: 30000}
                );

                this.regions1 = new L.GeoJSONAjax(baseUrl + this.options.fileRegions1, {
                        className: 'westra-region-polygon',
                        onEachFeature: this._setRegionLabel.bind(this, 'regions1')
                    }
                );
                this.regions2 = new L.GeoJSONAjax(baseUrl + this.options.fileRegions2, {
                        className: 'westra-region-polygon',
                        onEachFeature: this._setRegionLabel.bind(this, 'regions2')
                    }
                );
            },

            _makeTooltip: function(marker) {
                var properties = marker.properties,
                    toolTip = properties.grade || '';
                if (toolTip && properties.elevation) {
                    toolTip += ', '
                }
                toolTip += properties.elevation || '';
                if (toolTip) {
                    toolTip = ' (' + toolTip + ')';
                }
                toolTip = properties.name + toolTip;
                toolTip = (properties.is_summit ? 'Вершина ' : 'Перевал ') + toolTip;
                return toolTip;
            },
        
            _makeIcon: function(marker) {
                var className;
                className = 'westra-pass-marker ';
                if (marker.properties.is_summit) {
                    className += 'westra-pass-marker-summit';
                } else {
                    className += 'westra-pass-marker-' + marker.properties.grade_eng;
                }
                if (marker.properties.notconfirmed) {
                    className += ' westra-pass-notconfirmed';
                }
                return iconFromBackground(className);
            },

            _loadMarkers: function(xhr) {
                console.timeEnd('passes load and parse json');
                console.time('make markers array');
                var markers = [],
                    features = xhr.response.features,
                    feature, i, marker, className;
                for (i = 0; i < features.length; i++) {
                    feature = features[i];



                    marker = {
                        latlng: {
                            lat: feature.geometry.coordinates[1],
                            lng: feature.geometry.coordinates[0]
                        },
                        label: feature.properties.name,
                        icon: this._makeIcon,
                        tooltip: this._makeTooltip.bind(this),
                        properties: feature.properties
                    };
                    markers.push(marker);
                }
                console.timeEnd('make markers array');
                console.time('build tree');
                this.markers.addMarkers(markers);
                console.timeEnd('build tree');
            },

            _setRegionLabel: function(layerName, feature, layer) {
                var latlon = layer.getBounds().getCenter();
                var icon = L.divIcon({
                        className: 'westra-region-label',
                        html: '<span>' + feature.properties.name + '</span>'
                    }
                );
                var labelMarker = L.marker(latlon, {icon: icon});
                this[layerName].addLayer(labelMarker);
                function zoomToRegion() {
                    this._map.fitBounds(layer.getBounds());
                }

                layer.on('click', zoomToRegion, this);
                labelMarker.on('click', zoomToRegion, this);
            },

            setZIndex: function(z) {
                this.markers.setZIndex(z);
            },

            setLayersVisibility: function(e) {
                if (!this._map) {
                    return;
                }
                var newZoom;
                if (e && e.zoom !== undefined) {
                    newZoom = e.zoom;
                } else {
                    newZoom = this._map.getZoom();
                }
                if (newZoom < 2) {
                    this._map.removeLayer(this.markers);
                    this._map.removeLayer(this.regions1);
                    this._map.removeLayer(this.regions2);
                } else if (newZoom < 7) {
                    this._map.removeLayer(this.markers);
                    this._map.addLayer(this.regions1);
                    this._map.removeLayer(this.regions2);
                }
                else if (newZoom < 11) {
                    this._map.removeLayer(this.regions1);
                    this._map.addLayer(this.regions2);
                    this._map.removeLayer(this.markers);
                } else {
                    this._map.addLayer(this.markers);
                    this._map.removeLayer(this.regions1);
                    this._map.removeLayer(this.regions2);
                }
            },

            onAdd: function(map) {
                this._map = map;
                this.setLayersVisibility();
                map.on('zoomend', this.setLayersVisibility, this);
                console.time('passes load and parse json');
                this.passLoader.tryLoad();
            },

            onRemove: function() {
                this._map.removeLayer(this.markers);
                this._map.removeLayer(this.regions1);
                this._map.removeLayer(this.regions2);
                this._map.off('zoomend', this.setLayersVisibility, this);
                this._map = null;
            },

            showPassDescription: function(e) {
                if (!this._map) {
                    return
                }
                var properties = e.marker.properties,
                    latLng = e.marker.latlng,
                    url;
                var description = ['<table class="pass-details">'];
                description.push('<tr><td>');
                description.push(properties.is_summit ? 'Вершина ' : 'Перевал ');
                description.push('</td><td>');
                description.push(properties.name || "без названия");
                description.push('</td></tr>');
                if (properties.altnames) {
                    description.push('<tr><td>');
                    description.push('Другие названия');
                    description.push('</td><td>');
                    description.push(properties.altnames);
                    description.push('</td></tr>');
                }
                description.push('<tr><td>');
                description.push('Категория');
                description.push('</td><td>');
                description.push(properties.grade || "неизвестная");
                description.push('</td></tr><tr><td>');
                description.push('Высота');
                description.push('</td><td>');
                description.push(properties.elevation ? (properties.elevation + " м") : "неизвестная");
                description.push('</td></tr>');
                if (!properties.is_summit) {
                    description.push('<tr><td>');
                    description.push('Соединяет');
                    description.push('</td><td>');
                    description.push(properties.connects || "неизвестнo");
                    description.push('</td></tr>');
                }
                description.push('<tr><td>');
                description.push('Характеристика склонов');
                description.push('</td><td>');
                description.push(properties.slopes || "неизвестная");
                description.push('</td></tr>');

                description.push('<tr><td>');
                description.push('Координаты');
                description.push('</td><td>');
                description.push('<table class="westra-passes-description-coords">' +
                    '<tr><td>Широта</td><td>Долгота</td></tr>' +
                    '<tr><td>' + latLng.lat.toFixed(5) + '</td><td>' + latLng.lng.toFixed(5) + '</td>' +
                    '<td><a title="Сохранить" onclick="westraSaveGpx(properties); return false">gpx</a></td>' +
                    '<td><a title="Сохранить" onclick="westraSaveKml(properties); return false">kml</a></td></tr></table>'
                );
                description.push('</td></tr>');

                description.push('<tr><td>');
                description.push('Подтверждено модератором');
                description.push('</td><td>');
                description.push(properties.notconfirmed ? 'нет' : 'да');
                description.push('</td></tr>');

                description.push('<tr><td>');
                description.push('Координаты подтверждены модератором');
                description.push('</td><td>');
                // description.push(feature.properties.notconfirmed ? 'нет' : 'да');
                description.push('пока неизвестно');
                description.push('</td></tr>');

                if (properties.comments || properties.addinfo) {
                    description.push('<tr><td>');
                    description.push('Комментарии');
                    description.push('</td><td>');
                    if (properties.addinfo) {
                        description.push('<p>' + properties.addinfo + '</p>');
                    }
                    if (properties.comments && properties.addinfo != properties.comments) {
                        description.push('<p>' + properties.comments + '</p>');
                    }
                    description.push('</td></tr>');
                }
                description.push('<tr><td>');
                description.push('На сайте Вестры');
                description.push('</td><td>');
                url = 'http://westra.ru/passes/Passes/' + properties.id;
                description.push(
                    '<a href="' + url + '" onclick="mapperOpenDetailsWindow(this.href, 650); return false;">' + url + '</a>'
                );
                description.push('</td></tr>');
                description.push('</table>');

                var popUp = this._map.openPopup(description.join(''), latLng, {maxWidth: 400});
            }

        }
    );

    L.WestraPasses = westraPases;
}());
