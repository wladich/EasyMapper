(function(){
    "use strict";

    function BinStream(size, littlEndian) {
        this.maxSize = 1024;
        this.dv = new DataView(new ArrayBuffer(this.maxSize));
        this._pos = 0;
        this.size = 0;
        this.littlEndian = littlEndian;
    }

    BinStream.prototype.grow = function() {
        this.maxSize *= 2;
        var old_buffer = this.dv.buffer;
        this.dv = new DataView(new ArrayBuffer(this.maxSize));
        var newAr = new Uint8Array(this.dv.buffer);
        var oldAr = new Uint8Array(old_buffer);
        for (var i = 0; i < oldAr.length; i++) {
            newAr[i] = oldAr[i];
        }
    };
    
    BinStream.prototype.checkSize = function(size) {
        if (this._pos + size >= this.maxSize) {
            this.grow();
        }
        var newPos = this._pos + size;
        this.size = (newPos > this.size) ? newPos : this.size;
    };

    BinStream.prototype.writeUint8 = function(value) {
        this.checkSize(1);
        this.dv.setUint8(this._pos, value);
        this._pos += 1;
    };

    BinStream.prototype.writeInt8 = function(value) {
        this.checkSize(1);
        this.dv.setInt8(this._pos, value);
        this._pos += 1;
    };

    BinStream.prototype.writeInt16 = function(value) {
        this.checkSize(2);
        this.dv.setInt16(this._pos, value, this.littlEndian);
        this._pos += 2;
    };

    BinStream.prototype.writeUint16 = function(value) {
        this.checkSize(2);
        this.dv.setUint16(this._pos, value, this.littlEndian);
        this._pos += 2;
    };

    BinStream.prototype.writeInt32 = function(value) {
        this.checkSize(4);
        this.dv.setInt32(this._pos, value, this.littlEndian);
        this._pos += 4;
    };

    BinStream.prototype.writeUint32 = function(value) {
        this.checkSize(4);
        this.dv.setUint32(this._pos, value, this.littlEndian);
        this._pos += 4;
    };

    BinStream.prototype.writeString = function(s, zeroTerminated) {
        s = unescape(encodeURIComponent(s));
        for (var i= 0; i < s.length; i++) {
            this.writeUint8(s.charCodeAt(i));
        }
        if (zeroTerminated) {
            this.writeUint8(0);
        }
    };

    BinStream.prototype.tell = function() {
        return this._pos;
    };

    BinStream.prototype.seek = function(pos) {
        this._pos = pos;
    };

    BinStream.prototype.getBuffer = function() {
        return this.dv.buffer.slice(0, this.size);
    };


    window.BinStream = BinStream;

})();