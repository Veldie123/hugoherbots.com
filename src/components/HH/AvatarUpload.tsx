import { useState, useRef } from "react";
import { Button } from "../ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "../ui/avatar";
import { Upload, Loader2, User } from "lucide-react";
import { uploadAvatar, getAvatarUrl } from "../../utils/storage";
import { Alert, AlertDescription } from "../ui/alert";

interface AvatarUploadProps {
  userId: string;
  accessToken: string;
  currentAvatarUrl?: string | null;
  onUploadSuccess?: (newAvatarUrl: string) => void;
}

export function AvatarUpload({ 
  userId, 
  accessToken, 
  currentAvatarUrl,
  onUploadSuccess 
}: AvatarUploadProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(currentAvatarUrl || null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Alleen afbeeldingen zijn toegestaan');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Bestand te groot (max 5MB)');
      return;
    }

    setError(null);
    setUploading(true);

    try {
      const result = await uploadAvatar(file, accessToken);

      if ('error' in result) {
        setError(result.error);
        setUploading(false);
        return;
      }

      setAvatarUrl(result.avatarUrl);
      onUploadSuccess?.(result.avatarUrl);
      setUploading(false);

    } catch (err: any) {
      console.error('❌ Upload failed:', err);
      setError(err.message || 'Upload mislukt');
      setUploading(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-6">
        {/* Avatar preview */}
        <Avatar className="w-24 h-24 rounded-full border-2 border-hh-border">
          <AvatarImage src={avatarUrl || undefined} alt="User avatar" />
          <AvatarFallback className="bg-hh-ui-100 text-hh-text">
            <User className="w-12 h-12 text-hh-muted" />
          </AvatarFallback>
        </Avatar>

        {/* Upload button */}
        <div className="flex-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            variant="outline"
            onClick={handleUploadClick}
            disabled={uploading}
            className="gap-2"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploaden...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Wijzig foto
              </>
            )}
          </Button>
          <p className="text-[14px] leading-[20px] text-hh-muted mt-2">
            JPG, PNG of GIF. Max 5MB.
          </p>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
