import { Download, FileImage } from "lucide-react";
import { Button } from "./ui/button";

interface ImagePreviewCardProps {
  name: string;
  dataUrl: string;
  onDownload: () => void;
}

export const ImagePreviewCard = ({ name, dataUrl, onDownload }: ImagePreviewCardProps) => {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden hover:shadow-lg transition-shadow">
      <div className="aspect-square bg-muted flex items-center justify-center p-4">
        <img 
          src={dataUrl} 
          alt={name}
          className="max-w-full max-h-full object-contain"
        />
      </div>
      
      <div className="p-4 space-y-3">
        <div className="flex items-start gap-2">
          <FileImage className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <p className="text-sm font-medium truncate flex-1">{name}</p>
        </div>
        
        <Button 
          onClick={onDownload}
          className="w-full"
          size="sm"
        >
          <Download className="h-4 w-4 mr-2" />
          Download PNG
        </Button>
      </div>
    </div>
  );
};
