import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';

export default function ScanMeal() {
  const navigate = useNavigate();
  const scannerRef = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const scanner = new Html5QrcodeScanner('qr-reader', {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      rememberLastUsedCamera: true,
      showTorchButtonIfSupported: true,
    });

    scanner.render(
      (decodedText) => {
        // Success
        scanner.clear();
        try {
          const url = new URL(decodedText);
          const hostelId = url.searchParams.get('hostel');
          if (hostelId) {
            navigate(`/claim-meal?hostel=${hostelId}`);
          } else {
            setError('Invalid QR code. No hostel information found.');
          }
        } catch {
          // Maybe it's just a hostel ID directly
          if (decodedText && decodedText.length > 10) {
            navigate(`/claim-meal?hostel=${decodedText}`);
          } else {
            setError('Invalid QR code format.');
          }
        }
      },
      (errorMessage) => {
        // Scan error - ignore, scanner keeps trying silently
      }
    );

    scannerRef.current = scanner;

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
      }
    };
  }, [navigate]);

  return (
    <div className="space-y-8 animate-fade-in max-w-3xl mx-auto p-4 sm:p-6 pb-20">
      <style>{`
        #qr-reader {
          border: none !important;
          border-radius: 0.75rem;
          overflow: hidden;
        }
        #qr-reader img[alt="Info icon"] {
          display: none !important;
        }
        #qr-reader__dashboard_section_csr span {
          color: #374151 !important;
          font-family: inherit !important;
        }
        #qr-reader button {
          background-color: #10b981 !important;
          color: white !important;
          border: none !important;
          padding: 0.5rem 1rem !important;
          border-radius: 0.5rem !important;
          font-weight: 500 !important;
          font-family: inherit !important;
          margin: 0.5rem !important;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        #qr-reader button:hover {
          background-color: #059669 !important;
        }
        #qr-reader__status_span {
          background-color: transparent !important;
          border: none !important;
          padding: 0 !important;
          font-family: inherit !important;
        }
        #html5-qrcode-anchor-scan-type-change {
          color: #10b981 !important;
          text-decoration: none !important;
        }
      `}</style>

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
          <ArrowLeft className="w-6 h-6" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Scan to Eat</h1>
          <p className="text-gray-500 mt-1">Point your camera at the mess counter QR code</p>
        </div>
      </div>

      <Card className="max-w-lg mx-auto overflow-hidden shadow-lg border-gray-100">
        <CardContent className="p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg text-sm font-medium border border-red-100">
              {error}
            </div>
          )}
          
          <div className="w-full relative bg-gray-50 rounded-xl overflow-hidden min-h-[300px] flex items-center justify-center">
            <div id="qr-reader" className="w-full" />
          </div>
        </CardContent>
      </Card>

      <p className="text-sm text-gray-400 text-center mt-6">
        Can't scan? Ask the mess staff for manual check-in.
      </p>
    </div>
  );
}
