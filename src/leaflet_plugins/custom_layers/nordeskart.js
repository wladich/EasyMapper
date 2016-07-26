//@require leaflet

(function() {
    'use strict';

    var maxTokenAge = 600 * 1000; //10 minutes

    var token = null,
        nextTokenUpdate = null,
        supportsLocalStorage = window.Storage && window.localStorage;

    if (supportsLocalStorage) {
        nextTokenUpdate = (parseInt(localStorage.getItem('baatTokenNextUpdate') || "0", 10) || null);
        token = localStorage.getItem('baatToken') || null;
    }
    
    function getToken() {
        var xhr = new XMLHttpRequest(),
            data;
        xhr.open('GET', 'http://www.ut.no/kart/HentBaatToken/', false);
        xhr.send();
        if (xhr.status === 0) {
            return {'error': 'Network error'}
        }
        if (xhr.status !== 200) {
            return {'error': 'HTTP error, status ' + xhr.status}
        }
        try {
            data = JSON.parse(xhr.responseText);
        } catch (e) {
            data = null;
        }
        if (!data || !data.token) {
            return {'error': 'Unexpected server response: "' + xhr.responseText + '"'}
        }
        return data;
    }
    
    L.TileLayer.prototype.options.baatToken = function() {
            if (!nextTokenUpdate || Date.now() > nextTokenUpdate) {
                var res = getToken();
                if (res.error) {
                    console.log('Failed to get BAAT token: ' + res.error);
                    nextTokenUpdate = Date.now() + 10000; // ten seconds
                    token = '';
                } else {
                    nextTokenUpdate = Date.now() + maxTokenAge;
                    token = res.token;
                }
                if (supportsLocalStorage) {
                    localStorage.setItem('baatToken', token);
                    localStorage.setItem('baatTokenNextUpdate', nextTokenUpdate.toString());
                }

            }
            return token;
        }
})();