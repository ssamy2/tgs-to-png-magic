import lottie, { AnimationItem } from 'lottie-web';
import pako from 'pako';

export interface ConvertedImage {
  name: string;
  dataUrl: string;
}

export const convertTgsToFrame = async (file: File): Promise<ConvertedImage> => {
  return new Promise(async (resolve, reject) => {
    try {
      // Read the .tgs file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      
      // Decompress the gzip data
      const decompressed = pako.ungzip(new Uint8Array(arrayBuffer), { to: 'string' });
      
      // Parse JSON
      const animationData = JSON.parse(decompressed);
      
      // Create a temporary container
      const container = document.createElement('div');
      container.style.width = '512px';
      container.style.height = '512px';
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      document.body.appendChild(container);
      
      // Load animation
      const animation: AnimationItem = lottie.loadAnimation({
        container,
        renderer: 'canvas',
        loop: false,
        autoplay: false,
        animationData,
      });
      
      // Wait for the animation to be ready
      animation.addEventListener('DOMLoaded', () => {
        try {
          // Go to first frame
          animation.goToAndStop(0, true);
          
          // Small delay to ensure render is complete
          setTimeout(() => {
            const canvas = container.querySelector('canvas');
            
            if (!canvas) {
              throw new Error('Canvas not found');
            }
            
            // Convert to PNG
            const dataUrl = canvas.toDataURL('image/png');
            
            // Cleanup
            animation.destroy();
            document.body.removeChild(container);
            
            // Extract filename without extension
            const nameWithoutExt = file.name.replace('.tgs', '');
            
            resolve({
              name: `${nameWithoutExt}.png`,
              dataUrl,
            });
          }, 100);
        } catch (error) {
          animation.destroy();
          document.body.removeChild(container);
          reject(error);
        }
      });
      
      animation.addEventListener('error', () => {
        animation.destroy();
        document.body.removeChild(container);
        reject(new Error('Failed to load animation'));
      });
      
    } catch (error) {
      reject(error);
    }
  });
};

export const downloadImage = (dataUrl: string, filename: string) => {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
