const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

/**
 * Renders a document (title + plain text, blank lines between paragraphs) to a PDF to be signed
 *  - US Letter, Helvetica; a signature block (signature and date lines) after the text, on a new page if needed
 *  - returns { bytes, fields }: fields are where the signer's signature and date go, for the e-signature
 *    service - { type: 'signature' | 'date', page (1-based), x, y, width, height } in PDF points from the
 *    page's TOP-LEFT corner
 *
 * WIP: SignWell documents field positions as "pixels" on the page without saying where the origin is; top-left
 *      points are assumed - check against a test document (sc-525) and adjust toServiceField if they land wrong
 */
const PAGE = { width: 612, height: 792 };
const MARGIN = 72;
const BODY = { size: 11, leading: 15 };
const TITLE = { size: 16, leading: 24 };

const SIGNATURE = { width: 220, height: 40 };
const DATE = { width: 120, height: 20 };
const BLOCK_HEIGHT = 110;

// the standard fonts only encode WinAnsi - replace what they can't draw
function clean(text) {
    return String(text || '')
        .replace(/[‘’]/g, "'")
        .replace(/[“”]/g, '"')
        .replace(/[–—]/g, '-')
        .replace(/…/g, '...')
        .replace(/\t/g, '    ')
        .replace(/[^\x0A\x20-\x7E\xA0-\xFF]/g, '');
}

function wrap(text, font, size, width) {
    const lines = [];

    for (const raw of text.split('\n')) {
        let line = '';

        for (const word of raw.split(/ +/)) {
            const next = line ? `${line} ${word}` : word;

            if (line && font.widthOfTextAtSize(next, size) > width) {
                lines.push(line);
                line = word;
            } else {
                line = next;
            }
        }

        lines.push(line);
    }

    return lines;
}

async function render({ title, text, signerName }) {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const width = PAGE.width - 2 * MARGIN;

    let page = pdf.addPage([PAGE.width, PAGE.height]);
    let y = PAGE.height - MARGIN;

    function room(height) {
        if (y - height >= MARGIN) return;

        page = pdf.addPage([PAGE.width, PAGE.height]);
        y = PAGE.height - MARGIN;
    }

    function line(content, { font: f=font, size=BODY.size, leading=BODY.leading }={}) {
        room(leading);
        y -= leading;
        page.drawText(content, { x: MARGIN, y, size, font: f, color: rgb(0, 0, 0) });
    }

    for (const l of wrap(clean(title), bold, TITLE.size, width)) line(l, { font: bold, size: TITLE.size, leading: TITLE.leading });
    y -= BODY.leading / 2;

    const paragraphs = clean(text).split(/\n\s*\n/);

    paragraphs.forEach((paragraph, i) => {
        for (const l of wrap(paragraph.trim(), font, BODY.size, width)) line(l);
        if (i < paragraphs.length - 1) y -= BODY.leading / 2;
    });

    // signature block: kept together
    room(BLOCK_HEIGHT);
    y -= 30;

    const signatureTop = y;
    const lineY = y - SIGNATURE.height;
    const dateX = MARGIN + SIGNATURE.width + 60;

    page.drawLine({ start: { x: MARGIN, y: lineY }, end: { x: MARGIN + SIGNATURE.width, y: lineY }, thickness: 0.75 });
    page.drawLine({ start: { x: dateX, y: lineY }, end: { x: dateX + DATE.width, y: lineY }, thickness: 0.75 });

    page.drawText(clean(signerName ? `Signature - ${signerName}` : 'Signature'), { x: MARGIN, y: lineY - 13, size: 9, font });
    page.drawText('Date', { x: dateX, y: lineY - 13, size: 9, font });

    const pageNumber = pdf.getPageCount();

    const fields = [
        { type: 'signature', page: pageNumber, x: MARGIN, y: PAGE.height - signatureTop, ...SIGNATURE },
        { type: 'date', page: pageNumber, x: dateX, y: PAGE.height - lineY - DATE.height, ...DATE },
    ];

    return { bytes: await pdf.save(), fields };
}

module.exports = {
    PAGE,
    clean,
    render,
}
