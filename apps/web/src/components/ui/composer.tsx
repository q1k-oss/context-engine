'use client';

import * as React from 'react';
import { Send, Paperclip, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ComposerContextValue {
  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  attachedFiles: AttachedFile[];
  addFile: (file: AttachedFile) => void;
  removeFile: (id: string) => void;
  onSubmit: () => void;
}

interface AttachedFile {
  id: string;
  name: string;
  status: 'uploading' | 'ready' | 'error';
}

const ComposerContext = React.createContext<ComposerContextValue | null>(null);

function useComposerContext() {
  const context = React.useContext(ComposerContext);
  if (!context) {
    throw new Error('Composer components must be used within a Composer');
  }
  return context;
}

interface ComposerProps extends React.HTMLAttributes<HTMLFormElement> {
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  isLoading?: boolean;
  children: React.ReactNode;
}

function Composer({
  input,
  onInputChange,
  onSubmit,
  isLoading = false,
  className,
  children,
  ...props
}: ComposerProps) {
  const [attachedFiles, setAttachedFiles] = React.useState<AttachedFile[]>([]);

  const addFile = React.useCallback((file: AttachedFile) => {
    setAttachedFiles((prev) => [...prev, file]);
  }, []);

  const removeFile = React.useCallback((id: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleSubmit = React.useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (input.trim() || attachedFiles.length > 0) {
        onSubmit();
        setAttachedFiles([]);
      }
    },
    [input, attachedFiles, onSubmit]
  );

  return (
    <ComposerContext.Provider
      value={{
        input,
        setInput: onInputChange,
        isLoading,
        attachedFiles,
        addFile,
        removeFile,
        onSubmit,
      }}
    >
      <form
        onSubmit={handleSubmit}
        className={cn('relative flex flex-col', className)}
        {...props}
      >
        {children}
      </form>
    </ComposerContext.Provider>
  );
}

function ComposerAttachments({ className }: { className?: string }) {
  const { attachedFiles, removeFile } = useComposerContext();

  if (attachedFiles.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap gap-2 mb-2', className)}>
      {attachedFiles.map((file) => (
        <div
          key={file.id}
          className={cn(
            'flex items-center gap-2 rounded-full px-3 py-1 text-sm',
            file.status === 'uploading' && 'bg-yellow-100 text-yellow-800',
            file.status === 'ready' && 'bg-green-100 text-green-800',
            file.status === 'error' && 'bg-red-100 text-red-800'
          )}
        >
          {file.status === 'uploading' && <Loader2 className="h-3 w-3 animate-spin" />}
          <span className="max-w-[150px] truncate">{file.name}</span>
          <button
            type="button"
            onClick={() => removeFile(file.id)}
            className="hover:opacity-70"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

interface ComposerInputAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

function ComposerInputArea({ className, children, ...props }: ComposerInputAreaProps) {
  return (
    <div
      className={cn(
        'flex items-end gap-2 rounded-2xl bg-muted p-2',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

interface ComposerInputProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> {}

function ComposerInput({ className, ...props }: ComposerInputProps) {
  const { input, setInput, isLoading, onSubmit } = useComposerContext();

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <textarea
      value={input}
      onChange={(e) => setInput(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder="Type a message..."
      rows={1}
      disabled={isLoading}
      className={cn(
        'flex-1 resize-none bg-transparent py-2 text-foreground placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed',
        className
      )}
      style={{ minHeight: '40px', maxHeight: '128px' }}
      {...props}
    />
  );
}

interface ComposerAttachButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  onFileSelect: (files: FileList) => void;
  accept?: string;
}

function ComposerAttachButton({
  onFileSelect,
  accept = '.pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.doc,.docx',
  className,
  ...props
}: ComposerAttachButtonProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { isLoading } = useComposerContext();

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files);
      e.target.value = '';
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading}
        className={cn(
          'shrink-0 p-2 text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed',
          className
        )}
        {...props}
      >
        <Paperclip className="h-5 w-5" />
      </button>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={accept}
        onChange={handleChange}
        className="hidden"
      />
    </>
  );
}

function ComposerSendButton({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { input, isLoading, attachedFiles } = useComposerContext();
  const isDisabled = isLoading || (!input.trim() && attachedFiles.length === 0);

  return (
    <button
      type="submit"
      disabled={isDisabled}
      className={cn(
        'shrink-0 rounded-full p-2 transition-colors',
        isDisabled
          ? 'cursor-not-allowed text-muted-foreground'
          : 'text-primary hover:bg-primary/10',
        className
      )}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <Send className="h-5 w-5" />
      )}
    </button>
  );
}

export {
  Composer,
  ComposerAttachments,
  ComposerInputArea,
  ComposerInput,
  ComposerAttachButton,
  ComposerSendButton,
  useComposerContext,
  type AttachedFile,
};
