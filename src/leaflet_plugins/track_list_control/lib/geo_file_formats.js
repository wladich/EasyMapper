//@require js-unzip
//@require zip-inflate
//@require fileutils
(function() {
    "use strict";
    
    function xmlGetNodeText(node) {
        if (node) {
            return Array.prototype.slice.call(node.childNodes)
                .map(function(node) {
                    return node.nodeValue;
                })
                .join('');
            }
    }
    

    function parseGpx(txt, name) {
        var error;
        function getSegmentPoints(segment_element) {
            var points_elements = segment_element.getElementsByTagName('trkpt');
            var points = [];
            for (var i = 0; i < points_elements.length; i++) {
                var point_element = points_elements[i];
                var lat = parseFloat(point_element.getAttribute('lat'));
                var lng = parseFloat(point_element.getAttribute('lon'));
                if (isNaN(lat) || isNaN(lng)) {
                    error = 'CORRUPT';
                    break;
                }
                points.push({lat: lat, lng: lng});
            }
            return points;
        }
        
        var getTrackSegments = function(xml) {
            var segments = [];
            var segments_elements = xml.getElementsByTagName('trkseg');
            for (var i = 0; i < segments_elements.length; i++) {
                var segment_points = getSegmentPoints(segments_elements[i]);
                if (segment_points.length) {
                    segments.push(segment_points);
                }
            }
            return segments;
        };

        /*    
        var getWaypoints = function(xml) {
            var waypoint_elements = xml.getElementsByTagName('wpt');
            var waypoints = [];
            for (var i=0; i < waypoint_elements.length; i++) {
                var waypoint_element = waypoint_elements[i];
                var waypoint = {};
                waypoint.lat = parseFloat(waypoint_element.getAttribute('lat'));
                waypoint.lng = parseFloat(waypoint_element.getAttribute('lon'));
                if (isNaN(waypoint.lat) || isNaN(waypoint.lng)) {
                    error = 'CORRUPT';
                    continue;
                }
                waypoint.name = decodeUTF8(L.Util.xmlGetNodeText(waypoint_element.getElementsByTagName('name')[0]));
                waypoint.symbol_name = L.Util.xmlGetNodeText(waypoint_element.getElementsByTagName('sym')[0]);
                waypoints.push(waypoint);
            }
            return waypoints;
        };
        */
        
        // remove namespaces
        txt = txt.replace(/<([^ >]+):([^ >]+)/g, '<$1_$2');
        var dom = (new DOMParser()).parseFromString(txt,"text/xml");
        if (dom.documentElement.nodeName == 'parsererror') {
            return null;
        }
        if (dom.getElementsByTagName('gpx').length === 0) {
            return null;
        }
        return [{
            name: name,
            tracks: getTrackSegments(dom),
            //points: getWaypoints(dom),
            error: error}];
    }


    function parseOziPlt(txt, name) {
        var error;
        var segments = [];
        var lines = txt.split('\n');
        if (lines[0].indexOf('OziExplorer Track Point File') !== 0) {
            return null;
        }
        var expected_points_num = parseInt(lines[5], 10);
        var current_segment = [];
        var total_points_num = 0;
        for (var i = 6; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line) {
                continue;
            }
            var fields = line.split(',');
            var lat = parseFloat(fields[0]);
            var lon = parseFloat(fields[1]);
            var is_start_of_segment = parseInt(fields[2], 10);
            if (isNaN(lat) || isNaN(lon) || isNaN(is_start_of_segment)) {
                error = 'CORRUPT';
                break;
            }
            if (is_start_of_segment) {
                current_segment = [];
            }
            if (!current_segment.length) {
                segments.push(current_segment);
            }
            current_segment.push({lat: lat, lng:lon});
            total_points_num += 1;
        }
        if (isNaN(expected_points_num) || expected_points_num != total_points_num) {
            error = 'CORRUPT';
        }
        return [{name: name, tracks: segments, error: error}];
    }

    function parseKml(txt, name) {
        var error;
        var getSegmentPoints = function(coordinates_element){
            // convert multiline text value of tag to single line
            var coordinates_string = xmlGetNodeText(coordinates_element);
            var points_strings = coordinates_string.split(/\s+/);
            var points = [];
            for (var i = 0; i < points_strings.length; i++) {
                if (points_strings[i].length) {
                    var point = points_strings[i].split(',');
                    var lat = parseFloat(point[1]);
                    var lng = parseFloat(point[0]);
                    if (isNaN(lat) || isNaN(lng)) {
                        error = 'CORRUPT';
                        break;
                    }
                    points.push({lat: lat, lng: lng});
                }
            }
            return points;
        };
        
        var getTrackSegments = function(xml) {
            var segments_elements = xml.getElementsByTagName('LineString');
            var segments = [];
            for (var i = 0; i < segments_elements.length; i++) {
                var coordinates_element = segments_elements[i].getElementsByTagName('coordinates');
                if (coordinates_element.length) {
                    var segment_points = getSegmentPoints(coordinates_element[0]);
                    if (segment_points.length) {
                        segments.push(segment_points);
                    }
                }
            }
            return segments;
        };

        txt = txt.replace(/<([^ >]+):([^ >]+)/g, '<$1_$2');
        var dom = (new DOMParser()).parseFromString(txt,"text/xml");
        if (dom.documentElement.nodeName == 'parsererror') {
            return null;
        }
        if (dom.getElementsByTagName('Document').length === 0) {
            return null;
        }

        return [{name: name, tracks: getTrackSegments(dom), error: error}];
    }

    function parseKmz(txt, name) {
        var uncompressed;
        var unzipper = new JSUnzip(txt);
        if (!unzipper.isZipFile()) {
            return null;
        }
        unzipper.readEntries();
        for (var i=0; i < unzipper.entries.length; i++) {
            var entry = unzipper.entries[i];
            if (entry.fileName === 'doc.kml') {
                if (entry.uncompressedSize > 10000000) {
                    return null;
                }
                if (entry.compressionMethod === 0) {
                    uncompressed = entry.data;
                } else if (entry.compressionMethod === 8) {
                    uncompressed = RawDeflate.inflate(entry.data);
                } else {
                    return null;
                }
                var geodata = parseKml(uncompressed, 'doc.kml');
                if (geodata) {
                    geodata[0].name = name;
                } else {
                    geodata = [{name: name, error: 'CORRUPT'}];
                }
                return geodata;
            }
        }
        return null;
    }

    function parseYandexRulerString(s) {
        var last_lat = 0;
        var last_lng = 0;
        var error;
        var points = [];
        s = s.replace(/%2C/ig, ',');
        var points_str = s.split('~');
        for (var i=0; i < points_str.length; i++) {
            var point = points_str[i].split(',');
            var lng = parseFloat(point[0]);
            var lat = parseFloat(point[1]);
            if (isNaN(lat) || isNaN(lng)) {
                error = 'CORRUPT';
                break;
            }
            last_lng += lng;
            last_lat += lat;
            points.push({lat: last_lat, lng: last_lng});
        }
        return {error: error, points: points};
    }

    function parseYandexRulerUrl(s) {
        var re = /^\s*https?:\/\/maps\.yandex\..+[?&]rl=([^&]+).*?$/;
        if (!(re.test(s))) {
            return null;
        }
        s = s.replace(re, "$1");
        var res = parseYandexRulerString(s);
        return [{name: 'Yandex ruler', error: res.error, tracks: [res.points]}];
    }

    function parseZip(txt, name) {
        var unzipper = new JSUnzip(txt);
        if (!unzipper.isZipFile()) {
            return null;
        }
        unzipper.readEntries();
        var geodata_array = [];
        for (var i=0; i < unzipper.entries.length; i++) {
            var entry = unzipper.entries[i];
            var uncompressed;
            if (entry.compressionMethod === 0) {
                uncompressed = entry.data;
            } else if (entry.compressionMethod === 8) {
                uncompressed = RawDeflate.inflate(entry.data);
            } else {
                return null;
            }
            var file_name = name + '/' + entry.fileName;
            var geodata = parseGeoFile(file_name, uncompressed);
            geodata_array.push.apply(geodata_array, geodata);
        }
        return geodata_array;
    }

    function parseYandexMap(txt) {
        var start_tag = '<script id="vpage" type="application/json">';
        var json_start = txt.indexOf(start_tag);
        if (json_start === -1) {
            return null;
        }
        json_start += start_tag.length;
        var json_end = txt.indexOf('</script>', json_start);
        if (json_end === -1) {
            return null;
        }
        var map_data = txt.substring(json_start, json_end);
        map_data = JSON.parse(map_data);
        console.log(map_data);
        if (!('request' in map_data)) {
            return null;
        }
        var name = 'YandexMap';
        var segments = [];
        var error;
        if (map_data.vpage && map_data.vpage.data && map_data.vpage.data.objects && map_data.vpage.data.objects.length) {
            if (map_data.vpage.data.name) {
                name += ': ' + decodeUTF8(map_data.vpage.data.name);
            }
            map_data.vpage.data.objects.forEach(function(obj){
                if (obj.pts && obj.pts.length) {
                    var segment = [];
                    for (var i=0; i< obj.pts.length; i++) {
                        var pt = obj.pts[i];
                        var lng = parseFloat(pt[0]);
                        var lat = parseFloat(pt[1]);
                        if (isNaN(lat) || isNaN(lng)) {
                            error = 'CORRUPT';
                            break;
                        }
                        segment.push({lat: lat, lng:lng});
                    }
                    if (segment.length) {
                        segments.push(segment);
                    }
                }
            });
        }
        if (map_data.request.args && map_data.request.args.rl) {
            var res = parseYandexRulerString(map_data.request.args.rl);
            error = error || res.error;
            if (res.points && res.points.length) {
                segments.push(res.points);
            }
        }
        return [{name: name, error: error, tracks: segments}];
    }

    function parseGeoFile(name, data) {
        var parsers = [
            parseKmz,
            parseZip,
            parseGpx,
            parseOziPlt,
            parseKml,
            parseYandexRulerUrl,
            parseYandexMap
        ];
        for (var i=0; i<parsers.length; i++) {
            var parsed = parsers[i](data, name);
            if (parsed !== null) {
                return parsed;
            }
        }
        return [{name: name, error: 'UNSUPPORTED'}];
    }

    window.parseGeoFile = parseGeoFile;
})();