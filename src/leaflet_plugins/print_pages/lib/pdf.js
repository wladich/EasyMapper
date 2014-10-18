(function() {
"use strict";

    function format(tpl,o) {
        for(var key in o)
            {
                if(o.hasOwnProperty(key))// prevent iteration on any prototype inherited methods
                    tpl = tpl.replace('{'+key+'}',o[key]);
            }
        return tpl;
    }

    window.buildPDF = function buildPDF(resolution, images){
        var pdf = [];
        pdf.push('%PDF-1.3\n');
        pdf.push('1 0 obj\n\
<<\n\
/Pages 2 0 R\n\
/Type /Catalog\n\
>>\n\
endobj\n');
        var kids = [];
        for (var i=0; i< images.length; i++) {
            kids.push(format('{n} 0 R', {n: 3+i*3}));
        }
        kids = kids.join(' ');
        pdf.push(format('2 0 obj\n\
<<\n\
/Type /Pages\n\
/Kids [ {kids} ]\n\
/Count {kids_n}\n\
>>\n\
endobj\n', {kids: kids, kids_n: images.length}));

        for (var i=0; i< images.length; i++) {
            var width = images[i].width / resolution * 72;
            var height = images[i].height / resolution * 72;        
            var page_contents = format('q\n\
{width} 0 0 {height} 0 0 cm\n\
/Im{n0} Do\n\
Q   ', {width: width, height: height, n0: i});
        pdf.push(format('{n} 0 obj\n\
<<\n\
/Type /Page\n\
/Parent 2 0 R\n\
/Resources <<\n\
/XObject << /Im{n0} {n2} 0 R >>\n\
/ProcSet [ /PDF /Text /ImageC ] >>\n\
/MediaBox [0 0 {width} {height}]\n\
/Contents {n1} 0 R\n\
>>\n\
endobj\n', {n0: i, n: 3+i*3, n1: 4+i*3, n2: 5+i*3, width: width, height: height}));

        pdf.push(format('{n} 0 obj\n\
<<\n\
/Length {contents_len}\n\
>>\n\
stream\n\
{contents}\n\
endstream\n\
endobj\n', {n: 4+i*3, contents: page_contents, contents_len: page_contents.length}));
        pdf.push(format('{n} 0 obj\n\
<<\n\
/Type /XObject\n\
/Subtype /Image\n\
/Name /Im{n0}\n\
/Filter [ /DCTDecode ]\n\
/Width {width}\n\
/Height {height}\n\
/ColorSpace /DeviceRGB\n\
/BitsPerComponent 8\n\
/Length {data_len}\n\
>>\n\
stream\n', {n: 5+i*3, n0: i, width: images[i].width, height: images[i].height, data_len: images[i].data.length}));
        pdf.push(images[i].data);
        pdf.push('\n\
endstream\n\
endobj\n');
        }
        pdf.push('trailer\n\
<<\n\
/Root 1 0 R\n\
>>\n\
%%EOF\n');
   
        return pdf.join('');
    }
})();
