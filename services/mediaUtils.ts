
/**
 * Generates an optimized WebP thumbnail from a video file.
 * Captures the frame at the 1-second mark (or 0.1 if video is short).
 * Resizes large dimensions to max 640px width/height while maintaining aspect ratio.
 */
export const generateVideoThumbnail = async (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    // Create a video element
    const video = document.createElement('video');
    
    // Create a canvas element
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Handle Metadata Load
    video.onloadedmetadata = () => {
      // Seek to 1 second to capture a representative frame (avoid black start frames)
      // If video is shorter than 1s, seek to middle
      video.currentTime = Math.min(1, video.duration / 2);
    };

    // Handle Seek Completion (Frame Ready)
    video.onseeked = () => {
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      // Calculate new dimensions (Max 640px)
      const MAX_DIMENSION = 640;
      let width = video.videoWidth;
      let height = video.videoHeight;

      if (width > height) {
        if (width > MAX_DIMENSION) {
          height = height * (MAX_DIMENSION / width);
          width = MAX_DIMENSION;
        }
      } else {
        if (height > MAX_DIMENSION) {
          width = width * (MAX_DIMENSION / height);
          height = MAX_DIMENSION;
        }
      }

      // Set canvas size
      canvas.width = width;
      canvas.height = height;

      // Draw video frame to canvas
      ctx.drawImage(video, 0, 0, width, height);

      // Convert to WebP Blob
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Thumbnail generation failed"));
          }
          
          // Cleanup
          URL.revokeObjectURL(video.src);
          video.remove();
          canvas.remove();
        },
        'image/webp',
        0.8 // Quality (0.0 - 1.0)
      );
    };

    video.onerror = (e) => {
      reject(new Error("Error loading video for thumbnail generation"));
    };

    // Initialize Video
    video.preload = 'metadata';
    video.src = URL.createObjectURL(file);
    video.muted = true;
    video.playsInline = true;
  });
};
