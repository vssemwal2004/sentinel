import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

/**
 * QrCameraScanner
 * Props:
 *  onDecode(text) -> called once on successful decode (auto-stops stream)
 *  onError(err)   -> optional error callback
 *  onClose()      -> optional close callback when user stops manually
 *  facingMode     -> 'environment' | 'user' (default environment)
 *  scanIntervalMs -> frame decode interval (default 500ms)
 */
export default function QrCameraScanner({ onDecode, onError, onClose, facingMode='environment', scanIntervalMs=500 }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const [status, setStatus] = useState('initial'); // initial | starting | scanning | decoded | error

  useEffect(()=>{
    let cancelled = false;
    async function start(){
      setStatus('starting');
      try {
        const constraints = { video: { facingMode } };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if(cancelled) return;
        streamRef.current = stream;
        if(videoRef.current){
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setStatus('scanning');
          schedule();
        }
      } catch(err){
        console.error('Camera start error', err);
        setStatus('error');
        onError && onError(err);
      }
    }
    function schedule(){
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(captureAndDecode, scanIntervalMs);
    }
    function captureAndDecode(){
      if(!videoRef.current || !canvasRef.current) return schedule();
      const v = videoRef.current;
      if(v.readyState < 2) return schedule();
      const canvas = canvasRef.current;
      canvas.width = v.videoWidth;
      canvas.height = v.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(v,0,0,canvas.width,canvas.height);
      const imageData = ctx.getImageData(0,0,canvas.width,canvas.height);
      const code = jsQR(imageData.data, canvas.width, canvas.height, { inversionAttempts: 'attemptBoth' });
      if(code && code.data){
        setStatus('decoded');
        stopStream();
        onDecode && onDecode(code.data.trim());
      } else {
        schedule();
      }
    }
    function stopStream(){
      clearTimeout(timerRef.current);
      timerRef.current = null;
      if(streamRef.current){
        streamRef.current.getTracks().forEach(t=>t.stop());
        streamRef.current = null;
      }
    }
    start();
    return ()=>{
      cancelled = true;
      stopStream();
    };
  },[facingMode, scanIntervalMs, onDecode, onError]);

  return (
    <div className="relative w-full max-w-sm">
      <div className="aspect-square w-full bg-black rounded overflow-hidden flex items-center justify-center">
        <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
        <canvas ref={canvasRef} className="hidden" />
      </div>
      <div className="absolute top-1 left-1 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded">
        {status==='starting' && 'Starting camera...'}
        {status==='scanning' && 'Scanning...'}
        {status==='decoded' && 'QR found'}
        {status==='error' && 'Camera error'}
      </div>
      <button type="button" onClick={()=>{ onClose && onClose(); }} className="absolute top-1 right-1 bg-white/70 hover:bg-white text-xs px-2 py-0.5 rounded">Close</button>
      <div className="mt-1 text-[10px] text-gray-500 space-y-0.5">
        <p>Align the bus QR inside the square.</p>
        <p>If scan is slow, move closer / improve lighting.</p>
      </div>
    </div>
  );
}
