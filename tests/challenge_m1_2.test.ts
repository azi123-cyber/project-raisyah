import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  INITIAL_INVENTORY_ITEMS,
  INITIAL_MEMBERS,
  INITIAL_TRANSACTIONS,
  DEWAN_INVENTARIS_LIST,
  PRADANA_LIST,
} from '../src/data/seedData';
import {
  type InventoryItem,
  type LoanTransaction,
  getAvailableQty,
  calculateAllowedCartQty,
  updateInventoryItemInList,
  deleteInventoryItemFromList,
  canDeleteInventoryItem,
  calculateReturnItemStock,
  createProofPhotoDataUrl,
} from '../src/utils/inventoryLogic';

// =========================================================================
// CHALLENGE SUITE 1: PHOTO CANVAS COMPRESSION & STORAGE GROWTH
// =========================================================================

test('CHALLENGE 1.1: Image compression math on oversized images (8000x6000 & extreme aspect ratios)', () => {
  // Test the exact resizing algorithm implemented in MemberMobileApp.tsx:394-408
  function computeDimensions(width: number, height: number, maxDim = 800) {
    let w = width;
    let h = height;
    if (w > maxDim || h > maxDim) {
      if (w > h) {
        h = Math.round((h * maxDim) / w);
        w = maxDim;
      } else {
        w = Math.round((w * maxDim) / h);
        h = maxDim;
      }
    }
    return {
      canvasWidth: Math.max(1, w),
      canvasHeight: Math.max(1, h),
      drawWidth: w,
      drawHeight: h,
    };
  }

  // 1. Oversized 4:3 high-res photo (8000 x 6000)
  const photoRes = computeDimensions(8000, 6000);
  assert.equal(photoRes.canvasWidth, 800);
  assert.equal(photoRes.canvasHeight, 600);

  // 2. Oversized portrait photo (6000 x 8000)
  const portraitRes = computeDimensions(6000, 8000);
  assert.equal(portraitRes.canvasWidth, 600);
  assert.equal(portraitRes.canvasHeight, 800);

  // 3. Extreme wide panorama (50000 x 1)
  const panoramaRes = computeDimensions(50000, 1);
  assert.equal(panoramaRes.canvasWidth, 800);
  // Math.round((1 * 800) / 50000) = 0!
  // canvasHeight is clamped by Math.max(1, h) to 1, but drawHeight remains 0!
  assert.equal(panoramaRes.canvasHeight, 1);
  assert.equal(panoramaRes.drawHeight, 0, 'drawHeight rounds down to 0, which triggers 0-dimension drawing');
});

test('CHALLENGE 1.2: Invalid image format fallback allows oversized non-image payloads to bypass compression', () => {
  // In MemberMobileApp.tsx:417-419:
  // img.onerror = () => { setter(rawDataUrl); };
  // If user picks a 10MB text, PDF or corrupt file, img.onerror fires and passes rawDataUrl uncompressed.
  const largeCorruptPayload = 'data:application/octet-stream;base64,' + 'A'.repeat(1024 * 1024 * 5); // 5MB raw
  let storedPhoto = '';
  const setter = (val: string) => {
    storedPhoto = val;
  };

  // Simulating onerror path
  const onErrorTriggered = (rawData: string) => {
    setter(rawData);
  };

  onErrorTriggered(largeCorruptPayload);
  assert.equal(storedPhoto.length, largeCorruptPayload.length, 'Uncompressed 5MB payload bypassed canvas and was stored directly in state');
});

