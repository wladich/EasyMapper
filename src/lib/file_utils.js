//@require promise 
//@require filesaver

var fileutils = (function() {
    "use strict";
    var maxDownloads = 10,
        defaultXHRTimeout = 20000,
        retryWaitTime = 500;

    /*
        Example:

        get('http://example.com', {
            responseType: 'blob', // [text, arraybuffer, document, json,
                                  // binarystring (nonstandard)], default=text
            maxTries: 3, // default and 0 mean indefinite
            isResponseSuccessful: function(xhr) {return True}, // default -- if status == 200
            shouldRetry: function(xhr) {return True}  // default -- do not retry
        }).done(function(xhr) {console.log(xhr.responseText)})
    */
    var get = (function () {
        var activeDownloads = 0,
            queue = [];

        function isResponseSuccessful(xhr) {
            return xhr.status == 200;
        }

        function processRequest(task) {
            var url = task.url,
                responseType,
                timeout = task.timeout || defaultXHRTimeout,
                xhr = new XMLHttpRequest();
            if (task.responseType=='binarystring') {
                responseType = 'arraybuffer';
            } else {
                responseType = task.responseType || 'text';
            }
                
            xhr.timeout = timeout;
            xhr.open(task.postData ? 'POST' : 'GET', url);
            xhr.responseType = responseType;
            xhr.onreadystatechange = function(e) {
                if (this.readyState == 4) {
                    activeDownloads -= 1;
                    if (task.responseType == 'binarystring') {
                        xhr.responseBytes =  (xhr.status == 200 && xhr.response.byteLength > 0) ? arrayBufferToString(xhr.response) : null;
                    }
                    var success = task.isResponseSuccessful ? task.isResponseSuccessful(xhr) : (xhr.status == 200);
                    if (success) {
                        task.resolve(xhr);
                    } else if (((task.triesCount < (task.maxTries)) || !task.maxTries) && task.shouldRetry && task.shouldRetry(xhr)) {
                        task.triesCount += 1;
                        setTimeout(enqueue, retryWaitTime, task);
                        //enqueue(task);
                    } else {
                        task.reject(xhr);
                    }
                    processQueue();
                }
            };
            activeDownloads += 1;
            xhr.send(task.postData);
        }

        function processQueue() {
            //console.log('ACTIVE DOWNLOADS: ' + activeDownloads);
            //console.log('QUEUE LENGTH: ' + queue.length);
            while (activeDownloads < maxDownloads && queue.length > 0) {
                processRequest(queue.shift());
            }
        }

        function enqueue(task) {
            queue.push(task);
            processQueue();
        }

        var _get = function(url, options) {
            return new Promise(function (resolve, reject) {
                options = options || {};
                options.resolve = resolve;
                options.reject = reject;
                options.url = url;
                options.triesCount = 0;
                enqueue(options);
            });
        };

        return _get;
    })();

    function openFiles(multiple) {
        var fileInput = document.createElement('input');
        document.body.appendChild(fileInput);
        fileInput.type = 'file';
        fileInput.multiple = !!multiple;
        fileInput.style.left = '-100000px';
        var result = new Promise(function(resolve) {
            fileInput.onchange = function() {
                resolve(fileInput.files);
            };
        });
	    fileInput.click();
        return result;
    }

    function readFile(file) {
        return new Promise(function(resolve) {
            var reader = new FileReader();
            reader.onload = function (e) {
                resolve({
                    data: arrayBufferToString(e.target.result),
                    filename: file.name
                });
            };
            reader.readAsArrayBuffer(file);
        });
    }

    function readFiles(files) {
        files = Array.prototype.slice.apply(files);
        return Promise.all(files.map(readFile));
    }

    function intArrayToString(arr) {
        var s = [];
        var chunk;
        for (var i = 0; i < arr.length; i+=4096) {
            chunk = arr.subarray(i, i + 4096);
            chunk = String.fromCharCode.apply(null,chunk);
            s.push(chunk);
        }
        return s.join('');
    }

    function arrayBufferToString(arBuf) {
        var arr = new Uint8Array(arBuf);
        return intArrayToString(arr);
    }

    function saveStringToFile(name, mimeType, s) {
        var length = s.length,
            array = new Uint8Array(new ArrayBuffer(length));
        for (var i = 0; i < length; i++) {
            array[i] = s.charCodeAt(i);
        }
        var blob = new Blob([array], {'type': mimeType});
        saveAs(blob, name);
    }

    function decodeUTF8(s){
        return decodeURIComponent(escape(s));
    }

    function encodeUTF8(s){
        return unescape(encodeURIComponent(s));
    }

    function escapeHtml(s) {
        return s.replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;');

    }

    function showNotification(message, mouseEvent) {
        var el = document.createElement('div');
        el.innerHTML = message;
        el.style = 'color: white; background-color: #333; border-radius: 4px; padding: 0.5em 0.7em; ' +
            'position: absolute; z-index: 100000; font-family: Hevetica, arial; font-size: 11px';
        document.body.appendChild(el);
        var w = el.offsetWidth,
            h = el.offsetHeight,
            x = mouseEvent.clientX - w - 8,
            y= mouseEvent.clientY - h / 2;
        if (x < 0) {
            x = 0
        }
        if (y < 0) {
            y = 0
        }
        el.style.top = y + 'px';
        el.style.left = x + 'px';
        setTimeout(function() {
            el.remove();
        }, 1000);

    }

    function copyToClipboard(s, mouseEvent) {
        try {
            var ta = document.createElement('textarea');
            ta.value = s;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            showNotification('Copied', mouseEvent);
        } catch (e) {
            prompt("Copy to clipboard: Ctrl+C, Enter", s);
        } finally {
            document.body.removeChild(ta);
        }


}

    function stripBom(s) {
        if (s.substr(0, 3) === '\xef\xbb\xbf') {
            s = s.substr(3);
        }
        return s;
    }

    return {
        get: get,
        arrayBufferToString: arrayBufferToString,
        saveStringToFile: saveStringToFile,
        openFiles: openFiles,
        readFiles: readFiles,
        decodeUTF8: decodeUTF8,
        encodeUTF8: encodeUTF8,
        escapeHtml: escapeHtml,
        copyToClipboard: copyToClipboard,
        stripBom: stripBom
    };
})();
