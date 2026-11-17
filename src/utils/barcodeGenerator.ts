/**
 * Barcode Generator Utility for SIPRAMA MAN 11 Jakarta
 * Generates standards-compliant Code 128 barcodes as SVG and handles auto-generation of unique item barcodes.
 */

// Code 128 patterns (widths of alternating bars and spaces, 6 elements each, ending with stop pattern)
const CODE128_PATTERNS: number[][] = [
  [2, 1, 2, 2, 2, 2], // 0
  [2, 2, 2, 1, 2, 2], // 1
  [2, 2, 2, 2, 2, 1], // 2
  [1, 2, 1, 2, 2, 3], // 3
  [1, 2, 1, 3, 2, 2], // 4
  [1, 3, 1, 2, 2, 2], // 5
  [1, 2, 2, 2, 1, 3], // 6
  [1, 2, 2, 3, 1, 2], // 7
  [1, 3, 2, 2, 1, 2], // 8
  [2, 2, 1, 2, 1, 3], // 9
  [2, 2, 1, 3, 1, 2], // 10
  [2, 3, 1, 2, 1, 2], // 11
  [1, 1, 2, 2, 3, 2], // 12
  [1, 2, 2, 1, 3, 2], // 13
  [1, 2, 2, 2, 3, 1], // 14
  [1, 1, 3, 2, 2, 2], // 15
  [1, 2, 3, 1, 2, 2], // 16
  [1, 2, 3, 2, 2, 1], // 17
  [2, 2, 3, 2, 1, 1], // 18
  [2, 2, 1, 1, 3, 2], // 19
  [2, 2, 1, 2, 3, 1], // 20
  [2, 1, 3, 2, 1, 2], // 21
  [2, 2, 3, 1, 1, 2], // 22
  [3, 1, 2, 1, 3, 1], // 23
  [3, 1, 1, 2, 2, 2], // 24
  [3, 2, 1, 1, 2, 2], // 25
  [3, 2, 1, 2, 2, 1], // 26
  [3, 1, 2, 2, 1, 2], // 27
  [3, 2, 2, 1, 1, 2], // 28
  [3, 2, 2, 2, 1, 1], // 29
  [2, 1, 2, 1, 2, 3], // 30
  [2, 1, 2, 3, 2, 1], // 31
  [2, 3, 2, 1, 2, 1], // 32
  [1, 1, 1, 3, 2, 3], // 33
  [1, 3, 1, 1, 2, 3], // 34
  [1, 3, 1, 3, 2, 1], // 35
  [1, 1, 2, 3, 1, 3], // 36
  [1, 3, 2, 1, 1, 3], // 37
  [1, 3, 2, 3, 1, 1], // 38
  [2, 1, 1, 3, 1, 3], // 39
  [2, 3, 1, 1, 1, 3], // 40
  [2, 3, 1, 3, 1, 1], // 41
  [1, 1, 2, 1, 3, 3], // 42
  [1, 1, 2, 3, 3, 1], // 43
  [1, 3, 2, 1, 3, 1], // 44
  [1, 1, 3, 1, 2, 3], // 45
  [1, 1, 3, 3, 2, 1], // 46
  [1, 3, 3, 1, 2, 1], // 47
  [3, 1, 3, 1, 2, 1], // 48
  [2, 1, 1, 3, 3, 1], // 49
  [2, 3, 1, 1, 3, 1], // 50
  [2, 1, 3, 1, 1, 3], // 51
  [2, 1, 3, 3, 1, 1], // 52
  [2, 1, 3, 1, 3, 1], // 53
  [3, 1, 1, 1, 2, 3], // 54
  [3, 1, 1, 3, 2, 1], // 55
  [3, 3, 1, 1, 2, 1], // 56
  [3, 1, 2, 1, 1, 3], // 57
  [3, 1, 2, 3, 1, 1], // 58
  [3, 3, 2, 1, 1, 1], // 59
  [3, 1, 4, 1, 1, 1], // 60
  [2, 2, 1, 4, 1, 1], // 61
  [4, 3, 1, 1, 1, 1], // 62
  [1, 1, 1, 2, 2, 4], // 63
  [1, 1, 1, 4, 2, 2], // 64
  [1, 2, 1, 1, 2, 4], // 65
  [1, 2, 1, 4, 2, 1], // 66
  [1, 4, 1, 1, 2, 2], // 67
  [1, 4, 1, 2, 2, 1], // 68
  [1, 1, 2, 2, 1, 4], // 69
  [1, 1, 2, 4, 1, 2], // 70
  [1, 2, 2, 1, 1, 4], // 71
  [1, 2, 2, 4, 1, 1], // 72
  [1, 4, 2, 1, 1, 2], // 73
  [1, 4, 2, 2, 1, 1], // 74
  [2, 4, 1, 2, 1, 1], // 75
  [2, 2, 1, 1, 1, 4], // 76
  [4, 1, 3, 1, 1, 1], // 77
  [2, 4, 1, 1, 1, 2], // 78
  [1, 3, 4, 1, 1, 1], // 79
  [1, 1, 1, 2, 4, 2], // 80
  [1, 2, 1, 1, 4, 2], // 81
  [1, 2, 1, 2, 4, 1], // 82
  [1, 1, 4, 2, 1, 2], // 83
  [1, 2, 4, 1, 1, 2], // 84
  [1, 2, 4, 2, 1, 1], // 85
  [4, 1, 1, 2, 1, 2], // 86
  [4, 2, 1, 1, 1, 2], // 87
  [4, 2, 1, 2, 1, 1], // 88
  [2, 1, 2, 1, 4, 1], // 89
  [2, 1, 4, 1, 2, 1], // 90
  [4, 1, 2, 1, 2, 1], // 91
  [1, 1, 1, 1, 4, 3], // 92
  [1, 1, 1, 3, 4, 1], // 93
  [1, 3, 1, 1, 4, 1], // 94
  [1, 1, 4, 1, 1, 3], // 95
  [1, 1, 4, 3, 1, 1], // 96
  [4, 1, 1, 1, 1, 3], // 97
  [4, 1, 1, 3, 1, 1], // 98
  [1, 1, 3, 1, 4, 1], // 99
  [1, 1, 4, 1, 3, 1], // 100
  [3, 1, 1, 1, 4, 1], // 101
  [4, 1, 1, 1, 3, 1], // 102
  [2, 1, 1, 4, 1, 2], // 103 (Start Code A)
  [2, 1, 1, 2, 1, 4], // 104 (Start Code B)
  [2, 1, 1, 2, 3, 2], // 105 (Start Code C)
  [2, 3, 3, 1, 1, 1, 2], // 106 (Stop pattern: 7 elements)
];

