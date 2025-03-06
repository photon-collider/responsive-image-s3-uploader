import React, { useState, useRef } from 'react';
import { Button } from '@components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@components/ui/card';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';
interface UploadResult {
  originalUrl: string;
  responsiveUrls: {
    [key: string]: string;
  };
  altText: string;
  folderName: string;
}

const FileUploadForm: React.FC = () => {
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [folderName, setFolderName] = useState<string>('');
  const [altText, setAltText] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      validateAndSetFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      validateAndSetFile(file);
    }
  };

  const validateAndSetFile = (file: File) => {
    setError(null);
    
    // Check if it's an image
    if (!file.type.match('image.*')) {
      setError('Please select an image file');
      return;
    }
    
    // Check file size (limit to 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size should be less than 10MB');
      return;
    }
    
    setSelectedFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedFile) {
      setError('Please select a file');
      return;
    }
    
    if (!folderName.trim()) {
      setError('Please provide a folder name');
      return;
    }
    
    if (!altText.trim()) {
      setError('Please provide alt text for the image');
      return;
    }
    
    setIsUploading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('image', selectedFile);
      formData.append('folderName', folderName);
      formData.append('altText', altText);
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Upload failed');
      }
      
      // Set the upload result
      setUploadResult(result.data);
      
      // Reset form after successful upload
      setSelectedFile(null);
      setFolderName('');
      setAltText('');
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    } catch (err) {
      setError('Error uploading file. Please try again.');
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setUploadResult(null);
    setSelectedFile(null);
    setFolderName('');
    setAltText('');
    setError(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  // Render the results after successful upload
  if (uploadResult) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Upload Successful!</CardTitle>
          <CardDescription>
            Your responsive images have been generated and uploaded
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Original Image:</h3>
            <a 
              href={uploadResult.originalUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-blue-600 break-all"
            >
              {uploadResult.originalUrl}
            </a>
          </div>
          
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Responsive Versions:</h3>
            <ul className="space-y-1 pl-5 list-disc">
              {Object.entries(uploadResult.responsiveUrls).map(([size, url]) => (
                <li key={size}>
                  <span className="font-medium">
                    {size === 'sm' ? 'Small (640px)' : 
                     size === 'md' ? 'Medium (1024px)' : 
                     size === 'lg' ? 'Large (1920px)' : 
                     'Extra Large (2560px)'}:
                  </span>{' '}
                  <a 
                    href={url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 break-all"
                  >
                    {url}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Alt Text:</h3>
            <p className="text-sm">{uploadResult.altText}</p>
          </div>
          
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Folder Name:</h3>
            <p className="text-sm">{uploadResult.folderName}</p>
          </div>
        </CardContent>
        
        <CardFooter>
          <Button 
            type="button"
            className="w-full"
            onClick={resetForm}
          >
            Upload Another Image
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // Render the upload form
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Upload Responsive Image</CardTitle>
        <CardDescription>
          Upload an image to generate responsive versions in your DigitalOcean Spaces bucket
        </CardDescription>
      </CardHeader>
      
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6">
          {/* Folder Name Input */}
          <div className="space-y-2">
            <Label htmlFor="folderName">Folder Name</Label>
            <Input 
              id="folderName"
              type="text"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="e.g., blog-images/2023/post-1"
              required
            />
          </div>
          
          {/* Alt Text Input */}
          <div className="space-y-2">
            <Label htmlFor="altText">Alt Text</Label>
            <Textarea 
              id="altText"
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              placeholder="Describe the image for accessibility"
              required
            />
          </div>
          
          {/* File Upload Zone */}
          <div 
            className={`border-2 border-dashed rounded-lg p-8 text-center ${
              dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
            } ${selectedFile ? 'bg-green-50 border-green-400' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              ref={inputRef}
              id="fileInput"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            
            <div className="flex flex-col items-center justify-center space-y-3">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-12 w-12 text-muted-foreground"
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={1.5} 
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" 
                />
              </svg>
              
              {selectedFile ? (
                <p className="text-sm font-medium">
                  Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Drag and drop an image here, or click to select
                </p>
              )}
              
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={() => inputRef.current?.click()}
              >
                Select Image
              </Button>
            </div>
          </div>
          
          {/* Error Message */}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </CardContent>
        
        <CardFooter>
          <Button 
            type="submit"
            className="w-full mt-4"
            disabled={isUploading || !selectedFile}
          >
            {isUploading ? 'Uploading...' : 'Upload'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};

export default FileUploadForm;