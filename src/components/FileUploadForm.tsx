import React, { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Loader2 } from 'lucide-react';

interface Bucket {
  name: string;
  creationDate?: Date;
}

interface UploadResult {
  originalUrl: string;
  responsiveUrls: {
    [key: string]: string;
  };
  altText: string;
  folderName: string;
  bucketName: string;
}

interface Props {
  originalBucket: string
}

const FileUploadForm: React.FC<Props> = ({originalBucket}) => {
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [altText, setAltText] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  
  // Bucket state
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [isLoadingBuckets, setIsLoadingBuckets] = useState<boolean>(false);
  const [selectedBucket, setSelectedBucket] = useState<string>('');
  
  // Folder state
  const [folders, setFolders] = useState<string[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState<boolean>(false);
  const [folderOption, setFolderOption] = useState<'existing' | 'new'>('existing');
  const [selectedExistingFolder, setSelectedExistingFolder] = useState<string>('');
  const [newFolderName, setNewFolderName] = useState<string>('');
  
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Fetch buckets on component mount
  useEffect(() => {
    const fetchBuckets = async () => {
      setIsLoadingBuckets(true);
      try {
        const response = await fetch('/api/buckets');
        const data = await response.json();
        
        const allowedBuckets = data.buckets.filter((bucket: any) => bucket.name != originalBucket)

        if (data.success && Array.isArray(data.buckets)) {
          setBuckets(allowedBuckets);
          
          // Set the first bucket as selected if there are any
          if (allowedBuckets.length > 0) {
            setSelectedBucket(allowedBuckets[0].name);
          }
        } else {
          throw new Error(data.error || 'Failed to fetch buckets');
        }
      } catch (err) {
        console.error('Error fetching buckets:', err);
        setError('Failed to load buckets. Please check your S3 configuration.');
      } finally {
        setIsLoadingBuckets(false);
      }
    };
    
    fetchBuckets();
  }, []);
  
  // Fetch folders when a bucket is selected
  useEffect(() => {
    if (!selectedBucket) return;
    
    const fetchFolders = async () => {
      setIsLoadingFolders(true);
      try {
        const response = await fetch(`/api/folders?bucket=${encodeURIComponent(selectedBucket)}`);
        const data = await response.json();
        
        if (data.success && Array.isArray(data.folders)) {
          setFolders(data.folders);
          
          // Set the first folder as selected if there are any
          if (data.folders.length > 0) {
            setSelectedExistingFolder(data.folders[0]);
            setFolderOption('existing');
          } else {
            // If no folders, default to creating a new one
            setFolderOption('new');
          }
        } else {
          throw new Error(data.error || 'Failed to fetch folders');
        }
      } catch (err) {
        console.error('Error fetching folders:', err);
        setError('Failed to load folders. You can still create a new folder.');
        setFolderOption('new');
      } finally {
        setIsLoadingFolders(false);
      }
    };
    
    fetchFolders();
  }, [selectedBucket]);

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
    
    if (!selectedBucket) {
      setError('Please select a bucket');
      return;
    }
    
    if (!selectedFile) {
      setError('Please select a file');
      return;
    }
    
    // Determine the folder name based on selection
    let targetFolderName = '';
    
    if (folderOption === 'existing') {
      if (!selectedExistingFolder) {
        setError('Please select a folder');
        return;
      }
      targetFolderName = selectedExistingFolder;
    } else {
      if (!newFolderName.trim()) {
        setError('Please provide a new folder name');
        return;
      }
      targetFolderName = newFolderName.trim();
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
      formData.append('folderName', targetFolderName);
      formData.append('altText', altText);
      formData.append('bucketName', selectedBucket);
      
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
      setNewFolderName('');
      setAltText('');
      if (inputRef.current) {
        inputRef.current.value = '';
      }
      
      // If a new folder was created, add it to the folders list
      if (folderOption === 'new' && !folders.includes(targetFolderName)) {
        setFolders([...folders, targetFolderName]);
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
    setNewFolderName('');
    setAltText('');
    setError(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    
    // Reset to default folder option
    if (folders.length > 0) {
      setFolderOption('existing');
      setSelectedExistingFolder(folders[0]);
    } else {
      setFolderOption('new');
    }
  };

  // Render the results after successful upload
  if (uploadResult) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Upload Successful!</CardTitle>
          <CardDescription>
            Your responsive images have been generated and uploaded
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Bucket:</h3>
            <p className="text-sm">{uploadResult.bucketName}</p>
          </div>
          
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Folder:</h3>
            <p className="text-sm">{uploadResult.folderName}</p>
          </div>
          
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
          Upload an image to generate responsive versions in your S3-compatible storage
        </CardDescription>
      </CardHeader>
      
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-5">
          {/* Bucket Selection */}
          <div className="space-y-2">
            <Label htmlFor="bucketSelect">Select Bucket</Label>
            {isLoadingBuckets ? (
              <div className="flex items-center space-x-2 py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Loading buckets...</span>
              </div>
            ) : buckets.length === 0 ? (
              <div className="text-sm text-destructive py-2">
                No buckets found. Please check your S3 configuration.
              </div>
            ) : (
              <Select 
                value={selectedBucket} 
                onValueChange={(value) => {
                  setSelectedBucket(value);
                  // Reset folder-related state when bucket changes
                  setFolders([]);
                  setSelectedExistingFolder('');
                }}
              >
                <SelectTrigger id="bucketSelect">
                  <SelectValue placeholder="Select a bucket" />
                </SelectTrigger>
                <SelectContent>
                  {buckets.map((bucket) => (
                    <SelectItem key={bucket.name} value={bucket.name}>
                      {bucket.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          
          {/* Folder Selection */}
          {selectedBucket && (
            <div className="space-y-2">
              <div>
                <Label className="mb-2">Folder Options</Label>
                <RadioGroup 
                  value={folderOption} 
                  onValueChange={(value) => setFolderOption(value as 'existing' | 'new')}
                  className="mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="existing" id="existing" disabled={folders.length === 0 || isLoadingFolders} />
                    <Label htmlFor="existing" className={`${folders.length === 0 && !isLoadingFolders ? 'opacity-50' : ''}`}>
                      Select Existing Folder {isLoadingFolders && <Loader2 className="inline-block ml-2 h-4 w-4 animate-spin" />}
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="new" id="new" />
                    <Label htmlFor="new">Create New Folder</Label>
                  </div>
                </RadioGroup>
              </div>
              
              {folderOption === 'existing' && (
                <div className="space-y-2">
                  <Label htmlFor="existingFolder">Select Folder</Label>
                  {isLoadingFolders ? (
                    <div className="flex items-center space-x-2 py-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Loading folders...</span>
                    </div>
                  ) : folders.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-2">
                      No folders found. Please create a new folder.
                    </div>
                  ) : (
                    <Select 
                      value={selectedExistingFolder} 
                      onValueChange={setSelectedExistingFolder}
                    >
                      <SelectTrigger id="existingFolder">
                        <SelectValue placeholder="Select a folder" />
                      </SelectTrigger>
                      <SelectContent>
                        {folders.map((folder) => (
                          <SelectItem key={folder} value={folder}>{folder}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
              
              {folderOption === 'new' && (
                <div className="space-y-2">
                  <Label htmlFor="newFolderName">New Folder Name</Label>
                  <Input 
                    id="newFolderName"
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="e.g., blog-images"
                    required={folderOption === 'new'}
                  />
                  <p className="text-xs text-muted-foreground">
                    This will create a new top-level folder in your bucket
                  </p>
                </div>
              )}
            </div>
          )}
          
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
                className='cursor-pointer'
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
        
        <CardFooter className='mt-4'>
          <Button 
            type="submit"
            className="w-full"
            disabled={isUploading || !selectedFile || !selectedBucket}
          >
            {isUploading ? 'Uploading...' : 'Upload'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};

export default FileUploadForm;