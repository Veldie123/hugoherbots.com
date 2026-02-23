import { useState, useRef, useCallback } from "react";
import * as UpChunk from "@mux/upchunk";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileVideo, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { videoApi } from "@/services/videoApi";

type UploadStatus = "idle" | "uploading" | "processing" | "complete" | "error";

interface VideoUploadProps {
  onUploadComplete?: (videoId: string) => void;
  className?: string;
}

export function VideoUpload({ onUploadComplete, className = "" }: VideoUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [courseModule, setCourseModule] = useState("");
  const [techniqueId, setTechniqueId] = useState("");
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<UpChunk.UpChunk | null>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("video/")) {
      setSelectedFile(file);
      setErrorMessage("");
    } else {
      setErrorMessage("Alleen video bestanden zijn toegestaan");
    }
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setErrorMessage("");
    }
  }, []);

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const resetForm = useCallback(() => {
    setSelectedFile(null);
    setTitle("");
    setDescription("");
    setCourseModule("");
    setTechniqueId("");
    setUploadStatus("idle");
    setUploadProgress(0);
    setErrorMessage("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleUploadClick = useCallback(async () => {
    if (!selectedFile || !title.trim()) {
      setErrorMessage("Titel is verplicht");
      return;
    }

    try {
      setUploadStatus("uploading");
      setUploadProgress(0);
      setErrorMessage("");

      const { upload_url, video_id } = await videoApi.createUpload({
        title: title.trim(),
        description: description.trim() || undefined,
        course_module: courseModule || undefined,
        technique_id: techniqueId.trim() || undefined,
      });

      const upload = UpChunk.createUpload({
        endpoint: upload_url,
        file: selectedFile,
        chunkSize: 5120,
      });

      uploadRef.current = upload;

      upload.on("progress", (progress) => {
        setUploadProgress(Math.round(progress.detail));
      });

      upload.on("success", () => {
        setUploadStatus("processing");
        
        setTimeout(() => {
          setUploadStatus("complete");
          if (onUploadComplete) {
            onUploadComplete(video_id);
          }
        }, 2000);
      });

      upload.on("error", (err) => {
        console.error("Upload error:", err);
        setUploadStatus("error");
        setErrorMessage(err.detail?.message || "Upload mislukt");
      });

    } catch (error: any) {
      console.error("Upload setup error:", error);
      setUploadStatus("error");
      setErrorMessage(error.message || "Kon upload niet starten");
    }
  }, [selectedFile, title, description, courseModule, techniqueId, onUploadComplete]);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Video Uploaden</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Titel *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Video titel"
              disabled={uploadStatus !== "idle"}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Beschrijving</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Korte beschrijving van de video..."
              disabled={uploadStatus !== "idle"}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="module">Fase / Module</Label>
              <Select value={courseModule} onValueChange={setCourseModule} disabled={uploadStatus !== "idle"}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer fase" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Voorbereiding">Voorbereiding</SelectItem>
                  <SelectItem value="Fase 1">Fase 1 - Openingsfase</SelectItem>
                  <SelectItem value="Fase 2">Fase 2 - Ontdekkingsfase</SelectItem>
                  <SelectItem value="Fase 3">Fase 3 - Aanbevelingsfase</SelectItem>
                  <SelectItem value="Fase 4">Fase 4 - Beslissingsfase</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="technique">Techniek ID</Label>
              <Input
                id="technique"
                value={techniqueId}
                onChange={(e) => setTechniqueId(e.target.value)}
                placeholder="Bijv. 1.1, 2.1.6"
                disabled={uploadStatus !== "idle"}
              />
            </div>
          </div>
        </div>

        {uploadStatus === "idle" && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleInputChange}
              className="hidden"
            />

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={handleBrowseClick}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragging 
                  ? "border-primary bg-primary/10" 
                  : selectedFile 
                    ? "border-green-500 bg-green-50" 
                    : "border-gray-300 hover:border-primary"
              }`}
            >
              {selectedFile ? (
                <div className="flex flex-col items-center gap-3">
                  <FileVideo className="w-12 h-12 text-green-500" />
                  <div>
                    <p className="font-medium">{selectedFile.name}</p>
                    <p className="text-sm text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Klik om een ander bestand te selecteren</p>
                </div>
              ) : (
                <>
                  <Upload className={`w-10 h-10 mx-auto mb-4 ${isDragging ? "text-primary" : "text-gray-400"}`} />
                  <p className="text-sm text-gray-600 mb-2">
                    {isDragging ? "Laat los om te uploaden" : "Sleep een video hierheen"}
                  </p>
                  <p className="text-xs text-gray-400 mb-4">of</p>
                  <Button variant="outline" type="button">
                    Bladeren
                  </Button>
                </>
              )}
            </div>

            {selectedFile && (
              <Button 
                onClick={handleUploadClick} 
                className="w-full"
                disabled={!title.trim()}
              >
                <Upload className="w-4 h-4 mr-2" />
                Video Uploaden
              </Button>
            )}

            {errorMessage && (
              <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg text-red-700 text-sm">
                <AlertCircle className="w-4 h-4" />
                {errorMessage}
              </div>
            )}
          </>
        )}

        {uploadStatus === "uploading" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="text-sm">Uploaden... {uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} className="h-2" />
            {selectedFile && (
              <p className="text-xs text-muted-foreground">{selectedFile.name}</p>
            )}
          </div>
        )}

        {uploadStatus === "processing" && (
          <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            <span className="text-sm text-blue-800">Video wordt verwerkt door Mux...</span>
          </div>
        )}

        {uploadStatus === "complete" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <span className="text-sm text-green-800">Video succesvol geupload!</span>
            </div>
            <Button onClick={resetForm} className="w-full">
              Nog een video uploaden
            </Button>
          </div>
        )}

        {uploadStatus === "error" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-red-50 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <span className="text-sm text-red-800">{errorMessage || "Er is een fout opgetreden"}</span>
            </div>
            <Button onClick={resetForm} variant="outline" className="w-full">
              Opnieuw proberen
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default VideoUpload;
