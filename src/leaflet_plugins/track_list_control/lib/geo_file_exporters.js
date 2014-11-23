
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

    return {
        saveGpx: saveGpx,
        saveKml: saveKml
    };

})();