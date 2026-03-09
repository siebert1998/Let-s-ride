import { DragEvent, useId, useState } from 'react';

interface UploadDropzoneProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

export function UploadDropzone({ onFileSelected, disabled = false }: UploadDropzoneProps): JSX.Element {
  const inputId = useId();
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const handleDragOver = (event: DragEvent<HTMLLabelElement>): void => {
    event.preventDefault();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (event: DragEvent<HTMLLabelElement>): void => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>): void => {
    event.preventDefault();
    setIsDragging(false);

    if (disabled) {
      return;
    }

    const file = event.dataTransfer.files?.[0];
    if (file) {
      onFileSelected(file);
    }
  };

  return (
    <label
      htmlFor={inputId}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`group flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-dashed bg-panelSoft/30 px-4 py-3 text-sm text-textMuted transition disabled:cursor-not-allowed ${
        isDragging ? 'border-accent bg-accent/10' : 'border-line hover:border-accent'
      }`}
    >
      <div>
        <p className="font-semibold text-textMain">Upload GPX route</p>
        <p className="text-xs text-textMuted">Drag and drop or click to browse your files.</p>
      </div>
      <span className="rounded-lg bg-accent px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-black transition group-hover:bg-accentStrong">
        Select
      </span>
      <input
        id={inputId}
        type="file"
        accept=".gpx,application/gpx+xml"
        disabled={disabled}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            onFileSelected(file);
          }
          event.target.value = '';
        }}
      />
    </label>
  );
}
