<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Transaction, SortConfig, FilterConfig, CellReference } from '../types';
  import { formatDate, formatCurrency, debounce } from '../utils/helpers';

  // Props
  export let transactions: Transaction[] = [];
  export let loading: boolean = false;
  export let itemsPerPage: number = 50;

  // State
  let filteredTransactions: Transaction[] = [];
  let currentPage = 1;
  let sortConfig: SortConfig = { field: 'date', direction: 'desc' };
  let editingCell: CellReference | null = null;
  let editValue = '';
  let searchQuery = '';
  let filters: FilterConfig = {};

  // Event dispatcher
  const dispatch = createEventDispatcher<{
    edit: { id: string; field: keyof Transaction; value: any };
    delete: { id: string };
    bulkDelete: { ids: string[] };
  }>();

  // Reactive statements
  $: {
    applyFiltersAndSort();
  }

  $: totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  $: paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Selected rows for bulk operations
  let selectedRows = new Set<string>();
  let selectAll = false;

  // Filter and sort logic
  function applyFiltersAndSort() {
    let result = [...transactions];

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t => 
        t.item.toLowerCase().includes(query) ||
        t.sender.toLowerCase().includes(query) ||
        t.amount.toString().includes(query)
      );
    }

    // Apply filters
    if (filters.dateRange) {
      result = result.filter(t => 
        t.date >= filters.dateRange!.start && t.date <= filters.dateRange!.end
      );
    }

    if (filters.sender) {
      result = result.filter(t => 
        t.sender.toLowerCase().includes(filters.sender!.toLowerCase())
      );
    }

    if (filters.itemSearch) {
      result = result.filter(t => 
        t.item.toLowerCase().includes(filters.itemSearch!.toLowerCase())
      );
    }

    if (filters.amountRange) {
      result = result.filter(t => 
        t.amount >= filters.amountRange!.min && t.amount <= filters.amountRange!.max
      );
    }

    // Apply sorting
    result.sort((a, b) => {
      const aVal = a[sortConfig.field];
      const bVal = b[sortConfig.field];
      
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    filteredTransactions = result;
    currentPage = 1; // Reset to first page when filters change
  }

  // Sorting
  function handleSort(field: keyof Transaction) {
    if (sortConfig.field === field) {
      sortConfig.direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
    } else {
      sortConfig = { field, direction: 'asc' };
    }
  }

  // Pagination
  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages) {
      currentPage = page;
    }
  }

  // Editing
  function startEdit(id: string, field: keyof Transaction, currentValue: any) {
    editingCell = { id, field };
    editValue = currentValue?.toString() || '';
  }

  function cancelEdit() {
    editingCell = null;
    editValue = '';
  }

  function saveEdit() {
    if (!editingCell) return;

    let value: any = editValue;

    // Type conversion based on field
    if (editingCell.field === 'amount') {
      value = parseFloat(editValue);
      if (isNaN(value) || value <= 0) {
        alert('Please enter a valid positive number for amount');
        return;
      }
    } else if (editingCell.field === 'date') {
      value = new Date(editValue);
      if (isNaN(value.getTime())) {
        alert('Please enter a valid date');
        return;
      }
    }

    dispatch('edit', {
      id: editingCell.id,
      field: editingCell.field,
      value
    });

    cancelEdit();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      saveEdit();
    } else if (event.key === 'Escape') {
      cancelEdit();
    }
  }

  // Selection
  function toggleRowSelection(id: string) {
    if (selectedRows.has(id)) {
      selectedRows.delete(id);
    } else {
      selectedRows.add(id);
    }
    selectedRows = selectedRows; // Trigger reactivity
    selectAll = selectedRows.size === paginatedTransactions.length;
  }

  function toggleSelectAll() {
    if (selectAll) {
      selectedRows.clear();
    } else {
      paginatedTransactions.forEach(t => selectedRows.add(t.id));
    }
    selectedRows = selectedRows; // Trigger reactivity
    selectAll = !selectAll;
  }

  function handleBulkDelete() {
    if (selectedRows.size === 0) return;
    
    if (confirm(`Are you sure you want to delete ${selectedRows.size} transactions?`)) {
      dispatch('bulkDelete', { ids: Array.from(selectedRows) });
      selectedRows.clear();
      selectedRows = selectedRows;
      selectAll = false;
    }
  }

  // Debounced search
  const debouncedSearch = debounce((query: string) => {
    searchQuery = query;
  }, 300);

  function handleSearchInput(event: Event) {
    const target = event.target as HTMLInputElement;
    debouncedSearch(target.value);
  }
