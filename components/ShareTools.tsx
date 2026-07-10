import React, { useRef, useState } from 'react';
import { Download, Share2, Check, Copy } from 'lucide-react';
import type { WorkerProfile } from '../types';

interface ShareToolsProps {
  worker: WorkerProfile;
  usernameSlug?: string;
}

export const ShareTools: React.FC<ShareToolsProps> = ({ worker, usernameSlug }) => {
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<SVGSVGElement>(null);
  
  const cleanUsername = usernameSlug || worker.userId; // fallback
  const publicUrl = `${window.location.origin}/pro/${cleanUsername.replace(/^@/, '')}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(publicUrl)}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSVG = () => {
    if (!cardRef.current) return;
    
    // Serialize the SVG to string
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(cardRef.current);
    
    // Add namespace if missing
    if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
      source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    if (!source.match(/^<svg[^>]+xmlns:xlink="http:\/\/www\.w3\.org\/1999\/xlink"/)) {
      source = source.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
    }

    // Add xml declaration
    source = '<?xml version="1.0" encoding="utf-8"?>\n' + source;

    // Convert SVG to data URL
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(source);
    
    // Create download link
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = `${worker.name.replace(/\s+/g, '_')}_Business_Card.svg`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-6">
      <div>
        <h3 className="text-xl font-bold text-forge-navy">Share Your Profile</h3>
        <p className="text-gray-500 text-sm mt-1">Grow your business by sharing your verified profile with customers.</p>
      </div>

      {/* Interactive Business Card Preview */}
      <div className="flex justify-center">
        <svg
          ref={cardRef}
          width="350"
          height="200"
          viewBox="0 0 350 200"
          className="rounded-2xl shadow-xl select-none"
          style={{ fontfamily: 'Inter, system-ui, sans-serif' }}
        >
          {/* Card Gradient Background */}
          <defs>
            <linearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1A2E40" />
              <stop offset="100%" stopColor="#0B1520" />
            </linearGradient>
            <linearGradient id="badgeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#FF7A00" />
              <stop offset="100%" stopColor="#FF9F43" />
            </linearGradient>
            <clipPath id="avatarClip">
              <rect x="20" y="25" width="60" height="60" rx="12" />
            </clipPath>
          </defs>

          {/* Background */}
          <rect width="350" height="200" rx="16" fill="url(#cardGrad)" />
          
          {/* Decorative Subtle Accent Circle */}
          <circle cx="320" cy="40" r="80" fill="#FF7A00" fillOpacity="0.05" />
          <circle cx="20" cy="180" r="50" fill="#00A651" fillOpacity="0.05" />

          {/* Worker Avatar Placeholder/Visual */}
          <rect x="20" y="25" width="60" height="60" rx="12" fill="#2E4357" />
          <text x="50" y="60" fill="#FFFFFF" fontSize="24" fontWeight="bold" textAnchor="middle" dominantBaseline="middle">
            {worker.name[0]}
          </text>
          
          {/* Verification Badge */}
          {worker.verified && (
            <g transform="translate(62, 67)">
              <circle cx="10" cy="10" r="9" fill="#00A651" />
              <path d="M6 10 L9 13 L14 7" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          )}

          {/* Info Section */}
          <text x="96" y="42" fill="#FFFFFF" fontSize="18" fontWeight="bold">
            {worker.name}
          </text>
          
          <rect x="96" y="50" width="100" height="18" rx="4" fill="url(#badgeGrad)" />
          <text x="146" y="62" fill="#FFFFFF" fontSize="10" fontWeight="bold" textAnchor="middle">
            {worker.role.toUpperCase()}
          </text>

          {/* Details (Location, Rating) */}
          <text x="20" y="115" fill="#94A3B8" fontSize="11">LOCATION</text>
          <text x="20" y="132" fill="#FFFFFF" fontSize="13" fontWeight="600">
            {worker.location}, {worker.country === 'GH' ? 'Ghana' : 'Nigeria'}
          </text>

          <text x="20" y="160" fill="#94A3B8" fontSize="11">RATING</text>
          <text x="20" y="177" fill="#FFFFFF" fontSize="13" fontWeight="600">
            ★ {worker.rating} ({worker.reviewCount} Reviews)
          </text>

          {/* QR Code Background Container */}
          <rect x="235" y="25" width="95" height="95" rx="12" fill="#FFFFFF" />
          {/* SVG embedded image for the QR code API (will load when rendered in browser) */}
          <image
            href={qrCodeUrl}
            x="240"
            y="30"
            width="85"
            height="85"
          />
          <text x="282" y="135" fill="#94A3B8" fontSize="9" textAnchor="middle" fontWeight="500">SCAN TO BOOK</text>

          {/* Brand Logo Watermark */}
          <text x="330" y="180" fill="#FF7A00" fontSize="14" fontWeight="bold" textAnchor="end">
            FORGE
          </text>
        </svg>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={handleCopyLink}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-forge-green" />
              <span>Copied Link!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              <span>Copy Profile Link</span>
            </>
          )}
        </button>
        <button
          onClick={handleDownloadSVG}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-forge-navy hover:bg-slate-800 text-white font-medium transition-colors"
        >
          <Download className="w-4 h-4" />
          <span>Download Card</span>
        </button>
      </div>
    </div>
  );
};

export default ShareTools;
