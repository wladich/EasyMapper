(function() {
    "use strict";
    var proxy = 'http://proxy.wladich.tk/';
    window.urlViaCorsProxy = function(url) {
        return proxy + url.replace(/^https?:\/\//, '');
    };
})();