import React, { useState, useMemo } from 'react';
import { 
  Image as ImageIcon, 
  Plus, 
  Upload, 
  Search, 
  Trash2, 
  Eye, 
  ChevronRight, 
  ArrowLeft, 
  CheckCircle2, 
  XCircle, 
  Download, 
  Settings2, 
  Clock, 
  Hash, 
  Type,
  FileText,
  MoreVertical,
  Maximize2,
  RefreshCw,
  Check,
  AlertCircle,
  Copy
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useStore } from '../store';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface DataProcessingProps {
  activeSubTab: string;
}

type ViewState = 'list' | 'naming' | 'preview' | 'result';

interface ImageData {
  id: string;
  name: string;
  size: string;
  resolution: string;
  uploadTime: string;
  url: string;
  selected?: boolean;
}

interface NamingRule {
  prefix: string;
  suffix: string;
  startNumber: number;
  digits: number;
  useTimestamp: boolean;
  useOriginalName: boolean;
  duplicateHandling: 'skip' | 'overwrite' | 'rename';
}

interface ProcessResult {
  originalName: string;
  newName: string;
  status: 'success' | 'error';
}

const MOCK_IMAGES: ImageData[] = [
  { id: '1', name: 'IMG_20240101_001.jpg', size: '1.2 MB', resolution: '1920x1080', uploadTime: '2026-03-01 10:00', url: 'https://picsum.photos/seed/img1/800/600' },
  { id: '2', name: 'IMG_20240101_002.jpg', size: '2.4 MB', resolution: '3840x2160', uploadTime: '2026-03-01 10:05', url: 'https://picsum.photos/seed/img2/800/600' },
  { id: '3', name: 'IMG_20240101_003.jpg', size: '1.5 MB', resolution: '1920x1080', uploadTime: '2026-03-01 10:10', url: 'https://picsum.photos/seed/img3/800/600' },
  { id: '4', name: 'IMG_20240101_004.jpg', size: '0.8 MB', resolution: '1280x720', uploadTime: '2026-03-01 10:15', url: 'https://picsum.photos/seed/img4/800/600' },
  { id: '5', name: 'IMG_20240101_005.jpg', size: '3.1 MB', resolution: '4096x2304', uploadTime: '2026-03-01 10:20', url: 'https://picsum.photos/seed/img5/800/600' },
  { id: '6', name: 'IMG_20240101_006.jpg', size: '1.1 MB', resolution: '1920x1080', uploadTime: '2026-03-01 10:25', url: 'https://picsum.photos/seed/img6/800/600' },
];

