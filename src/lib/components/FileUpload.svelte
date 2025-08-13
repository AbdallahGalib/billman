<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { FileUploadEvent } from '../types';
  import { readFileAsText, getFileSize } from '../utils/helpers';
  import { validateField, fileSchema } from '../validation/schemas';

  // Props
  export let acceptedTypes: string[] = ['text/plain'];
  export let maxSize: number = 50 * 1024 * 1024; // 50MB
  export let disabled: boolean = false;

  // State
  let isDragOver = false;
  let uploadProgress = 0;
  let error: string | null = null;
  let isProcessing = false;
  let fileInputElement: HTMLInputElement;

  // Event dispatcher
  const dispatch = createEventDispatcher<{ fileSelect: FileUploadEvent }>();

  // Drag and drop handlers
  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    if (!disabled) {
      isDragOver = true;
    }
  }

  function handleDragLeave(event: DragEvent) {
    event.preventDefault();
    isDragOver = false;
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    isDragOver = false;
    
    if (disabled) return;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      handleFileSelection(files[0]);
    }
  }

  // File input handler
  function handleFileInput(event: Event) {
    const target = event.target as HTMLInputElement;
    const files = target.files;
    
    if (files && files.length > 0) {
      handleFileSelection(files[0]);
    }
  }

  // File validation and processing
  async function handleFileSelection(file: File) {
    error = null;
    uploadProgress = 0;
    isProcessing = true;

    try {
      // Validate file
      const validationResult = validateFile(file);
      if (!validationResult.isValid) {
        throw new Error(validationResult.error);
      }

      // Dispatch start event
      dispatch('fileSelect', {
        type: 'start',
        progress: 0
      });

      // Read file with progress simulation
      uploadProgress = 10;
      const content = await readFileAsText(file);
      
      uploadProgress = 50;
      
      // Simulate processing time for large files
      if (file.size > 1024 * 1024) { // 1MB
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      uploadProgress = 100;

      // Dispatch complete event with enhanced metadata
      dispatch('fileSelect', {
        type: 'complete',
        progress: 100,
        result: {
          content,
          filename: file.name,
          size: file.size,
          lastModified: new Date(file.lastModified),
          type: file.type
        }
      });

    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to process file';
      
      dispatch('fileSelect', {
        type: 'error',
        error: error
      });
    } finally {
      isProcessing = false;
      uploadProgress = 0;
      
      // Reset file input
      if (fileInputElement) {
        fileInputElement.value = '';
      }
    }
  }

  function validateFile(file: File): { isValid: boolean; error?: string } {
    // Check file type
    const typeError = validateField(file.type, fileSchema.type);
    if (typeError) {
      return { isValid: false, error: typeError };
    }

    // Check file size
    const sizeError = validateField(file.size, fileSchema.size);
    if (sizeError) {
      return { isValid: false, error: sizeError };
    }

    // Additional checks
    if (!file.name.toLowerCase().endsWith('.txt')) {
      return { isValid: false, error: 'Please select a .txt file' };
    }

    return { isValid: true };
  }

  function openFileDialog() {
    if (!disabled && fileInputElement) {
      fileInputElement.click();
    }
  }

  function clearError() {
    error = null;
  }
</script>

<div class="file-upload-container">
  <!-- Hidden file input -->
  <input
    bind:this={fileInputElement}
    type="file"
    accept=".txt,text/plain"
    on:change={handleFileInput}
    class="hidden"
    {disabled}
  />

  <!-- Drop zone -->
  <div
    class="file-drop-zone {isDragOver ? 'drag-over' : ''} {disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}"
    class:border-error={error}
    on:dragover={handleDragOver}
    on:dragleave={handleDragLeave}
    on:drop={handleDrop}
    on:click={openFileDialog}
    on:keydown={(e) => e.key === 'Enter' && openFileDialog()}
    role="button"
    tabindex="0"
  >
    {#if isProcessing}
      <!-- Processing state -->
      <div class="flex flex-col items-center space-y-4">
        <div class="loading-spinner"></div>
        <div class="text-center">
          <p class="text-lg font-medium">Processing file...</p>
          <div class="w-64 bg-base-200 rounded-full h-2 mt-2">
            <div 
              class="bg-primary h-2 rounded-full transition-all duration-300"
              style="width: {uploadProgress}%"
            ></div>
          </div>
          <p class="text-sm text-base-content/70 mt-1">{uploadProgress}%</p>
        </div>
      </div>
    {:else}
      <!-- Default state -->
      <div class="flex flex-col items-center space-y-4">
        <!-- Upload icon -->
        <svg 
          class="w-16 h-16 text-base-content/40" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            stroke-linecap="round" 
            stroke-linejoin="round" 
            stroke-width="2" 
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>

        <div class="text-center">
          <p class="text-xl font-semibold text-base-content">
            {isDragOver ? 'Drop your file here' : 'Upload WhatsApp Chat File'}
          </p>
          <p class="text-base-content/70 mt-2">
            Drag and drop your .txt file here, or click to browse
          </p>
          <p class="text-sm text-base-content/50 mt-1">
            Maximum file size: {getFileSize(maxSize)}
          </p>
        </div>

        <!-- Upload button -->
        <button 
          type="button"
          class="btn btn-primary btn-lg"
          {disabled}
          on:click|stopPropagation={openFileDialog}
        >
          <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          Choose File
        </button>
      </div>
    {/if}
  </div>

  <!-- Error message -->
  {#if error}
    <div class="alert alert-error mt-4">
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
      <div>
        <h3 class="font-bold">Upload Error</h3>
        <div class="text-xs">{error}</div>
      </div>
      <button class="btn btn-sm btn-ghost" on:click={clearError}>
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
  {/if}

  <!-- File format help -->
  <div class="mt-6 p-4 bg-base-200 rounded-lg">
    <h4 class="font-semibold text-base-content mb-2">Supported Format</h4>
    <p class="text-sm text-base-content/70 mb-2">
      Upload a WhatsApp chat export file (.txt) containing purchase transactions.
    </p>
    <div class="text-xs text-base-content/60">
      <p class="mb-1"><strong>Expected format:</strong></p>
      <code class="bg-base-300 px-2 py-1 rounded">
        DD/MM/YYYY, HH:MM [am/pm] - Sender: item amount
      </code>
    </div>
  </div>
</div>

<style>
  .file-drop-zone {
    @apply border-2 border-dashed border-base-300 rounded-lg p-8 text-center transition-all duration-200;
    min-height: 300px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .file-drop-zone.drag-over {
    @apply border-primary bg-primary bg-opacity-10 scale-105;
  }

  .file-drop-zone:hover:not(.drag-over) {
    border-color: hsl(var(--bc) / 0.3);
    background-color: hsl(var(--b2) / 0.5);
  }

  .file-drop-zone.border-error {
    border-color: hsl(var(--er));
  }

  .loading-spinner {
    @apply animate-spin rounded-full h-12 w-12 border-b-2 border-primary;
  }

  .hidden {
    display: none;
  }
</style>