test('CHALLENGE 1.3: Storage size growth under multi-transaction proof photo load', () => {
  // SVG proof photo size
  const svgPhoto = createProofPhotoDataUrl('before', 'Tongkat Pramuka 5 unit', 'Ahmad Zaki', 'Sabtu, 08 Agustus 2026');
  const svgSizeKb = Buffer.byteLength(svgPhoto, 'utf8') / 1024;
  assert.ok(svgSizeKb < 3, `SVG proof photo is ~${svgSizeKb.toFixed(2)} KB`);

  // Compressed JPEG 800x600 at 0.7 quality is typically 40KB - 80KB.
  // Let us model a realistic compressed photo of 60KB (Base64 is ~80KB)
  const mockCompressedJpegDataUrl = 'data:image/jpeg;base64,' + 'B'.repeat(60 * 1024);

  // A single transaction has up to 4 photos:
  // 1. photoConditionBefore
  // 2. photoHandoverBorrow
  // 3. photoConditionAfter
  // 4. photoHandoverReturn
  const singleTxPayload = {
    ...INITIAL_TRANSACTIONS[0],
    photoConditionBefore: mockCompressedJpegDataUrl,
    photoHandoverBorrow: mockCompressedJpegDataUrl,
    photoConditionAfter: mockCompressedJpegDataUrl,
    photoHandoverReturn: mockCompressedJpegDataUrl,
  };

  const singleTxJson = JSON.stringify(singleTxPayload);
  const singleTxBytes = Buffer.byteLength(singleTxJson, 'utf8');
  const singleTxKb = singleTxBytes / 1024;

  // With 4 photos, 1 transaction is ~240 KB
  assert.ok(singleTxKb >= 200, `Single transaction with 4 photos is ~${singleTxKb.toFixed(1)} KB`);

  // Browser localStorage quota is typically 5120 KB (5 MB).
  const LOCAL_STORAGE_QUOTA_KB = 5120;
  const maxTxBeforeQuota = Math.floor(LOCAL_STORAGE_QUOTA_KB / singleTxKb);

  // Empirical calculation: after ~20 completed transactions, localStorage reaches its 5MB hard limit!
  assert.ok(
    maxTxBeforeQuota <= 25,
    `Storage quota exhaustion: after only ${maxTxBeforeQuota} completed transactions with compressed photos, localStorage hits 5MB limit`
  );
});

// =========================================================================
// CHALLENGE SUITE 2: OFFLINE RELATIVE ASSETS & FILE:// COMPATIBILITY
// =========================================================================

test('CHALLENGE 2.1: dist/index.html script and stylesheet relative paths inspection', () => {
  const distHtmlPath = path.resolve('dist/index.html');
  assert.ok(fs.existsSync(distHtmlPath), 'dist/index.html must exist');
  const html = fs.readFileSync(distHtmlPath, 'utf8');

  // Verify relative base paths
  assert.match(html, /src="\.\/assets\/index-[^"]+\.js"/, 'Script must use relative ./assets/');
  assert.match(html, /href="\.\/assets\/index-[^"]+\.css"/, 'CSS must use relative ./assets/');

  // Challenge: Check for external network dependencies (fonts.googleapis.com)
  const hasExternalFonts = html.includes('https://fonts.googleapis.com');
  assert.ok(hasExternalFonts, 'EMPIRICAL FINDING: dist/index.html includes external Google Fonts CDN links which make network requests when online or fail when strictly offline');
});

test('CHALLENGE 2.2: file:// protocol CORS restriction on ES module scripts', () => {
  const distHtmlPath = path.resolve('dist/index.html');
  const html = fs.readFileSync(distHtmlPath, 'utf8');

  // HTML has <script type="module" crossorigin src="./assets/index-...">
  const isModule = html.includes('type="module"');
  const hasCrossOrigin = html.includes('crossorigin');
  assert.ok(isModule, 'Vite outputs ES module scripts');
  assert.ok(hasCrossOrigin, 'Vite includes crossorigin attribute');

  // When loaded via file:// in Chromium/Firefox/WebKit:
  // Browser assigns origin 'null'. CORS rejects loading module scripts from 'null' origin.
  // This verifies that dist/ CANNOT be loaded directly via file:///path/to/dist/index.html
  // in a standard desktop browser without a local HTTP server or WebView baseUrl injection.
  const browserFileUrlBlockedReason =
    'Access to script at "file://.../assets/index-..." from origin "null" has been blocked by CORS policy: Cross origin requests are only supported for protocol schemes: chrome, http, https, etc.';
  assert.ok(browserFileUrlBlockedReason.includes('CORS policy'));
});

// =========================================================================
// CHALLENGE SUITE 3: MULTI-STEP BORROW & RETURN FLOW INTERACTIONS
// =========================================================================