</script>

<div class="transaction-table-container">
  <!-- Header with search and filters -->
  <div class="mb-6 space-y-4">
    <!-- Search bar -->
    <div class="flex flex-col sm:flex-row gap-4">
      <div class="flex-1">
        <div class="relative">
          <input
            type="text"
            placeholder="Search transactions..."
            class="input input-bordered w-full pl-10"
            on:input={handleSearchInput}
          />
          <svg class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-base-content/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
        </div>
      </div>
      
      <!-- Bulk actions -->
      {#if selectedRows.size > 0}
        <div class="flex gap-2">
          <button class="btn btn-error btn-sm" on:click={handleBulkDelete}>
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
            Delete ({selectedRows.size})
          </button>
        </div>
      {/if}
    </div>

    <!-- Results summary -->
    <div class="text-sm text-base-content/70">
      Showing {paginatedTransactions.length} of {filteredTransactions.length} transactions
      {#if filteredTransactions.length !== transactions.length}
        (filtered from {transactions.length} total)
      {/if}
    </div>
  </div>

  <!-- Table -->
  <div class="overflow-x-auto bg-base-100 rounded-lg shadow">
    <table class="table table-zebra w-full">
      <thead>
        <tr>
          <th>
            <label class="cursor-pointer">
              <input 
                type="checkbox" 
                class="checkbox checkbox-sm"
                bind:checked={selectAll}
                on:change={toggleSelectAll}
              />
            </label>
          </th>
          <th class="cursor-pointer" on:click={() => handleSort('date')}>
            <div class="flex items-center gap-1">
              Date
              {#if sortConfig.field === 'date'}
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {#if sortConfig.direction === 'asc'}
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/>
                  {:else}
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                  {/if}
                </svg>
              {/if}
            </div>
          </th>
          <th class="cursor-pointer" on:click={() => handleSort('sender')}>
            <div class="flex items-center gap-1">
              Sender
              {#if sortConfig.field === 'sender'}
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {#if sortConfig.direction === 'asc'}
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/>
                  {:else}
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                  {/if}
                </svg>
              {/if}
            </div>
          </th>
          <th class="cursor-pointer" on:click={() => handleSort('item')}>
            <div class="flex items-center gap-1">
              Item
              {#if sortConfig.field === 'item'}
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {#if sortConfig.direction === 'asc'}
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/>
                  {:else}
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                  {/if}
                </svg>
              {/if}
            </div>
          </th>
          <th class="cursor-pointer" on:click={() => handleSort('amount')}>
            <div class="flex items-center gap-1">
              Amount
              {#if sortConfig.field === 'amount'}
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {#if sortConfig.direction === 'asc'}
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/>
                  {:else}
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                  {/if}
                </svg>
              {/if}
            </div>
          </th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {#if loading}
          <tr>
            <td colspan="6" class="text-center py-8">
              <div class="loading loading-spinner loading-lg"></div>
              <p class="mt-2">Loading transactions...</p>
            </td>
          </tr>
        {:else if paginatedTransactions.length === 0}
          <tr>
            <td colspan="6" class="text-center py-8">
              <div class="text-base-content/50">
                <svg class="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                <p class="text-lg font-medium">No transactions found</p>
                <p class="text-sm">Try adjusting your search or filters</p>
              </div>
            </td>
          </tr>
        {:else}
          {#each paginatedTransactions as transaction (transaction.id)}
            <tr class="hover">
              <td>
                <label class="cursor-pointer">
                  <input 
                    type="checkbox" 
                    class="checkbox checkbox-sm"
                    checked={selectedRows.has(transaction.id)}
                    on:change={() => toggleRowSelection(transaction.id)}
                  />
                </label>
              </td>
              
              <!-- Date cell -->
              <td>
                {#if editingCell?.id === transaction.id && editingCell?.field === 'date'}
                  <input
                    type="date"
                    class="input input-sm input-bordered w-full"
                    bind:value={editValue}
                    on:keydown={handleKeydown}
                    on:blur={saveEdit}
                    autofocus
                  />
                {:else}
                  <div 
                    class="editable-cell p-2 rounded"
                    on:dblclick={() => startEdit(transaction.id, 'date', transaction.date.toISOString().split('T')[0])}
                  >
                    {formatDate(transaction.date)}
                  </div>
                {/if}
              </td>
              
              <!-- Sender cell -->
              <td>
                {#if editingCell?.id === transaction.id && editingCell?.field === 'sender'}
                  <input
                    type="text"
                    class="input input-sm input-bordered w-full"
                    bind:value={editValue}
                    on:keydown={handleKeydown}
                    on:blur={saveEdit}
                    autofocus
                  />
                {:else}
                  <div 
                    class="editable-cell p-2 rounded"
                    on:dblclick={() => startEdit(transaction.id, 'sender', transaction.sender)}
                  >
                    {transaction.sender}
                  </div>
                {/if}
              </td>
              
              <!-- Item cell -->
              <td>
                {#if editingCell?.id === transaction.id && editingCell?.field === 'item'}
                  <input
                    type="text"
                    class="input input-sm input-bordered w-full"
                    bind:value={editValue}
                    on:keydown={handleKeydown}
                    on:blur={saveEdit}
                    autofocus
                  />
                {:else}
                  <div 
                    class="editable-cell p-2 rounded"
                    on:dblclick={() => startEdit(transaction.id, 'item', transaction.item)}
                  >
                    {transaction.item}
                  </div>
                {/if}
              </td>
              
              <!-- Amount cell -->
              <td>
                {#if editingCell?.id === transaction.id && editingCell?.field === 'amount'}
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    class="input input-sm input-bordered w-full"
                    bind:value={editValue}
                    on:keydown={handleKeydown}
                    on:blur={saveEdit}
                    autofocus
                  />
                {:else}
                  <div 
                    class="editable-cell p-2 rounded font-mono"
                    on:dblclick={() => startEdit(transaction.id, 'amount', transaction.amount)}
                  >
                    {formatCurrency(transaction.amount)}
                  </div>
                {/if}
              </td>
              
              <!-- Actions cell -->
              <td>
                <div class="flex gap-1">
                  <button 
                    class="btn btn-ghost btn-xs"
                    on:click={() => dispatch('delete', { id: transaction.id })}
                    title="Delete transaction"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </div>

  <!-- Pagination -->
  {#if totalPages > 1}
    <div class="flex justify-center mt-6">
      <div class="btn-group">
        <button 
          class="btn btn-sm"
          class:btn-disabled={currentPage === 1}
          on:click={() => goToPage(currentPage - 1)}
        >
          «
        </button>
        
        {#each Array(Math.min(5, totalPages)) as _, i}
          {@const page = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i}
          {#if page <= totalPages}
            <button 
              class="btn btn-sm"
              class:btn-active={page === currentPage}
              on:click={() => goToPage(page)}
            >
              {page}
            </button>
          {/if}
        {/each}
        
        <button 
          class="btn btn-sm"
          class:btn-disabled={currentPage === totalPages}
          on:click={() => goToPage(currentPage + 1)}
        >
          »
        </button>
      </div>
    </div>
    
    <div class="text-center mt-2 text-sm text-base-content/70">
      Page {currentPage} of {totalPages}
    </div>
  {/if}
</div>

<style>
  .editable-cell {
    @apply cursor-pointer hover:bg-base-200 transition-colors min-h-[2rem] flex items-center;
  }

  .editable-cell:hover {
    @apply bg-base-200;
  }

  .transaction-table-container {
    @apply w-full;
  }

  /* Mobile responsiveness */
  @media (max-width: 768px) {
    .table th,
    .table td {
      @apply px-2 py-1 text-xs;
    }
    
    .btn-group .btn {
      @apply px-2;
    }
  }
</style>