/**
 * Generate a unique, professional barcode string for Scout Inventory
 * Format: BRG-0171-XXXX or KBU-XXXX (Gudep 06.171 / 06.172 MAN 11 Jkt)
 */
export function generateAutoBarcode(prefix = 'BRG', index?: number): string {
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const serial = index !== undefined ? String(index).padStart(3, '0') : randomSuffix;
  return `${prefix}-0171-${serial}`;
}

/**
 * Generates an SVG string representation of Code 128 (Subset B) for the given text.
 * Suitable for embedding in HTML, printing sticker labels, and physical scanning.
 */
export function generateCode128Svg(
  text: string,
  options: {
    height?: number;
    barWidth?: number;
    showText?: boolean;
    includeMargins?: boolean;
  } = {}
): string {
  const {
    height = 60,
    barWidth = 2,
    showText = true,
    includeMargins = true,
  } = options;

  const cleanText = text.trim() || 'BARCODE';

  // Code 128B encoding
  const codes: number[] = [104]; // Start Code B
  let checksum = 104;

  for (let i = 0; i < cleanText.length; i++) {
    const charCode = cleanText.charCodeAt(i);
    const value = charCode - 32; // Code 128B maps ASCII 32..126 to 0..94
    if (value >= 0 && value <= 95) {
      codes.push(value);
      checksum += value * (i + 1);
    } else {
      // Fallback for unsupported chars
      codes.push(0);
      checksum += 0;
    }
  }

  const checkDigit = checksum % 103;
  codes.push(checkDigit);
  codes.push(106); // Stop code

  // Build bar pattern
  const bars: { isBar: boolean; width: number }[] = [];
  for (let cIdx = 0; cIdx < codes.length; cIdx++) {
    const code = codes[cIdx];
    const pattern = CODE128_PATTERNS[code];
    if (!pattern) continue;

    for (let pIdx = 0; pIdx < pattern.length; pIdx++) {
      const isBar = pIdx % 2 === 0;
      bars.push({ isBar, width: pattern[pIdx] * barWidth });
    }
  }

  // Calculate total width
  const quietZone = includeMargins ? 15 * barWidth : 4;
  const barsWidth = bars.reduce((sum, b) => sum + b.width, 0);
  const totalWidth = barsWidth + quietZone * 2;
  const totalHeight = showText ? height + 24 : height;

  // Generate SVG Rects
  let currentX = quietZone;
  let rectsSvg = '';
  for (const bar of bars) {
    if (bar.isBar) {
      rectsSvg += `<rect x="${currentX}" y="4" width="${bar.width}" height="${height}" fill="#111111" />`;
    }
    currentX += bar.width;
  }

  const textSvg = showText
    ? `<text x="${totalWidth / 2}" y="${height + 18}" font-family="'Courier New', Courier, monospace" font-size="12" font-weight="bold" fill="#111111" text-anchor="middle" letter-spacing="1.5">${cleanText}</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="${totalWidth}" height="${totalHeight}">
    <rect width="${totalWidth}" height="${totalHeight}" fill="#FFFFFF" />
    ${rectsSvg}
    ${textSvg}
  </svg>`;
}