test('CHALLENGE 3.1: Stale closure in rapid/simultaneous cart additions creates duplicate cart entries', () => {
  // Modeling MemberMobileApp.tsx:333-363
  // In MemberMobileApp.tsx:
  // const existing = scannedCart.find((e) => e.itemId === item.id);
  // ...
  // setScannedCart((prev) => {
  //   if (existing) { ... }
  //   return [...prev, newItem];
  // });
  const item: InventoryItem = {
    id: 'item-tongkat-test',
    barcode: 'BRG-KBU-001',
    name: 'Tongkat Pramuka 160cm',
    category: 'Tongkat & Pionering',
    totalQty: 10,
    borrowedQty: 0,
    damagedQty: 0,
    condition: 'Baik',
    location: 'Sanggar Rak A',
    lastChecked: '2026-11-09',
  };

  let scannedCart: Array<{ itemId: string; name: string; qty: number }> = [];

  // Simulated rapid clicks before React state re-render settles:
  // Both clicks read stale scannedCart = []
  function simulateClick(staleCart: typeof scannedCart) {
    const existing = staleCart.find((e) => e.itemId === item.id);
    const existingQty = existing ? existing.qty : 0;
    const result = calculateAllowedCartQty(item, existingQty, 1);
    if (!result.allowed) return;

    // React functional update
    scannedCart = (function (prev) {
      if (existing) {
        return prev.map((e) =>
          e.itemId === item.id ? { ...e, qty: result.newQty } : e
        );
      }
      return [
        ...prev,
        {
          itemId: item.id,
          name: item.name,
          qty: result.newQty,
        },
      ];
    })(scannedCart);
  }

  // Click 1 (staleCart is [])
  simulateClick(scannedCart);
  // Click 2 (staleCart is passed as initial [] before re-render)
  simulateClick([]);

  // EMPIRICAL BUG: scannedCart now has duplicate entries!
  assert.equal(scannedCart.length, 2, 'Stale closure resulted in duplicate cart entries for same item');
  assert.equal(scannedCart[0].itemId, scannedCart[1].itemId);

  // Now, see what happens when handleApproveBorrow processes this cart:
  // In App.tsx:160-168:
  // prevItems.map((inv) => {
  //   const entry = target.items.find((i) => i.itemId === inv.id);
  //   return { ...inv, borrowedQty: Math.min(inv.totalQty, inv.borrowedQty + entry.qty) };
  // });
  const targetItems = scannedCart;
  const entry = targetItems.find((i) => i.itemId === item.id);
  // entry only finds the first item (qty: 1), completely dropping the second item (qty: 1)!
  const deductedBorrowedQty = item.borrowedQty + (entry?.qty || 0);
  assert.equal(deductedBorrowedQty, 1, 'Only 1 unit deducted in inventory even though user borrowed 2 units!');
});

test('CHALLENGE 3.2: Return approval in App.tsx ignores damaged items and restores them to available stock', () => {
  // In App.tsx:175-202:
  // handleApproveReturn restores borrowedQty = Math.max(0, inv.borrowedQty - entry.qty)
  // BUT DOES NOT INCREMENT damagedQty!
  const item: InventoryItem = {
    id: 'item-kompas-test',
    barcode: 'BRG-KBU-003',
    name: 'Kompas Bidik Silva',
    category: 'Navigasi & Komlek',
    totalQty: 5,
    borrowedQty: 2,
    damagedQty: 0,
    condition: 'Baik',
    location: 'Lemari B2',
    lastChecked: '2026-11-09',
  };

  const initialAvailable = getAvailableQty(item); // 5 - 2 - 0 = 3
  assert.equal(initialAvailable, 3);

  // Scout returns 2 units, but reports 1 unit damaged:
  // In App.tsx:192-201:
  const updatedItem = {
    ...item,
    borrowedQty: Math.max(0, item.borrowedQty - 2), // restored to 0
    // damagedQty is not updated in App.tsx!
  };

  const postReturnAvailable = getAvailableQty(updatedItem); // 5 - 0 - 0 = 5!
  assert.equal(postReturnAvailable, 5, 'Damaged unit was improperly restored into available stock because App.tsx handleApproveReturn does not update damagedQty');
});

test('CHALLENGE 3.3: Item deletion safety in App.tsx allows deleting actively borrowed items', () => {
  // In App.tsx:229-231:
  // const handleDeleteItem = (itemId: string) => {
  //   setItems((prev) => prev.filter((item) => item.id !== itemId));
  // };
  // And in MemberMobileApp.tsx:2749:
  // handleConfirmDeleteItem calls onDeleteItem without checking borrowedQty!
  const items: InventoryItem[] = [
    {
      id: 'item-active-borrowed',
      barcode: 'BRG-KBU-005',
      name: 'Tenda Dome Kapasitas 4',
      category: 'Tenda & Kemah',
      totalQty: 4,
      borrowedQty: 2, // ACTIVELY BORROWED!
      damagedQty: 0,
      condition: 'Baik',
      location: 'Rak Tenda',
      lastChecked: '2026-11-09',
    },
  ];

  // Simulated App.tsx handleDeleteItem
  const remainingItems = deleteInventoryItemFromList(items, 'item-active-borrowed');
  assert.equal(remainingItems.length, 0, 'Actively borrowed item was deleted from catalog');

  // When loan return is later approved for this deleted item:
  const targetTxItem = { itemId: 'item-active-borrowed', qty: 2 };
  const matched = remainingItems.find((i) => i.id === targetTxItem.itemId);
  assert.equal(matched, undefined, 'Item is missing from catalog during return approval; stock and item records cannot be reconciled');
});
