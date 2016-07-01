//@require fileutils


var geoExporters = (function() {
    "use strict";

    function saveGpx(segments, name) {
        var points,
            gpx = [],
            x, y,
            filename;
        if (!segments || segments.length === 0) {
            return null;
        }

        segments.forEach(function(points) {
            if (points.length > 1) {
                gpx.push('\t\t<trkseg>');
                points.forEach(function(p) {
                    x = p.lng.toFixed(6);
                    y = p.lat.toFixed(6);
                    gpx.push('\t\t\t<trkpt lat="'+ y +'" lon="' + x + '"></trkpt>');
                });
                gpx.push('\t\t</trkseg>');
            }
        });
        if (gpx.length === 0) {
            return null;
        }
        name = name || 'Track';
        name = fileutils.encodeUTF8(name);
        gpx.unshift(
                    '<?xml version="1.0" encoding="UTF-8" standalone="no" ?>',
                    '<gpx xmlns="http://www.topografix.com/GPX/1/1" creator="http://nakarte.tk" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">',
                    '\t<trk>',
                    '\t\t<name>' + name + '</name>'
        );
        gpx.push('\t</trk>', '</gpx>');
        gpx = gpx.join('\n');
        return gpx;
    }


    function saveKml(segments, name) {
        var points,
            kml = [],
            x, y,
            filename;
        if (!segments || segments.length === 0) {
            return null;
        }

        segments.forEach(function(points, i) {
            if (points.length > 1) {
                kml.push('\t\t<Placemark>',
                         '\t\t\t<name>Line ' + (i + 1) +  '</name>',
                         '\t\t\t<LineString>',
                         '\t\t\t\t<tessellate>1</tessellate>',
                         '\t\t\t\t<coordinates>'
                );
                points.forEach(function(p) {
                    x = p.lng.toFixed(6);
                    y = p.lat.toFixed(6);
                    kml.push('\t\t\t\t\t' + x + ',' + y);
                });
                kml.push('\t\t\t\t</coordinates>',
                         '\t\t\t</LineString>',
                         '\t\t</Placemark>'
                );
            }
        });
        if (kml.length === 0) {
            return null;
        }
        name = name || 'Track';
        name = fileutils.encodeUTF8(name);
        kml.unshift(
                    '<?xml version="1.0" encoding="UTF-8"?>',
                    '<kml xmlns="http://earth.google.com/kml/2.2">',
                    '\t<Document>',
                    '\t\t<name>' + name + '</name>'
        );
        kml.push('\t</Document>', '</kml>');
        kml = kml.join('\n');
        return kml;
    }

    function packNumber(n) {
        var bytes = [];
        if (n >= -64 && n <= 63) {
            n += 64;
            bytes.push(n);
        } else if (n >= -8192 && n <= 8191) {
            n += 8192;
            bytes.push((n & 0x7f) | 0x80);
            bytes.push(n >> 7);
/*        } else if (n >= -2097152 && n <= 2097151) {
            n += 2097152;
            bytes.push((n & 0x7f) | 0x80);
            bytes.push(((n >> 7) & 0x7f) | 0x80);
            bytes.push(n >> 14);
*/
        } else if (n >= -1048576 && n <= 1048575) {
            n += 1048576;
            bytes.push((n & 0x7f) | 0x80);
            bytes.push(((n >> 7) & 0x7f) | 0x80);
            bytes.push(n >> 14);
        } else if (n >= -268435456 && n <= 268435455) {
            n += 268435456;
            bytes.push((n & 0x7f) | 0x80);
            bytes.push(((n >> 7) & 0x7f) | 0x80);
            bytes.push(((n >> 14) & 0x7f) | 0x80);
            bytes.push(n >> 21);
        } else {
            throw new Error('Number ' + n + ' too big to pack in 29 bits');
        }
        return String.fromCharCode.apply(null, bytes);
    }


    function encodeUrlSafeBase64(s) {
        return (btoa(s)
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '')
        );
    }

    function saveToString(segments, name, color, measureTicksShown) {
        var stringified = [];
        name = fileutils.encodeUTF8(name);
        stringified.push(packNumber(name.length));
        stringified.push(name);

        var arcUnit = ((1 << 24) - 1) / 360;
        segments = segments.filter(function(segment) {
            return segment.length > 1;
        });

        if (segments.length === 0) {
            return null;
        }

        stringified.push(packNumber(segments.length));
        segments.forEach(function(points) {
            var lastX = 0,
                lastY = 0,
                x, y,
                deltaX, deltaY,
                p;
            stringified.push(packNumber(points.length));
            for (var i=0, len=points.length; i < len; i++) {
                p = points[i];
                x = Math.round(p.lng * arcUnit);
                y = Math.round(p.lat * arcUnit);
                deltaX = x - lastX;
                deltaY = y - lastY;
                stringified.push(packNumber(deltaX));
                stringified.push(packNumber(deltaY));
                lastX = x;
                lastY = y;
            }
        });
        stringified.push(packNumber(+color || 0));
        stringified.push(packNumber(measureTicksShown ? 1 : 0));
        return encodeUrlSafeBase64(stringified.join(''));
    }

    return {
        saveGpx: saveGpx,
        saveKml: saveKml,
        saveToString: saveToString,
    };

})();