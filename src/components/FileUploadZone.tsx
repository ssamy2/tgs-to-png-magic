import { Upload } from "lucide-react";
import { useRef, useState } from "react";

interface FileUploadZoneProps {
  onFilesSelected: (files: File[]) => void;
}

export const FileUploadZone = ({ onFilesSelected }: FileUploadZoneProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files).filter(file => 
      file.name.endsWith('.tgs')
    );
    
    if (files.length > 0) {
      onFilesSelected(files);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(file =>
      file.name.endsWith('.tgs')
    );
    
    if (files.length > 0) {
      onFilesSelected(files);
    }
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      className={`
        relative cursor-pointer rounded-2xl border-2 border-dashed 
        transition-all duration-200 p-12
        ${isDragging 
          ? 'border-primary bg-secondary' 
          : 'border-border hover:border-primary hover:bg-secondary/50'
        }
      `}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".tgs"
        onChange={handleFileInput}
        className="hidden"
      />
      
      <div className="flex flex-col items-center gap-4 text-center">
        <div className={`
          rounded-full p-6 transition-colors
          ${isDragging ? 'bg-primary/10' : 'bg-muted'}
        `}>
          <Upload className={`h-8 w-8 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
        </div>
        
        <div>
          <h3 className="text-lg font-semibold mb-1">
            {isDragging ? 'Drop your stickers here' : 'Upload Telegram Stickers'}
          </h3>
          <p className="text-sm text-muted-foreground">
            Drag and drop .tgs files or click to browse
          </p>
        </div>
      </div>
    </div>
  );
};
