import React, { useRef, useState, useEffect } from 'react';
import { Eraser, Check, Upload, PenTool } from 'lucide-react';
import { createSignatureDataUrl } from '../utils/inventoryLogic';

interface SignaturePadCanvasProps {
  currentSignature: string;
  signerName: string;
  onSaveSignature: (dataUrl: string) => void;
}

export const SignaturePadCanvas: React.FC<SignaturePadCanvasProps> = ({
  currentSignature,
  signerName,
  onSaveSignature,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasStrokes, setHasStrokes] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const getCoords = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasStrokes(true);
  };

  const draw = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const endDraw = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasStrokes(false);
  };

  const saveDrawnSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!hasStrokes) {
      const autoSig = createSignatureDataUrl(signerName, '#1E293B');
      onSaveSignature(autoSig);
    } else {
      const dataUrl = canvas.toDataURL('image/png');
      onSaveSignature(dataUrl);
    }
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onSaveSignature(reader.result);
        setSavedNotice(true);
        setTimeout(() => setSavedNotice(false), 2500);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-3">
      {/* Current Pre-saved Signature Display */}
      <div className="p-3 rounded-xl bg-white border border-[#D9C3A9] flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-[#3B2314]">TTD Digital Tersimpan di Profil</p>
          <p className="text-[11px] text-[#6E5039]">
            Otomatis disematkan ke Surat Peminjaman & Pengembalian PDF
          </p>
        </div>
        <div className="h-14 px-3 py-1 bg-[#FBF8F3] rounded-lg border border-[#E5D7C3] flex items-center justify-center shrink-0">
          <img
            src={currentSignature}
            alt="Tanda Tangan Tersimpan"
            className="max-h-11 w-auto object-contain"
          />
        </div>
      </div>

      {/* Interactive Canvas Pad */}
      <div className="p-3 rounded-xl bg-[#FBF8F3] border border-[#D9C3A9]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-[#3B2314] flex items-center gap-1.5">
            <PenTool className="w-3.5 h-3.5 text-[#8B5A2B]" />
            Gambar TTD Baru atau Unggah Foto TTD:
          </span>
          <button
            type="button"
            onClick={clearCanvas}
            className="text-xs font-medium text-[#8B5A2B] hover:text-[#3B2314] inline-flex items-center gap-1"
          >
            <Eraser className="w-3.5 h-3.5" />
            Bersihkan Kanvas
          </button>
        </div>

        <canvas
          ref={canvasRef}
          width={320}
          height={100}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
          className="w-full h-24 bg-white rounded-lg border border-dashed border-[#C89D54] cursor-crosshair touch-none"
        />

        <div className="flex flex-wrap items-center gap-2 mt-2.5">
          <button
            type="button"
            onClick={saveDrawnSignature}
            className="flex-1 min-h-[40px] px-3 py-2 rounded-lg bg-[#3B2314] text-[#FBF8F3] text-xs font-bold hover:bg-[#5C3A21] transition-colors inline-flex items-center justify-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5 text-[#C89D54]" />
            {hasStrokes ? 'Simpan Goresan TTD' : 'Perbarui TTD Otomatis'}
          </button>

          <label className="min-h-[40px] px-3 py-2 rounded-lg bg-white border border-[#D9C3A9] text-[#3B2314] text-xs font-semibold hover:bg-[#F4EDE2] transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer">
            <Upload className="w-3.5 h-3.5 text-[#8B5A2B]" />
            <span>Unggah Foto TTD</span>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>

        {savedNotice && (
          <p className="text-xs font-semibold text-[#16A34A] mt-2">
            Tanda tangan digital berhasil disimpan untuk seluruh transaksi surat berikutnya.
          </p>
        )}
      </div>
    </div>
  );
};
