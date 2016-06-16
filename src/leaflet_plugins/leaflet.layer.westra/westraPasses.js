//@require leaflet
//@require fileutils
//@require leaflet.markercluster
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
    }

    L.GeoJSONAjax = L.GeoJSON.extend({
            options: {
                requestTimeout: 10000,
            },

            initialize: function(url, options) {
                L.GeoJSON.prototype.initialize.call(this, null, options);
                this.isLoading = false;
                this.hasLoaded = false;
                this.url = url;
            },

            onAdd: function(map) {
                L.GeoJSON.prototype.onAdd.call(this, map);
                this.loadData();
            },

            loadData: function() {
                if (this.isLoading || this.hasLoaded) {
                    return;
                }
                this.isLoading = true;
                var xhr = new XMLHttpRequest();
                xhr.responseType = 'json';
                xhr.timeout = this.options.timeout;
                xhr.open('GET', this.url);
                var self = this;
                xhr.onreadystatechange = function() {
                    if (xhr.readyState == 4) {
                        if (xhr.status == 200 && xhr.response) {
                            self.addData(xhr.response);
                            self.fireEvent('loaded');

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

    var westraPases = L.Class.extend({
            options: {
                filePasses: 'westra_passes.json',
                fileRegions1: 'westra_regions_geo1.json',
                fileRegions2: 'westra_regions_geo2.json'
            },

            initialize: function(baseUrl, options) {
                L.setOptions(this, options);
                this.markers = new MyMarkerClusterGroup({disableClusteringAtZoom: 2});
                this.geojson = new L.GeoJSONAjax(baseUrl + this.options.filePasses, {pointToLayer: this._createMarker});
                this.geojson.on('loaded', function() {
                        this.markers.addLayer(this.geojson);
                        this.placeLabels();
                    }.bind(this)
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

            setLayersVisibility: function() {
                if (!this._map) {
                    return;
                }
                if (this._map.getZoom() < 2) {
                    this._map.removeLayer(this.markers);
                    this._map.removeLayer(this.regions1);
                    this._map.removeLayer(this.regions2);
                } else if (this._map.getZoom() < 7) {
                    this._map.removeLayer(this.markers);
                    this._map.addLayer(this.regions1);
                    this._map.removeLayer(this.regions2);
                }
                else if (this._map.getZoom() < 11) {
                    this._map.removeLayer(this.regions1);
                    this._map.addLayer(this.regions2);
                    this._map.removeLayer(this.markers);
                } else {
                    this._map.addLayer(this.markers);
                    this._map.removeLayer(this.regions1);
                    this._map.removeLayer(this.regions2);
                }
                this.placeLabels();
            },

            _createMarker: function(feature, latLng) {
                var className = 'westra-pass-marker ';
                var url;
                if (feature.properties.is_summit) {
                    className += 'westra-pass-marker-summit';
                } else {
                    className += 'westra-pass-marker-' + feature.properties.grade_eng;
                }
                if (feature.properties.notconfirmed) {
                    className += ' westra-pass-notconfirmed';
                }
                var toolTip = feature.properties.grade || '';
                if (toolTip && feature.properties.elevation) {
                    toolTip += ', '
                }
                toolTip += feature.properties.elevation || '';
                if (toolTip) {
                    toolTip = ' (' + toolTip + ')';
                }
                toolTip = feature.properties.name + toolTip;
                toolTip = (feature.properties.is_summit ? 'Вершина ' : 'Перевал ') + toolTip;
                var icon = L.divIcon(
                    {
                        className: 'westra-pass-container',
                        html: '<div class="' + className + '"></div>' +
                        '<div class="westra-pass-label">' + feature.properties.name + '</div>' +
                        '<div class="westra-pass-tooltip"><div>' + toolTip + '</div></div>'
                    }
                );
                var marker = L.marker(latLng, {icon: icon});
                var description = ['<table class="pass-details">'];
                description.push('<tr><td>');
                description.push(feature.properties.is_summit ? 'Вершина ' : 'Перевал ');
                description.push('</td><td>');
                description.push(feature.properties.name || "без названия");
                description.push('</td></tr>');
                if (feature.properties.altnames) {
                    description.push('<tr><td>');
                    description.push('Другие названия');
                    description.push('</td><td>');
                    description.push(feature.properties.altnames);
                    description.push('</td></tr>');
                }
                description.push('<tr><td>');
                description.push('Категория');
                description.push('</td><td>');
                description.push(feature.properties.grade || "неизвестная");
                description.push('</td></tr><tr><td>');
                description.push('Высота');
                description.push('</td><td>');
                description.push(feature.properties.elevation ? (feature.properties.elevation + " м") : "неизвестная");
                description.push('</td></tr>');
                if (!feature.properties.is_summit) {
                    description.push('<tr><td>');
                    description.push('Соединяет');
                    description.push('</td><td>');
                    description.push(feature.properties.connects || "неизвестнo");
                    description.push('</td></tr>');
                }
                description.push('<tr><td>');
                description.push('Характеристика склонов');
                description.push('</td><td>');
                description.push(feature.properties.slopes || "неизвестная");
                description.push('</td></tr>');

                description.push('<tr><td>');
                description.push('Подтверждено модератором');
                description.push('</td><td>');
                description.push(feature.properties.notconfirmed ? 'нет' : 'да');
                description.push('</td></tr>');

                description.push('<tr><td>');
                description.push('Координаты подтверждены модератором');
                description.push('</td><td>');
                // description.push(feature.properties.notconfirmed ? 'нет' : 'да');
                description.push('пока неизвестно');
                description.push('</td></tr>');

                if (feature.properties.comments || feature.properties.addinfo) {
                    description.push('<tr><td>');
                    description.push('Комментарии');
                    description.push('</td><td>');
                    if (feature.properties.addinfo) {
                        description.push('<p>' + feature.properties.addinfo + '</p>');
                    }
                    if (feature.properties.comments && feature.properties.addinfo != feature.properties.comments) {
                        description.push('<p>' + feature.properties.comments + '</p>');
                    }
                    description.push('</td></tr>');
                }
                description.push('<tr><td>');
                description.push('На сайте Вестры');
                description.push('</td><td>');
                url = 'http://westra.ru/passes/Passes/' + feature.properties.id;
                description.push(
                    '<a href="' + url + '" onclick="mapperOpenDetailsWindow(this.href,650); return false;">' + url + '</a>'
                );
                description.push('</td></tr>');
                description.push('</table>');
                marker.bindPopup(description.join(''), {maxWidth: 400});
                return marker;
            },

            placeLabels: function() {
                var yOffsets = [-7, -12, -17, -2, 3],
                    xOffsets,
                    markers = [],
                    rectangles = [],
                    marker, i, j, k,
                    center, icon, w, h, label,
                    minIntersectionSum, bestOffsetX, bestOffsetY, offsetX, offsetY, testRect, s;
                for (k in this.markers._featureGroup._layers) {
                    markers.push(this.markers._featureGroup._layers[k]);
                }
                for (i = 0; i < markers.length; i++) {
                    marker = markers[i];
                    center = this._map.project(marker.getLatLng());
                    icon = marker._icon.getElementsByClassName('westra-pass-marker')[0];
                    w = icon.offsetWidth;
                    h = icon.offsetHeight;
                    rectangles.push([center.x - w / 2, center.y - h / 2, center.x + w / 2, center.y + h / 2]);
                }

                function calcIntersectionSum(rect) {
                    var intersectionSum = 0,
                        j, left, top, right, bottom, rect2;
                    for (j = 0; j < rectangles.length; j++) {
                        rect2 = rectangles[j];
                        left = Math.max(rect[0], rect2[0]);
                        right = Math.min(rect[2], rect2[2]);
                        top = Math.max(rect[1], rect2[1]);
                        bottom = Math.min(rect[3], rect2[3]);
                        if (top < bottom && left < right) {
                            intersectionSum += ((right - left) * (bottom - top));
                        }
                    }
                    return intersectionSum;
                }

                for (i = 0; i < markers.length; i++) {
                    marker = markers[i];
                    center = this._map.project(marker.getLatLng());
                    label = marker._icon.getElementsByClassName('westra-pass-label')[0];
                    w = label.offsetWidth;
                    h = label.offsetHeight;
                    xOffsets = [10, -8 - w];
                    minIntersectionSum = 1e100;
                    for (j = 0; j < 2; j++) {
                        offsetX = xOffsets[j];
                        for (k = 0; k < yOffsets.length; k++) {
                            offsetY = yOffsets[k];
                            testRect = [center.x + offsetX - 2, center.y + offsetY - 2,
                                center.x + offsetX + w + 2, center.y + offsetY + h + 2];
                            s = calcIntersectionSum(testRect);
                            if (s < minIntersectionSum) {
                                minIntersectionSum = s;
                                bestOffsetX = offsetX;
                                bestOffsetY = offsetY;
                                if (s === 0) {
                                    break;
                                }
                            }
                        }
                        if (s === 0) {
                            break;
                        }
                    }
                    label.style.left = bestOffsetX + 'px';
                    label.style.top = bestOffsetY + 'px';
                    rectangles.push([center.x + bestOffsetX, center.y + bestOffsetY,
                        center.x + bestOffsetX + w, center.y + bestOffsetY + h]
                    )
                }
            },

            onAdd: function(map) {
                this._map = map;
                this.setLayersVisibility();
                map.on('zoomend', this.setLayersVisibility, this);
                map.on('zoomend', this.placeLabels, this);
                map.on('moveend', this.placeLabels, this);
                map.on('viewreset', this.placeLabels, this);
                this.geojson.loadData();
            },

            onRemove: function() {
                this._map.removeLayer(this.markers);
                this._map.removeLayer(this.regions1);
                this._map.removeLayer(this.regions2);
                this._map.off('zoomend', this.setLayersVisibility, this);
                this._map.off('zoomend', this.placeLabels, this);
                this._map.off('moveend', this.placeLabels, this);
                this._map.off('viewreset', this.placeLabels, this);
                this._map = null;
            }

        }
    );

    L.WestraPasses = westraPases;
}());