export default function DataProcessing({ activeSubTab }: DataProcessingProps) {
  const { notify } = useStore();
  const [view, setView] = useState<ViewState>('list');
  const [images, setImages] = useState<ImageData[]>(MOCK_IMAGES);
  const [previewImage, setPreviewImage] = useState<ImageData | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [namingRule, setNamingRule] = useState<NamingRule>({
    prefix: 'task1_',
    suffix: '',
    startNumber: 1,
    digits: 3,
    useTimestamp: false,
    useOriginalName: false,
    duplicateHandling: 'rename',
  });
  const [results, setResults] = useState<ProcessResult[]>([]);

  // Reset view when subtab changes
  React.useEffect(() => {
    if (activeSubTab === 'img-proc') setView('list');
    if (activeSubTab === 'batch-rename') setView('naming');
  }, [activeSubTab]);

  // Helper to generate new name based on rules
  const generateNewName = (originalName: string, index: number, currentGeneratedNames: string[] = []) => {
    const ext = originalName.split('.').pop();
    let name = namingRule.prefix;
    
    if (namingRule.useOriginalName) {
      name += originalName.split('.')[0];
    }
    
    if (namingRule.useTimestamp) {
      name += new Date().toISOString().split('T')[0].replace(/-/g, '');
    }
    
    const num = (namingRule.startNumber + index).toString().padStart(namingRule.digits, '0');
    name += num;
    
    if (namingRule.suffix) {
      name += namingRule.suffix;
    }
    
    let finalName = `${name}.${ext}`;
    
    // Check for duplicates in existing images or already generated names in this batch
    const allExistingNames = [...images.map(img => img.name), ...currentGeneratedNames];
    
    if (allExistingNames.includes(finalName)) {
      if (namingRule.duplicateHandling === 'skip') {
        return null;
      } else if (namingRule.duplicateHandling === 'rename') {
        let counter = 1;
        while (allExistingNames.includes(`${name}_${counter}.${ext}`)) {
          counter++;
        }
        finalName = `${name}_${counter}.${ext}`;
      }
      // 'overwrite' returns the name as is
    }
    
    return finalName;
  };

  const exampleName = useMemo(() => {
    return generateNewName('example.jpg', 0) || 'example.jpg';
  }, [namingRule, images]);

  const selectedImages = useMemo(() => {
    return images.filter(img => selectedIds.includes(img.id));
  }, [images, selectedIds]);

  const previewResults = useMemo(() => {
    const generated: string[] = [];
    return selectedImages.map((img, idx) => {
      const newName = generateNewName(img.name, idx, generated);
      if (newName) generated.push(newName);
      
      return {
        originalName: img.name,
        newName: newName || '(已跳过)',
        status: newName ? 'success' as const : 'error' as const
      };
    });
  }, [selectedImages, namingRule, images]);

  // --- Sub-page Renders ---

  const renderImageProcessing = () => (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">图片处理</h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1">管理与预览待处理的图片资源</p>
        </div>
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = 'image/*';
              input.onchange = (e: any) => {
                const file = e.target.files[0];
                if (file) {
                  const newImg: ImageData = {
                    id: `IMG-${Date.now()}`,
                    name: file.name,
                    size: (file.size / (1024 * 1024)).toFixed(1) + ' MB',
                    resolution: '1920x1080', // Mock resolution
                    uploadTime: new Date().toISOString().split('T')[0] + ' ' + new Date().toTimeString().split(' ')[0].slice(0, 5),
                    url: URL.createObjectURL(file)
                  };
                  setImages(prev => [newImg, ...prev]);
                  alert('图片导入成功');
                }
              };
              input.click();
            }}
            className="flex items-center px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm font-medium hover:bg-[var(--bg-primary)] transition-all"
          >
            <Plus className="w-4 h-4 mr-2" /> 导入图片
          </button>
          <button 
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = 'image/*';
              input.multiple = true;
              input.onchange = (e: any) => {
                const files = e.target.files;
                if (files && files.length > 0) {
                  const newImages: ImageData[] = Array.from(files).map((f: any, idx) => {
                    const file = f as File;
                    return {
                      id: `IMG-${Date.now()}-${idx}`,
                      name: file.name,
                      size: (file.size / (1024 * 1024)).toFixed(1) + ' MB',
                      resolution: '1920x1080',
                      uploadTime: new Date().toISOString().split('T')[0] + ' ' + new Date().toTimeString().split(' ')[0].slice(0, 5),
                      url: URL.createObjectURL(file)
                    };
                  });
                  setImages(prev => [...newImages, ...prev]);
                  alert(`成功批量导入 ${newImages.length} 张图片`);
                }
              };
              input.click();
            }}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all"
          >
            <Upload className="w-4 h-4 mr-2" /> 批量导入
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[300px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
          <input 
            type="text" 
            placeholder="搜索图片名称..." 
            className="w-full pl-10 pr-4 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20" 
          />
        </div>
        <div className="flex items-center space-x-2">
          <button 
            onClick={() => setView('naming')}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-all flex items-center"
          >
            批量命名 <ChevronRight className="w-4 h-4 ml-1" />
          </button>
        </div>
      </div>

      {/* Image Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-[var(--bg-primary)] text-[var(--text-secondary)] text-xs uppercase tracking-wider">
              <th className="px-6 py-4 font-semibold">图片预览</th>
              <th className="px-6 py-4 font-semibold">图片名称</th>
              <th className="px-6 py-4 font-semibold">文件大小</th>
              <th className="px-6 py-4 font-semibold">分辨率</th>
              <th className="px-6 py-4 font-semibold">上传时间</th>
              <th className="px-6 py-4 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-color)]">
            {images.map((img) => (
              <tr key={img.id} className="hover:bg-[var(--bg-primary)] transition-colors group">
                <td className="px-6 py-3">
                  <div className="w-12 h-12 rounded bg-slate-100 dark:bg-slate-800 overflow-hidden cursor-pointer" onClick={() => setPreviewImage(img)}>
                    <img src={img.url} alt={img.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                </td>
                <td className="px-6 py-4 text-sm font-medium text-[var(--text-primary)]">{img.name}</td>
                <td className="px-6 py-4 text-sm text-[var(--text-secondary)]">{img.size}</td>
                <td className="px-6 py-4 text-sm text-[var(--text-secondary)] font-mono">{img.resolution}</td>
                <td className="px-6 py-4 text-sm text-[var(--text-secondary)]">{img.uploadTime}</td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end space-x-2">
                    <button onClick={() => setPreviewImage(img)} className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-500 rounded" title="预览">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 rounded" title="删除">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-6 py-4 bg-[var(--bg-primary)] border-t border-[var(--border-color)] flex items-center justify-between">
          <p className="text-xs text-[var(--text-secondary)]">共 {images.length} 张图片</p>
          <div className="flex items-center space-x-2">
            <button className="px-3 py-1 border border-[var(--border-color)] rounded text-xs hover:bg-[var(--bg-secondary)] disabled:opacity-50" disabled>上一页</button>
            <button className="px-3 py-1 border border-[var(--border-color)] rounded text-xs bg-blue-600 text-white">1</button>
            <button className="px-3 py-1 border border-[var(--border-color)] rounded text-xs hover:bg-[var(--bg-secondary)]">下一页</button>
          </div>
        </div>
      </div>

      {/* Image Preview Modal */}
      <AnimatePresence>
        {previewImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-black/80 backdrop-blur-sm"
            onClick={() => setPreviewImage(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-5xl w-full bg-[var(--bg-secondary)] rounded-2xl overflow-hidden shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
                <h3 className="font-bold text-[var(--text-primary)]">{previewImage.name}</h3>
                <button onClick={() => setPreviewImage(null)} className="p-2 hover:bg-[var(--bg-primary)] rounded-full text-[var(--text-secondary)]">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              <div className="p-4 flex items-center justify-center bg-slate-900 min-h-[400px]">
                <img src={previewImage.url} alt={previewImage.name} className="max-w-full max-h-[70vh] object-contain shadow-lg" referrerPolicy="no-referrer" />
              </div>
              <div className="p-4 bg-[var(--bg-primary)] grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-[10px] uppercase font-bold text-[var(--text-secondary)]">分辨率</p>
                  <p className="text-sm font-bold text-[var(--text-primary)]">{previewImage.resolution}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-[var(--text-secondary)]">文件大小</p>
                  <p className="text-sm font-bold text-[var(--text-primary)]">{previewImage.size}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-[var(--text-secondary)]">上传时间</p>
                  <p className="text-sm font-bold text-[var(--text-primary)]">{previewImage.uploadTime}</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  const renderBatchNaming = () => (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <button onClick={() => setView('list')} className="p-2 hover:bg-[var(--bg-secondary)] rounded-lg text-[var(--text-secondary)]">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">批量命名</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Image Selection */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
              <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase">选择图片</h3>
              <div className="flex items-center space-x-4">
                <button 
                  onClick={() => setSelectedIds(images.map(i => i.id))}
                  className="text-xs font-bold text-blue-500 hover:underline"
                >
                  全选
                </button>
                <button 
                  onClick={() => setSelectedIds([])}
                  className="text-xs font-bold text-slate-500 hover:underline"
                >
                  取消全选
                </button>
              </div>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              <table className="w-full text-left">
                <tbody className="divide-y divide-[var(--border-color)]">
                  {images.map((img) => (
                    <tr 
                      key={img.id} 
                      className={cn(
                        "hover:bg-[var(--bg-primary)] transition-colors cursor-pointer",
                        selectedIds.includes(img.id) && "bg-blue-50/50 dark:bg-blue-900/10"
                      )}
                      onClick={() => {
                        setSelectedIds(prev => 
                          prev.includes(img.id) ? prev.filter(id => id !== img.id) : [...prev, img.id]
                        );
                      }}
                    >
                      <td className="px-6 py-3 w-10">
                        <div className={cn(
                          "w-5 h-5 rounded border flex items-center justify-center transition-all",
                          selectedIds.includes(img.id) ? "bg-blue-600 border-blue-600" : "border-[var(--border-color)] bg-white dark:bg-slate-800"
                        )}>
                          {selectedIds.includes(img.id) && <Check className="w-3 h-3 text-white" />}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="w-10 h-10 rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <img src={img.url} alt={img.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-[var(--text-primary)]">{img.name}</td>
                      <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">{img.resolution}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 bg-[var(--bg-primary)] border-t border-[var(--border-color)]">
              <p className="text-xs text-[var(--text-secondary)]">已选择 <span className="font-bold text-blue-600">{selectedIds.length}</span> 张图片</p>
            </div>
          </div>
        </div>

        {/* Right: Rule Configuration */}
        <div className="space-y-6">
          <div className="card p-6 space-y-6">
            <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase flex items-center">
              <Settings2 className="w-4 h-4 mr-2 text-blue-500" /> 命名规则配置
            </h3>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--text-secondary)] uppercase">前缀</label>
                <div className="relative">
                  <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
                  <input 
                    type="text" 
                    value={namingRule.prefix}
                    onChange={e => setNamingRule(prev => ({ ...prev, prefix: e.target.value }))}
                    className="w-full pl-10 pr-4 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20" 
                    placeholder="例如: task1_"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--text-secondary)] uppercase">后缀</label>
                <div className="relative">
                  <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
                  <input 
                    type="text" 
                    value={namingRule.suffix}
                    onChange={e => setNamingRule(prev => ({ ...prev, suffix: e.target.value }))}
                    className="w-full pl-10 pr-4 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20" 
                    placeholder="例如: _final"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[var(--text-secondary)] uppercase">起始序号</label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
                    <input 
                      type="number" 
                      value={namingRule.startNumber}
                      onChange={e => setNamingRule(prev => ({ ...prev, startNumber: parseInt(e.target.value) || 0 }))}
                      className="w-full pl-10 pr-4 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20" 
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[var(--text-secondary)] uppercase">序号位数</label>
                  <select 
                    value={namingRule.digits}
                    onChange={e => setNamingRule(prev => ({ ...prev, digits: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value={1}>1位 (1)</option>
                    <option value={2}>2位 (01)</option>
                    <option value={3}>3位 (001)</option>
                    <option value={4}>4位 (0001)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <label className="flex items-center space-x-3 cursor-pointer group">
                  <div 
                    onClick={() => setNamingRule(prev => ({ ...prev, useTimestamp: !prev.useTimestamp }))}
                    className={cn(
                      "w-5 h-5 rounded border flex items-center justify-center transition-all",
                      namingRule.useTimestamp ? "bg-blue-600 border-blue-600" : "border-[var(--border-color)] bg-white dark:bg-slate-800"
                    )}
                  >
                    {namingRule.useTimestamp && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 mr-2 text-[var(--text-secondary)]" />
                    <span className="text-sm text-[var(--text-primary)]">包含时间戳</span>
                  </div>
                </label>

                <label className="flex items-center space-x-3 cursor-pointer group">
                  <div 
                    onClick={() => setNamingRule(prev => ({ ...prev, useOriginalName: !prev.useOriginalName }))}
                    className={cn(
                      "w-5 h-5 rounded border flex items-center justify-center transition-all",
                      namingRule.useOriginalName ? "bg-blue-600 border-blue-600" : "border-[var(--border-color)] bg-white dark:bg-slate-800"
                    )}
                  >
                    {namingRule.useOriginalName && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div className="flex items-center">
                    <FileText className="w-4 h-4 mr-2 text-[var(--text-secondary)]" />
                    <span className="text-sm text-[var(--text-primary)]">包含原文件名</span>
                  </div>
                </label>
              </div>

              <div className="space-y-1.5 pt-2">
                <label className="text-xs font-bold text-[var(--text-secondary)] uppercase flex items-center">
                  <Copy className="w-3 h-3 mr-1" /> 重复文件处理
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['skip', 'overwrite', 'rename'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setNamingRule(prev => ({ ...prev, duplicateHandling: mode }))}
                      className={cn(
                        "px-2 py-1.5 text-[10px] font-bold rounded-lg border transition-all",
                        namingRule.duplicateHandling === mode 
                          ? "bg-blue-600 border-blue-600 text-white" 
                          : "bg-[var(--bg-primary)] border-[var(--border-color)] text-[var(--text-secondary)] hover:border-blue-500/50"
                      )}
                    >
                      {mode === 'skip' ? '跳过' : mode === 'overwrite' ? '覆盖' : '重命名'}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-[var(--text-secondary)] leading-tight">
                  {namingRule.duplicateHandling === 'skip' && "检测到重名时，将不处理该文件。"}
                  {namingRule.duplicateHandling === 'overwrite' && "检测到重名时，将直接覆盖目标文件。"}
                  {namingRule.duplicateHandling === 'rename' && "检测到重名时，将自动在文件名后添加数字序号。"}
                </p>
              </div>
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
              <p className="text-[10px] font-bold text-blue-600 uppercase mb-2">命名示例</p>
              <p className="text-sm font-mono font-bold text-blue-700 dark:text-blue-400 break-all">
                {exampleName}
              </p>
            </div>

            <button 
              onClick={() => setView('preview')}
              disabled={selectedIds.length === 0}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 disabled:shadow-none"
            >
              预览命名结果
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderNamingPreview = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button onClick={() => setView('naming')} className="p-2 hover:bg-[var(--bg-secondary)] rounded-lg text-[var(--text-secondary)]">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">命名预览</h2>
        </div>
        <button 
          onClick={() => {
            // 真实应用重命名：改写图片列表中的名称（成功项才改名）
            const map = new Map(previewResults.filter(r => r.status === 'success').map(r => [r.originalName, r.newName]));
            setImages(prev => prev.map(img => map.has(img.name) ? { ...img, name: map.get(img.name)! } : img));
            setResults(previewResults);
            setView('result');
            notify(`批量命名已执行：${map.size} 个文件成功重命名，列表已同步更新`, 'success');
          }}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all"
        >
          执行命名
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border-color)] bg-[var(--bg-primary)]">
          <p className="text-sm text-[var(--text-secondary)]">
            即将对 <span className="font-bold text-blue-600">{selectedIds.length}</span> 张图片进行重命名操作，请核对：
          </p>
        </div>
        <div className="max-h-[600px] overflow-y-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[var(--bg-primary)] text-[var(--text-secondary)] text-xs uppercase tracking-wider sticky top-0 z-10">
                <th className="px-6 py-4 font-semibold">原文件名</th>
                <th className="px-6 py-4 font-semibold w-10"></th>
                <th className="px-6 py-4 font-semibold">新文件名</th>
                <th className="px-6 py-4 font-semibold text-right">状态</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {previewResults.map((res, i) => (
                <tr key={i} className="hover:bg-[var(--bg-primary)] transition-colors">
                  <td className="px-6 py-4 text-sm text-[var(--text-secondary)] font-mono">{res.originalName}</td>
                  <td className="px-6 py-4 text-center">
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </td>
                  <td className="px-6 py-4 text-sm text-blue-600 font-mono font-bold">{res.newName}</td>
                  <td className="px-6 py-4 text-right">
                    {res.status === 'success' ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 dark:bg-blue-900/20 font-bold uppercase">Ready</span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 dark:bg-amber-900/20 font-bold uppercase">Skipped</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderExecutionResult = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">执行结果</h2>
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => setView('list')}
            className="px-4 py-2 border border-[var(--border-color)] rounded-lg text-sm font-medium hover:bg-[var(--bg-secondary)]"
          >
            返回列表
          </button>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/20 flex items-center">
            <Download className="w-4 h-4 mr-2" /> 导出结果
          </button>
        </div>
      </div>

      {/* Status Card */}
      <div className="card p-8 text-center space-y-4">
        <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-[var(--text-primary)]">批量命名执行成功</h3>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            共处理 {results.length} 个文件，成功 {results.filter(r => r.status === 'success' && r.newName !== '(已跳过)').length} 个，跳过 {results.filter(r => r.newName === '(已跳过)').length} 个，失败 0 个
          </p>
        </div>
      </div>

      {/* Result List */}
      <div className="card overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-[var(--bg-primary)] text-[var(--text-secondary)] text-xs uppercase tracking-wider">
              <th className="px-6 py-4 font-semibold">原文件名</th>
              <th className="px-6 py-4 font-semibold">新文件名</th>
              <th className="px-6 py-4 text-right">执行状态</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-color)]">
            {results.map((res, i) => (
              <tr key={i} className="hover:bg-[var(--bg-primary)] transition-colors">
                <td className="px-6 py-4 text-sm text-[var(--text-secondary)] font-mono">{res.originalName}</td>
                <td className="px-6 py-4 text-sm text-[var(--text-primary)] font-mono font-medium">{res.newName}</td>
                <td className="px-6 py-4 text-right">
                  {res.newName === '(已跳过)' ? (
                    <span className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 dark:bg-amber-900/20 font-bold uppercase">
                      <AlertCircle className="w-3 h-3 mr-1" /> Skipped
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 font-bold uppercase">
                      <Check className="w-3 h-3 mr-1" /> Success
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (view) {
      case 'naming': return renderBatchNaming();
      case 'preview': return renderNamingPreview();
      case 'result': return renderExecutionResult();
      case 'list':
      default: return renderImageProcessing();
    }
  };

  return (
    <div className="h-full">
      <AnimatePresence mode="wait">
        <motion.div
          key={`${activeSubTab}-${view}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="h-full"
        >
          {renderContent()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
