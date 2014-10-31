(function() {
    "use strict";
    var proxy = 'http://proxy.nakarte.tk/';
    window.urlViaCorsProxy = function(url) {
        return proxy + url.replace(/^(https?):\/\//, '$1/');
    };
})();