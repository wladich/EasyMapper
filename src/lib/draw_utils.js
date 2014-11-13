(function(){
    "use strict";
    function blendMultiplyCanvas(src, dest) {
        var s_data = src.getContext('2d').getImageData(0, 0, src.width, src.height).data;
        var d_image_data = dest.getContext('2d').getImageData(0, 0, src.width, src.height);
        var d_data = d_image_data.data;
        var data_length = s_data.length,
            sr, sg, sb, sa,
            dr, dg, db, da,
            l;
        for (var i=0; i < data_length; i += 4) {
            sa = s_data[i+3];
            if (sa) {
                sr = s_data[i];
                sg = s_data[i+1];
                sb = s_data[i+2];
                dr = d_data[i];
                dg = d_data[i+1];
                db = d_data[i+2];

                l = (dr + dg + db) / 3;
                l = l / 255 * 192 + 63;
                dr = sr / 255 * l;
                dg = sg / 255 * l;
                db = sb / 255 * l;

                d_data[i] = dr;
                d_data[i+1] = dg;
                d_data[i+2] = db;
            }
        }
        dest.getContext('2d').putImageData(d_image_data, 0, 0);
    }

    function drawLinesOnCanvas(canvas, lines, widthPixels, ticksPixelSize) {
        var drawCanvas = document.createElement('canvas');
        drawCanvas.width = canvas.width;
        drawCanvas.height = canvas.height;
        var ctx = drawCanvas.getContext('2d');
        ctx.globalAlpha = 1;
        ctx.lineWidth = widthPixels;
        ctx.lineJoin = 'round';
        lines.forEach(function(line) {
            ctx.strokeStyle = line.color;
            ctx.beginPath();
            ctx.moveTo(line.points[0][0], line.points[0][1]);
            line.points.forEach(function(p) {
                ctx.lineTo(p[0], p[1]);
            });
            ctx.stroke();

            ctx.font = ticksPixelSize + 'px verdana';
            ctx.fillStyle = line.color;
            (line.ticks || []).forEach(function(tick) {
                var m = tick.transformMatrix;
                ctx.setTransform(m[0], m[1], m[2], m[3], tick.position[0], tick.position[1]);
                ctx.fillText(tick.label, 0, ticksPixelSize * 0.3);
            });
            ctx.setTransform(1, 0, 0, 1, 0, 0);
        });
        blendMultiplyCanvas(drawCanvas, canvas);
    }
    window.drawLinesOnCanvas = drawLinesOnCanvas;

})();