<script lang="ts">
  import { onMount } from 'svelte';
  import type { Transaction, ParseResult, FileUploadEvent, FilterState, Category, FilterPreset } from '../lib/types';
  import { ReliableParser } from '../lib/services/reliableParser';
  import { TransactionManager } from '../lib/services/transactionManager';
  import { SupabaseService } from '../lib/services/supabase';
  import { FilterService } from '../lib/services/filterService';
  import { CategoryService } from '../lib/services/categoryService';
  import FileUpload from '../lib/components/FileUpload.svelte';
  import TextToCSVConverter from '../lib/components/TextToCSVConverter.svelte';
  import TransactionTable from '../lib/components/TransactionTable.svelte';
  import AnalyticsCharts from '../lib/components/AnalyticsCharts.svelte';
  import BillingView from '../lib/components/BillingView.svelte';
  import PeriodSelector from '../lib/components/PeriodSelector.svelte';
  import FilterControls from '../lib/components/FilterControls.svelte';
  import CategoryManager from '../lib/components/CategoryManager.svelte';
  import HierarchicalTransactionView from '../lib/components/HierarchicalTransactionView.svelte';
  import SuspiciousTransactions from '../lib/components/SuspiciousTransactions.svelte';
  import { formatNumber, formatCurrency, filterTransactionsByPeriod } from '../lib/utils/helpers';

  // Services
  let parser: WhatsAppParser;
  let transactionManager: TransactionManager;
  let supabaseService: SupabaseService;
  let filterService: FilterService;
  let categoryService: CategoryService;

  // State
  let transactions: Transaction[] = [];
  let categories: Category[] = [];
  let currentView: 'dashboard' | 'upload' | 'transactions' | 'billing' | 'categories' | 'suspicious' = 'dashboard';
  let isLoading = false;
  let isProcessing = false;
  let isSyncing = false;
  let error: string | null = null;
  let success: string | null = null;
  let parseResult: ParseResult | null = null;
  let suspiciousTransactions: any[] = [];
  
  // Filtering and categorization
  let currentFilters: FilterState = {
    categories: [],
    items: [],
    senders: [],
    dateRange: { start: null, end: null },
    amountRange: { min: null, max: null }
  };
  let showHierarchicalView = true;
  let selectedTransactionIds: string[] = [];
  
  // Period filtering (legacy - will be replaced by FilterControls)
  let startMonth: string = '';
  let endMonth: string = '';

  // Initialize services
  onMount(async () => {
    try {
      parser = new ReliableParser();
      transactionManager = new TransactionManager();
      filterService = new FilterService();
      categoryService = new CategoryService();
      
      // Try to initialize Supabase (optional)
      try {
        supabaseService = new SupabaseService();
        const health = await supabaseService.getHealth();
        if (health.status === 'unhealthy') {
          console.warn('Supabase connection failed:', health.message);
        }
      } catch (err) {
        console.warn('Supabase not configured or unavailable');
      }

      // Load existing data
      await loadTransactions();
      await loadCategories();
      
      // Load persisted filters
      currentFilters = filterService.loadPersistedFilters();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to initialize application';
    }
  });



  async function loadTransactions() {
    try {
      if (!transactionManager) {
        transactionManager = new TransactionManager();
      }
      transactions = transactionManager.getTransactions();
      
      // Auto-assign categories to new transactions
      if (categoryService && transactions.length > 0) {
        await autoAssignCategories();
      }
    } catch (err) {
      console.error('Load transactions error:', err);
      transactions = [];
      error = 'Failed to load transactions';
    }
  }

  async function loadCategories() {
    try {
      if (!categoryService) {
        categoryService = new CategoryService();
      }
      categories = await categoryService.getCategories();
    } catch (err) {
      console.error('Load categories error:', err);
      categories = [];
    }
  }

  async function autoAssignCategories() {
    try {
      const uncategorizedTransactions = transactions.filter(t => !t.categoryId);
      let assignedCount = 0;

      for (const transaction of uncategorizedTransactions) {
        const suggestedCategory = await categoryService.suggestCategoryForItem(transaction.item);
        if (suggestedCategory) {
          await transactionManager.updateTransaction(transaction.id, { 
            categoryId: suggestedCategory.id 
          });
          assignedCount++;
        }
      }

      if (assignedCount > 0) {
        await loadTransactions(); // Reload to get updated transactions
        success = `Auto-assigned categories to ${assignedCount} transactions`;
      }
    } catch (err) {
      console.warn('Auto-assignment failed:', err);
    }
  }

  // File upload handling
  async function handleFileUpload(event: CustomEvent<FileUploadEvent>) {
    const uploadEvent = event.detail;

    if (uploadEvent.type === 'start') {
      isProcessing = true;
      error = null;
      success = null;
    } else if (uploadEvent.type === 'complete' && uploadEvent.result) {
      try {
        // Ensure parser and transaction manager are initialized
        if (!parser) {
          parser = new ReliableParser();
        }
        if (!transactionManager) {
          transactionManager = new TransactionManager();
        }

        // Parse the file content (CSV format)
        const result = uploadEvent.result.parseResult || await parser.parseFile(uploadEvent.result.content);
        parseResult = result;
        suspiciousTransactions = result.suspiciousTransactions || [];

        if (result.transactions.length > 0) {
          // Add transactions to manager
          await transactionManager.addTransactions(result.transactions);
          await loadTransactions();

          // Auto-assign categories to new transactions
          await autoAssignCategories();

          success = `Successfully parsed ${result.transactions.length} transactions`;
          if (result.errors.length > 0) {
            success += ` (${result.errors.length} errors encountered)`;
          }

          // Switch to transactions view
          currentView = 'transactions';
        } else {
          error = 'No transactions found in the uploaded file';
        }
      } catch (err) {
        console.error('File upload error:', err);
        error = err instanceof Error ? err.message : 'Failed to parse file';
      } finally {
        isProcessing = false;
      }
    } else if (uploadEvent.type === 'error') {
      error = uploadEvent.error || 'File upload failed';
      isProcessing = false;
    }
  }

  // Transaction editing
  async function handleTransactionEdit(event: CustomEvent<{ id: string; field: keyof Transaction; value: any }>) {
    try {
      const { id, field, value } = event.detail;
      await transactionManager.updateTransaction(id, { [field]: value });
      loadTransactions();
      success = 'Transaction updated successfully';
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to update transaction';
    }
  }

  // Transaction deletion
  async function handleTransactionDelete(event: CustomEvent<{ id: string }>) {
    try {
      await transactionManager.deleteTransaction(event.detail.id);
      loadTransactions();
      success = 'Transaction deleted successfully';
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to delete transaction';
    }
  }

  // Bulk deletion
  async function handleBulkDelete(event: CustomEvent<{ ids: string[] }>) {
    try {
      await transactionManager.deleteMultipleTransactions(event.detail.ids);
      loadTransactions();
      success = `Deleted ${event.detail.ids.length} transactions`;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to delete transactions';
    }
  }

  // Supabase sync
  async function syncWithSupabase() {
    if (!supabaseService) {
      error = 'Supabase is not configured';
      return;
    }

    try {
      isSyncing = true;
      const result = await supabaseService.saveTransactions(transactions);
      
      if (result.success) {
        success = `Successfully synced ${result.syncedCount} transactions to database`;
      } else {
        error = `Sync failed: ${result.errors.join(', ')}`;
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to sync with database';
    } finally {
      isSyncing = false;
    }
  }

  // Load from Supabase
  async function loadFromSupabase() {
    if (!supabaseService) {
      error = 'Supabase is not configured';
      return;
    }

    try {
      isLoading = true;
      const dbTransactions = await supabaseService.loadTransactions();
      
      // Clear local transactions and add database transactions
      await transactionManager.clearAllTransactions();
      await transactionManager.addTransactions(dbTransactions);
      loadTransactions();
      
      success = `Loaded ${dbTransactions.length} transactions from database`;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load from database';
    } finally {
      isLoading = false;
    }
  }

  // Export functions
  function exportTransactions(format: 'json' | 'csv') {
    try {
      // Use filtered transactions for export
      const transactionsToExport = filteredTransactions;
      
      let data: string;
      if (format === 'json') {
        data = JSON.stringify(transactionsToExport, null, 2);
      } else {
        // CSV export with category information
        const headers = ['Date', 'Sender', 'Item', 'Amount', 'Category'];
        const rows = transactionsToExport.map(t => [
          t.date.toISOString().split('T')[0],
          t.sender,
          t.item,
          t.amount.toString(),
          t.categoryId ? (categories.find(c => c.id === t.categoryId)?.name || 'Unknown') : 'Uncategorized'
        ]);
        
        data = [headers, ...rows].map(row => 
          row.map(cell => `"${cell.toString().replace(/"/g, '""')}"`).join(',')
        ).join('\n');
      }
      
      // Include filter info in filename if filters are active
      const hasFilters = filterService?.hasActiveFilters(currentFilters);
      const filterSuffix = hasFilters ? '-filtered' : '';
      const filename = `transactions${filterSuffix}-${new Date().toISOString().split('T')[0]}.${format}`;
      const mimeType = format === 'json' ? 'application/json' : 'text/csv';
      
      const blob = new Blob([data], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      const exportedCount = transactionsToExport.length;
      success = `Exported ${exportedCount} ${hasFilters ? 'filtered ' : ''}transactions as ${format.toUpperCase()}`;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to export transactions';
    }
  }

  // Filter handling
  function handleFiltersChanged(event: CustomEvent<FilterState>) {
    currentFilters = event.detail;
    filterService.setCurrentFilters(currentFilters);
  }

  function handlePresetSaved(event: CustomEvent<{ name: string; filters: FilterState }>) {
    success = `Filter preset "${event.detail.name}" saved successfully`;
  }

  function handlePresetApplied(event: CustomEvent<FilterPreset>) {
    success = `Applied filter preset "${event.detail.name}"`;
  }

  // Category handling
  async function handleCategoryCreated(event: CustomEvent<Category>) {
    categories = [...categories, event.detail];
    success = `Category "${event.detail.name}" created successfully`;
  }

  async function handleCategoryUpdated(event: CustomEvent<Category>) {
    const index = categories.findIndex(c => c.id === event.detail.id);
    if (index !== -1) {
      categories[index] = event.detail;
      categories = categories; // Trigger reactivity
    }
    success = `Category "${event.detail.name}" updated successfully`;
  }

  async function handleCategoryDeleted(event: CustomEvent<string>) {
    categories = categories.filter(c => c.id !== event.detail);
    // Remove category from transactions
    transactions = transactions.map(t => 
      t.categoryId === event.detail ? { ...t, categoryId: undefined } : t
    );
    success = 'Category deleted successfully';
  }

  async function handleCategoriesAssigned(event: CustomEvent<{ transactionIds: string[]; categoryId: string }>) {
    const { transactionIds, categoryId } = event.detail;
    
    // Update transactions with new category
    for (const id of transactionIds) {
      await transactionManager.updateTransaction(id, { categoryId });
    }
    
    await loadTransactions();
    success = `Assigned category to ${transactionIds.length} transactions`;
  }

  // Hierarchical view handling
  function handleSelectionChanged(event: CustomEvent<{ selectedIds: string[] }>) {
    selectedTransactionIds = event.detail.selectedIds;
  }

  // Clear messages
  function clearMessages() {
    error = null;
    success = null;
  }

  // Wipe all transactions
  async function wipeAllTransactions() {
    if (confirm('Are you sure you want to delete all transactions? This action cannot be undone.')) {
      try {
        // Ensure transaction manager is initialized
        if (!transactionManager) {
          transactionManager = new TransactionManager();
        }
        
        await transactionManager.clearAllTransactions();
        loadTransactions();
        
        // Clear any existing parse results
        parseResult = null;
        
        success = 'All transactions have been deleted';
      } catch (err) {
        console.error('Wipe transactions error:', err);
        error = err instanceof Error ? err.message : 'Failed to delete transactions';
      }
    }
  }

  // Period filtering handler
  function handlePeriodChange(event: CustomEvent<{ startMonth: string; endMonth: string }>) {
    startMonth = event.detail.startMonth;
    endMonth = event.detail.endMonth;
  }

  // Apply filters to transactions
  $: filteredTransactions = (() => {
    let result = transactions;
    
    // Apply new filter system
    if (filterService && filterService.hasActiveFilters(currentFilters)) {
      result = filterService.applyFilters(result, currentFilters);
    }
    
    // Apply legacy period filtering if no date filters are active
    if (!currentFilters.dateRange.start && !currentFilters.dateRange.end && (startMonth || endMonth)) {
      result = filterTransactionsByPeriod(result, startMonth, endMonth);
    }
    
    return result;
  })();

  // Get available filter options
  $: filterOptions = (() => {
    if (!filterService || !transactions.length) {
      return {
        categories: [],
        items: [],
        senders: [],
        dateRange: null,
        amountRange: null
      };
    }
    return filterService.getAvailableFilterOptions(transactions, categories);
  })();

  // Get selected transactions for category assignment
  $: selectedTransactions = transactions.filter(t => selectedTransactionIds.includes(t.id));

  // Statistics based on filtered transactions
  $: stats = (() => {
    if (!transactionManager) {
      return {
        total: 0,
        totalAmount: 0,
        averageAmount: 0,
        uniqueItems: 0,
        uniqueSenders: 0,
        dateRange: null,
        topItems: []
      };
    }
    
    // Calculate stats from filtered transactions
    const total = filteredTransactions.length;
    const totalAmount = filteredTransactions.reduce((sum, t) => sum + t.amount, 0);
    const averageAmount = total > 0 ? totalAmount / total : 0;
    const uniqueItems = new Set(filteredTransactions.map(t => t.item)).size;
    const uniqueSenders = new Set(filteredTransactions.map(t => t.sender)).size;
    
    // Get date range
    const dates = filteredTransactions.map(t => t.date).sort((a, b) => a.getTime() - b.getTime());
    const dateRange = dates.length > 0 ? { start: dates[0], end: dates[dates.length - 1] } : null;
    
    // Top items
    const itemCounts = filteredTransactions.reduce((acc, t) => {
      acc[t.item] = (acc[t.item] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);
    
    const topItems = Object.entries(itemCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([item, amount]) => ({ item, amount }));
    
    return {
      total,
      totalAmount,
      averageAmount,
      uniqueItems,
      uniqueSenders,
      dateRange,
      topItems
    };
  })();
</script>

<svelte:head>
  <title>WhatsApp Purchase Analyzer</title>
  <meta name="description" content="Analyze your WhatsApp purchase history with interactive charts and insights" />
</svelte:head>

<div class="min-h-screen bg-base-200">
  <!-- Navigation -->
  <div class="navbar bg-base-100 shadow-lg">
    <div class="navbar-start">
      <div class="dropdown">
        <button class="btn btn-ghost lg:hidden" aria-label="Open mobile menu">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h8m-8 6h16"/>
          </svg>
        </button>
        <ul class="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow bg-base-100 rounded-box w-52">
          <li><button on:click={() => currentView = 'dashboard'}>Dashboard</button></li>
          <li><button on:click={() => currentView = 'upload'}>Upload</button></li>
          <li><button on:click={() => currentView = 'transactions'}>Transactions</button></li>
          <li><button on:click={() => currentView = 'categories'}>Categories</button></li>
          <li><button on:click={() => currentView = 'billing'}>Billing</button></li>
          <li><button on:click={() => currentView = 'suspicious'}>Suspicious</button></li>
        </ul>
      </div>
      <a href="/" class="btn btn-ghost normal-case text-xl">
        📊 WhatsApp Analyzer
      </a>
    </div>
    
    <div class="navbar-center hidden lg:flex">
      <ul class="menu menu-horizontal px-1">
        <li>
          <button 
            class="btn btn-ghost {currentView === 'dashboard' ? 'btn-active' : ''}"
            on:click={() => currentView = 'dashboard'}
          >
            Dashboard
          </button>
        </li>
        <li>
          <button 
            class="btn btn-ghost {currentView === 'upload' ? 'btn-active' : ''}"
            on:click={() => currentView = 'upload'}
          >
            Upload
          </button>
        </li>
        <li>
          <button 
            class="btn btn-ghost {currentView === 'transactions' ? 'btn-active' : ''}"
            on:click={() => currentView = 'transactions'}
          >
            Transactions ({formatNumber(transactions.length)})
          </button>
        </li>
        <li>
          <button 
            class="btn btn-ghost {currentView === 'categories' ? 'btn-active' : ''}"
            on:click={() => currentView = 'categories'}
          >
            Categories ({categories.length})
          </button>
        </li>
        <li>
          <button 
            class="btn btn-ghost {currentView === 'billing' ? 'btn-active' : ''}"
            on:click={() => currentView = 'billing'}
          >
            Billing
          </button>
        </li>
        <li>
          <button 
            class="btn btn-ghost {currentView === 'suspicious' ? 'btn-active' : ''}"
            on:click={() => currentView = 'suspicious'}
          >
            Suspicious ({suspiciousTransactions.length})
          </button>
        </li>
      </ul>
    </div>
    
    <div class="navbar-end">
      <div class="dropdown dropdown-end">
        <button class="btn btn-ghost" aria-label="Open options menu">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"/>
          </svg>
        </button>
        <ul class="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-52">
          <li><button on:click={() => exportTransactions('json')}>Export JSON</button></li>
          <li><button on:click={() => exportTransactions('csv')}>Export CSV</button></li>
          <li><hr class="my-1"></li>
          {#if supabaseService}
            <li><button on:click={syncWithSupabase} disabled={isSyncing}>
              {isSyncing ? 'Syncing...' : 'Sync to Database'}
            </button></li>
            <li><button on:click={loadFromSupabase} disabled={isLoading}>
              {isLoading ? 'Loading...' : 'Load from Database'}
            </button></li>
            <li><hr class="my-1"></li>
          {/if}
          <li><button on:click={wipeAllTransactions} class="text-error">
            🗑️ Wipe All Data
          </button></li>
        </ul>
      </div>
    </div>
  </div>

  <!-- Alerts -->
  {#if error}
    <div class="alert alert-error mx-4 mt-4">
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
      <span>{error}</span>
      <button class="btn btn-sm btn-ghost" on:click={clearMessages}>✕</button>
    </div>
  {/if}

  {#if success}
    <div class="alert alert-success mx-4 mt-4">
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
      <span>{success}</span>
      <button class="btn btn-sm btn-ghost" on:click={clearMessages}>✕</button>
    </div>
  {/if}

  <!-- Main Content -->
  <main class="container mx-auto px-4 py-8">
    {#if currentView === 'dashboard'}
      <!-- Dashboard View -->
      <div class="space-y-8">
        <!-- Quick Stats -->
        <div class="stats stats-vertical lg:stats-horizontal shadow w-full">
          <div class="stat">
            <div class="stat-figure text-primary">
              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
              </svg>
            </div>
            <div class="stat-title">Total Transactions</div>
            <div class="stat-value text-primary">{formatNumber(stats.total)}</div>
            <div class="stat-desc">All time purchases</div>
          </div>
          
          <div class="stat">
            <div class="stat-figure text-secondary">
              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"/>
              </svg>
            </div>
            <div class="stat-title">Total Amount</div>
            <div class="stat-value text-secondary">{formatCurrency(stats.totalAmount)}</div>
            <div class="stat-desc">Total spending</div>
          </div>
          
          <div class="stat">
            <div class="stat-figure text-accent">
              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
              </svg>
            </div>
            <div class="stat-title">Average Purchase</div>
            <div class="stat-value text-accent">{formatCurrency(stats.averageAmount)}</div>
            <div class="stat-desc">Per transaction</div>
          </div>
        </div>

        <!-- Filter Controls -->
        <FilterControls
          {currentFilters}
          availableCategories={categories}
          availableItems={filterOptions.items.map(i => i.name)}
          availableSenders={filterOptions.senders.map(s => s.name)}
          on:filtersChanged={handleFiltersChanged}
          on:presetSaved={handlePresetSaved}
          on:presetApplied={handlePresetApplied}
        />

        <!-- Legacy Period Selector (for backward compatibility) -->
        {#if !filterService?.hasActiveFilters(currentFilters)}
          <PeriodSelector 
            {startMonth}
            {endMonth}
            on:periodChange={handlePeriodChange}
          />
        {/if}

        <!-- Analytics Charts -->
        <AnalyticsCharts 
          transactions={filteredTransactions} 
          loading={isLoading || isProcessing}
        />

        <!-- Quick Actions -->
        {#if transactions.length === 0 && !isProcessing}
          <div class="hero bg-base-100 rounded-lg shadow-xl">
            <div class="hero-content text-center">
              <div class="max-w-md">
                <h1 class="text-5xl font-bold">📱</h1>
                <h2 class="text-3xl font-bold py-6">No Transactions Found</h2>
                <p class="py-6">Upload a WhatsApp chat export file to get started with analyzing your purchase history.</p>
                <button class="btn btn-primary" on:click={() => currentView = 'upload'}>
                  Upload File
                </button>
              </div>
            </div>
          </div>
        {:else if isProcessing}
          <div class="hero bg-base-100 rounded-lg shadow-xl">
            <div class="hero-content text-center">
              <div class="max-w-md">
                <h1 class="text-5xl font-bold">⏳</h1>
                <h2 class="text-3xl font-bold py-6">Processing Transactions</h2>
                <p class="py-6">Parsing and analyzing your transaction data...</p>
                <div class="loading loading-spinner loading-lg"></div>
              </div>
            </div>
          </div>
        {/if}
      </div>

    {:else if currentView === 'upload'}
      <!-- Upload View -->
      <div class="max-w-4xl mx-auto">
        <div class="text-center mb-8">
          <h1 class="text-4xl font-bold text-base-content mb-4">Upload Transaction File</h1>
          <p class="text-lg text-base-content/70">
            First convert your WhatsApp text to CSV, then upload the CSV file
          </p>
        </div>

        <!-- Text to CSV Converter -->
        <TextToCSVConverter />

        <!-- File Upload Component -->
        <FileUpload 
          on:fileSelect={handleFileUpload}
          disabled={isProcessing}
        />

        <!-- Parse Results -->
        {#if parseResult}
          <div class="mt-8 p-6 bg-base-100 rounded-lg shadow-xl">
            <h3 class="text-xl font-semibold mb-4">Parse Results</h3>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div class="stat bg-base-200 rounded-lg">
                <div class="stat-title">Transactions Found</div>
                <div class="stat-value text-success">{parseResult.transactions.length}</div>
              </div>
              <div class="stat bg-base-200 rounded-lg">
                <div class="stat-title">Errors</div>
                <div class="stat-value text-warning">{parseResult.errors.length}</div>
              </div>
              <div class="stat bg-base-200 rounded-lg">
                <div class="stat-title">Lines Processed</div>
                <div class="stat-value">{parseResult.summary.totalLines}</div>
              </div>
            </div>

            {#if parseResult.errors.length > 0}
              <div class="collapse collapse-arrow bg-base-200">
                <input type="checkbox" />
                <div class="collapse-title text-xl font-medium">
                  View Parsing Errors ({parseResult.errors.length})
                </div>
                <div class="collapse-content">
                  <div class="max-h-60 overflow-y-auto">
                    {#each parseResult.errors as error}
                      <div class="alert alert-warning mb-2">
                        <span class="text-sm">
                          Line {error.line}: {error.message}
                          <br>
                          <code class="text-xs">{error.originalText}</code>
                        </span>
                      </div>
                    {/each}
                  </div>
                </div>
              </div>
            {/if}
          </div>
        {/if}
      </div>

    {:else if currentView === 'transactions'}
      <!-- Transactions View -->
      <div class="space-y-6">
        <div class="flex justify-between items-center">
          <h1 class="text-3xl font-bold">Transactions</h1>
          <div class="flex gap-2">
            <button 
              class="btn btn-outline btn-sm"
              class:btn-active={showHierarchicalView}
              on:click={() => showHierarchicalView = !showHierarchicalView}
            >
              {showHierarchicalView ? 'Table View' : 'Drill-Down View'}
            </button>
            <button class="btn btn-outline btn-sm" on:click={() => exportTransactions('csv')}>
              Export CSV
            </button>
            <button class="btn btn-outline btn-sm" on:click={() => exportTransactions('json')}>
              Export JSON
            </button>
          </div>
        </div>

        <!-- Filter Controls -->
        <FilterControls
          {currentFilters}
          availableCategories={categories}
          availableItems={filterOptions.items.map(i => i.name)}
          availableSenders={filterOptions.senders.map(s => s.name)}
          on:filtersChanged={handleFiltersChanged}
          on:presetSaved={handlePresetSaved}
          on:presetApplied={handlePresetApplied}
        />

        <!-- Category Assignment for Selected Transactions -->
        {#if selectedTransactions.length > 0}
          <div class="bg-base-100 p-4 rounded-lg shadow">
            <CategoryManager
              {categories}
              {selectedTransactions}
              mode="assign"
              on:categoryCreated={handleCategoryCreated}
              on:categoriesAssigned={handleCategoriesAssigned}
            />
          </div>
        {/if}

        <!-- Transaction Views -->
        {#if showHierarchicalView}
          <HierarchicalTransactionView
            transactions={filteredTransactions}
            {categories}
            on:transactionEdit={handleTransactionEdit}
            on:transactionDelete={handleTransactionDelete}
            on:selectionChanged={handleSelectionChanged}
          />
        {:else}
          <TransactionTable 
            transactions={filteredTransactions}
            loading={isLoading}
            on:edit={handleTransactionEdit}
            on:delete={handleTransactionDelete}
            on:bulkDelete={handleBulkDelete}
          />
        {/if}
      </div>

    {:else if currentView === 'categories'}
      <!-- Categories View -->
      <div class="space-y-6">
        <CategoryManager
          {categories}
          selectedTransactions={[]}
          mode="manage"
          on:categoryCreated={handleCategoryCreated}
          on:categoryUpdated={handleCategoryUpdated}
          on:categoryDeleted={handleCategoryDeleted}
        />
      </div>

    {:else if currentView === 'billing'}
      <!-- Billing View -->
      <div class="space-y-6">
        <!-- Filter Controls for Billing -->
        <FilterControls
          {currentFilters}
          availableCategories={categories}
          availableItems={filterOptions.items.map(i => i.name)}
          availableSenders={filterOptions.senders.map(s => s.name)}
          on:filtersChanged={handleFiltersChanged}
          on:presetSaved={handlePresetSaved}
          on:presetApplied={handlePresetApplied}
        />

        <!-- Legacy Period Selector (for backward compatibility) -->
        {#if !filterService?.hasActiveFilters(currentFilters)}
          <PeriodSelector 
            {startMonth}
            {endMonth}
            on:periodChange={handlePeriodChange}
          />
        {/if}
        
        <BillingView transactions={filteredTransactions} />
      </div>

    {:else if currentView === 'suspicious'}
      <!-- Suspicious Transactions View -->
      <SuspiciousTransactions {suspiciousTransactions} />
    {/if}
  </main>

  <!-- Footer -->
  <footer class="footer footer-center p-10 bg-base-200 text-base-content">
    <div>
      <p class="font-bold">
        WhatsApp Purchase Analyzer
      </p>
      <p>Analyze your purchase history from WhatsApp chats</p>
      <p>Built with SvelteKit, DaisyUI, and Chart.js</p>
    </div>
  </footer>
</div>