/**
 * Downloads the barcode as an SVG file
 */
export function downloadBarcodeSvgFile(barcodeText: string, itemName: string) {
  const svg = generateCode128Svg(barcodeText);
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = (itemName || 'barang').replace(/[^a-zA-Z0-9-_]/g, '_');
  a.download = `Barcode_${barcodeText}_${safeName}.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Opens a print-friendly window to print a physical barcode sticker label
 */
export function printBarcodeSticker(barcodeText: string, itemName: string, location?: string) {
  const svg = generateCode128Svg(barcodeText, { height: 50, barWidth: 1.8 });
  const printWindow = window.open('', '_blank', 'width=450,height=400');
  if (!printWindow) return;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Stiker Barcode - ${barcodeText}</title>
        <style>
          @page { size: auto; margin: 4mm; }
          body {
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 10px;
            margin: 0;
            background: #fff;
          }
          .label-card {
            border: 2px dashed #333;
            border-radius: 8px;
            padding: 12px;
            max-width: 320px;
            margin: 0 auto;
          }
          .title {
            font-size: 11px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #4a2c11;
            margin-bottom: 4px;
          }
          .sub {
            font-size: 9px;
            color: #666;
            margin-bottom: 8px;
          }
          .barcode-wrap {
            margin: 6px 0;
          }
          .item-name {
            font-size: 13px;
            font-weight: 800;
            color: #111;
            margin-top: 4px;
          }
          .loc {
            font-size: 9px;
            color: #555;
            margin-top: 2px;
          }
        </style>
      </head>
      <body>
        <div class="label-card">
          <div class="title">INVENTARIS PRAMUKA MAN 11 JAKARTA</div>
          <div class="sub">Gudep 06.171 - 06.172 · Ambalan Khobinwal - Umkul</div>
          <div class="barcode-wrap">${svg}</div>
          <div class="item-name">${itemName}</div>
          <div class="loc">📍 ${location || 'Sanggar Pramuka'}</div>
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}
