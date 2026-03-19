'use client';
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, CheckCircle2, AlertCircle, File, Image as ImageIcon, MapPin, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

interface Props {
  projectId: string;
  milestoneId?: string;
  onSuccess?: () => void;
}

export default function EvidenceUpload({ projectId, milestoneId, onSuccess }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [preview, setPreview] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const f = acceptedFiles[0];
    if (f) {
      setFile(f);
      setStatus('idle');
      if (f.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => setPreview(reader.result as string);
        reader.readAsDataURL(f);
      } else {
        setPreview(null);
      }
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.heic', '.webp'],
      'video/*': ['.mp4', '.mov'],
      'application/pdf': ['.pdf']
    },
    maxFiles: 1
  });

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setStatus('idle');
    setErrorMessage('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('project_id', projectId);
    if (milestoneId) formData.append('milestone_id', milestoneId);
    formData.append('notes', notes);

    try {
      await api.uploadEvidence(formData);
      setStatus('success');
      setFile(null);
      setPreview(null);
      setNotes('');
      if (onSuccess) onSuccess();
    } catch (error: any) {
      setStatus('error');
      setErrorMessage(error.response?.data?.detail || 'Upload failed. Check coordinates/hash.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="glass-card p-6 border border-slate-100 bg-white">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-rakshak-blue/10 rounded-lg">
          <Upload className="w-5 h-5 text-rakshak-blue" />
        </div>
        <div>
          <h3 className="font-bold text-rakshak-navy text-sm">Upload Evidence</h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Verified Geo-Tagged Media Only</p>
        </div>
      </div>

      <div className="space-y-6">
        {!file ? (
          <div 
            {...getRootProps()} 
            className={`upload-zone h-48 flex flex-col items-center justify-center p-8 text-center cursor-pointer border-2 border-dashed transition-all ${
              isDragActive ? 'border-primary-500 bg-primary-50/50' : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <input {...getInputProps()} />
            <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4 border border-slate-100 group-hover:scale-110 transition-transform">
              <Upload className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-sm font-bold text-slate-600">Drag & Drop Field Evidence</p>
            <p className="text-[10px] text-slate-400 font-medium mt-1">Accepts JPG, PNG, MP4, PDF (max 50MB)</p>
          </div>
        ) : (
          <div className="relative rounded-2xl border border-slate-200 overflow-hidden bg-slate-50 p-4">
            <button 
              onClick={() => { setFile(null); setPreview(null); }}
              className="absolute top-2 right-2 p-1.5 bg-white/80 backdrop-blur shadow-sm rounded-full text-slate-500 hover:text-red-500 z-10"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-4">
              {preview ? (
                <div className="w-20 h-20 rounded-xl overflow-hidden border border-white shadow-sm flex-shrink-0">
                  <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-20 h-20 rounded-xl bg-white border border-slate-100 flex items-center justify-center flex-shrink-0">
                  <File className="w-8 h-8 text-slate-300" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-rakshak-navy truncate">{file.name}</p>
                <p className="text-[10px] text-slate-400 font-mono">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                
                <div className="mt-2 flex items-center gap-2 text-[10px] font-black uppercase text-green-600">
                  <MapPin className="w-3 h-3" />
                  Extracting Metadata...
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Audit Notes</label>
            <textarea 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Provide field context, milestone details or observations..."
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-rakshak-blue/20 resize-none h-24 transition-all"
            />
          </div>

          <button
            onClick={handleUpload}
            disabled={!file || isUploading}
            className={`w-full py-4 rounded-2xl font-black uppercase text-xs tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-lg ${
              !file || isUploading 
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-b-4 border-slate-200' 
                : 'bg-rakshak-blue text-white hover:bg-rakshak-navy active:translate-y-0.5 border-b-4 border-rakshak-navy'
            }`}
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              'Initiate Integrity Check'
            )}
          </button>
        </div>

        <AnimatePresence>
          {status === 'success' && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }} 
              animate={{ opacity: 1, height: 'auto' }}
              className="p-4 bg-green-50 border border-green-100 rounded-2xl flex items-center gap-3"
            >
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <p className="text-xs font-bold text-green-700">Audit Successful. Media hashed & location verified.</p>
            </motion.div>
          )}

          {status === 'error' && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }} 
              animate={{ opacity: 1, height: 'auto' }}
              className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3"
            >
              <AlertCircle className="w-5 h-5 text-red-500" />
              <p className="text-xs font-bold text-red-700">{errorMessage}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-8 pt-6 border-t border-slate-50">
        <div className="flex items-center gap-3 text-slate-400 p-3 bg-slate-50/50 rounded-xl border border-slate-100">
          <ShieldCircle className="w-5 h-5 opacity-60" />
          <p className="text-[9px] font-medium leading-relaxed">
            All uploads are subject to SHA-256 integrity verification and real-time EXIF validation. Fraudulent submissions trigger immediate audit alerts.
          </p>
        </div>
      </div>
    </div>
  );
}

function ShieldCircle(props: any) {
  return (
    <svg 
      {...props}
      xmlns="http://www.w3.org/2000/svg" 
      width="24" height="24" 
      viewBox="0 0 24 24" fill="none" 
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    >
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
