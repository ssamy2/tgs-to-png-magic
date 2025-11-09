import { useState } from "react";
import { FileUploadZone } from "@/components/FileUploadZone";
import { ConversionProgress } from "@/components/ConversionProgress";
import { ImagePreviewCard } from "@/components/ImagePreviewCard";
import { ThemeToggle } from "@/components/ThemeToggle";
import { convertTgsToFrame, downloadImage, ConvertedImage } from "@/utils/tgsConverter";
import { Sticker } from "lucide-react";
import { toast } from "sonner";

const Index = () => {
  const [isConverting, setIsConverting] = useState(false);
  const [totalFiles, setTotalFiles] = useState(0);
  const [completedFiles, setCompletedFiles] = useState(0);
  const [currentFile, setCurrentFile] = useState<string>('');
  const [convertedImages, setConvertedImages] = useState<ConvertedImage[]>([]);

  const handleFilesSelected = async (files: File[]) => {
    setIsConverting(true);
    setTotalFiles(files.length);
    setCompletedFiles(0);
    setConvertedImages([]);

    const results: ConvertedImage[] = [];

    for (const file of files) {
      setCurrentFile(file.name);
      try {
        const result = await convertTgsToFrame(file);
        results.push(result);
        setCompletedFiles(prev => prev + 1);
      } catch (error) {
        console.error(`Error converting ${file.name}:`, error);
        toast.error(`Failed to convert ${file.name}`);
        setCompletedFiles(prev => prev + 1);
      }
    }

    setConvertedImages(results);
    setIsConverting(false);
    setCurrentFile('');
    
    if (results.length > 0) {
      toast.success(`Successfully converted ${results.length} sticker${results.length > 1 ? 's' : ''}!`);
    }
  };

  const handleDownload = (image: ConvertedImage) => {
    downloadImage(image.dataUrl, image.name);
  };

  return (
    <div className="min-h-screen bg-background transition-colors">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary text-primary-foreground rounded-xl p-2">
              <Sticker className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">TGS to PNG Converter</h1>
              <p className="text-xs text-muted-foreground">Convert Telegram stickers instantly</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="space-y-8">
          {/* Upload Section */}
          {!isConverting && convertedImages.length === 0 && (
            <div className="max-w-2xl mx-auto">
              <FileUploadZone onFilesSelected={handleFilesSelected} />
              
              <div className="mt-6 text-center text-sm text-muted-foreground">
                <p>Supports .tgs (Telegram Lottie Sticker) files</p>
                <p className="mt-1">All conversion happens in your browser - no uploads!</p>
              </div>
            </div>
          )}

          {/* Progress Section */}
          {isConverting && (
            <div className="max-w-2xl mx-auto">
              <ConversionProgress
                total={totalFiles}
                completed={completedFiles}
                current={currentFile}
              />
            </div>
          )}

          {/* Results Section */}
          {convertedImages.length > 0 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Converted Stickers</h2>
                  <p className="text-muted-foreground">
                    {convertedImages.length} sticker{convertedImages.length > 1 ? 's' : ''} ready to download
                  </p>
                </div>
                <button
                  onClick={() => {
                    setConvertedImages([]);
                    setTotalFiles(0);
                    setCompletedFiles(0);
                  }}
                  className="text-sm text-primary hover:underline"
                >
                  Convert More
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {convertedImages.map((image, index) => (
                  <ImagePreviewCard
                    key={index}
                    name={image.name}
                    dataUrl={image.dataUrl}
                    onDownload={() => handleDownload(image)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-16">
        <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          <p>Free & open-source • 100% client-side • No data leaves your device</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
