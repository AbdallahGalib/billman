<script lang="ts">
  import { TextProcessor } from '../services/textProcessor';
  
  let textContent = '';
  let csvOutput = '';
  let isConverting = false;
  let fileInputElement: HTMLInputElement;
  
  const textProcessor = new TextProcessor();
  
  async function convertToCSV() {
    if (!textContent.trim()) return;
    
    isConverting = true;
    try {
      csvOutput = textProcessor.processWhatsAppToCSV(textContent);
    } catch (error) {
      console.error('Conversion error:', error);
    } finally {
      isConverting = false;
    }
  }
  
  function downloadCSV() {
    if (!csvOutput) return;
    
    const blob = new Blob([csvOutput], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'whatsapp-transactions.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
  
  async function handleFileUpload(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    
    try {
      const content = await file.text();
      textContent = content;
      target.value = '';
    } catch (error) {
      console.error('File read error:', error);
    }
  }
</script>

<div class="card bg-base-100 shadow-xl mb-6">
  <div class="card-body">
    <h2 class="card-title">WhatsApp Text to CSV Converter</h2>
    
    <div class="form-control">
      <label class="label">
        <span class="label-text">WhatsApp chat text:</span>
      </label>
      <textarea 
        bind:value={textContent}
        class="textarea textarea-bordered h-32" 
        placeholder="Paste your WhatsApp chat export here or upload a file below..."
      ></textarea>
    </div>
    
    <div class="form-control">
      <label class="label">
        <span class="label-text">Or upload TXT file:</span>
      </label>
      <input 
        bind:this={fileInputElement}
        type="file" 
        accept=".txt,text/plain"
        class="file-input file-input-bordered" 
        on:change={handleFileUpload}
      />
    </div>
    
    <div class="card-actions justify-end">
      <button 
        class="btn btn-primary" 
        class:loading={isConverting}
        disabled={!textContent.trim() || isConverting}
        on:click={convertToCSV}
      >
        Convert to CSV
      </button>
    </div>
    
    {#if csvOutput}
      <div class="divider"></div>
      <div class="form-control">
        <label class="label">
          <span class="label-text">CSV Output:</span>
        </label>
        <textarea 
          bind:value={csvOutput}
          class="textarea textarea-bordered h-32 font-mono text-sm" 
          readonly
        ></textarea>
      </div>
      
      <div class="card-actions justify-end">
        <button class="btn btn-success" on:click={downloadCSV}>
          Download CSV
        </button>
      </div>
    {/if}
  </div>
</div>