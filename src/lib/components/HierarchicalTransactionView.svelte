<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Transaction, Category } from '../types';
  import { formatDate, formatCurrency } from '../utils/helpers';

  // Props
  export let transactions: Transaction[] = [];
  export let categories: Category[] = [];
  export let groupBy: 'category' | 'item' | 'sender' | 'date' = 'category';
  export let defaultExpanded: boolean = false;

  // State
  let expandedGroups = new Set<string>();
  let selectedTransactions = new Set<string>();

  // Event dispatcher
  const dispatch = createEventDispatcher<{
    transactionEdit: { id: string; field: keyof Transaction; value: any };
    transactionDelete: { id: string };
    groupExpanded: { groupKey: string; expanded: boolean };
    selectionChanged: { selectedIds: string[] };
  }>();

  // Group transactions
  $: groupedTransactions = groupTransactions(transactions, groupBy);

  function groupTransactions(transactions: Transaction[], groupBy: string) {
    const groups = new Map<string, Transaction[]>();

    transactions.forEach(transaction => {
      let groupKey: string;
      
      switch (groupBy) {
        case 'category':
          if (transaction.categoryId) {
            const category = categories.find(c => c.id === transaction.categoryId);
            groupKey = category?.name || 'Unknown Category';
          } else {
            groupKey = 'Uncategorized';
          }
          break;
        case 'item':
          groupKey = transaction.item;
          break;
        case 'sender':
          groupKey = transaction.sender;
          break;
        case 'date':
          groupKey = formatDate(transaction.date);
          break;
        default:
          groupKey = 'Other';
      }

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(transaction);
    });

    // Sort groups by total amount (descending)
    return Array.from(groups.entries())
      .map(([key, transactions]) => ({
        key,
        transactions: transactions.sort((a, b) => b.date.getTime() - a.date.getTime()),
        totalAmount: transactions.reduce((sum, t) => sum + t.amount, 0),
        count: transactions.length,
        dateRange: {
          start: new Date(Math.min(...transactions.map(t => t.date.getTime()))),
          end: new Date(Math.max(...transactions.map(t => t.date.getTime())))
        }
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);
  }

  // Group expansion
  function toggleGroup(groupKey: string) {
    if (expandedGroups.has(groupKey)) {
      expandedGroups.delete(groupKey);
    } else {
      expandedGroups.add(groupKey);
    }
    expandedGroups = expandedGroups; // Trigger reactivity
    
    dispatch('groupExpanded', { 
      groupKey, 
      expanded: expandedGroups.has(groupKey) 
    });
  }

  function expandAll() {
    groupedTransactions.forEach(group => {
      expandedGroups.add(group.key);
    });
    expandedGroups = expandedGroups;
  }

  function collapseAll() {
    expandedGroups.clear();
    expandedGroups = expandedGroups;
  }

  // Transaction selection
  function toggleTransactionSelection(transactionId: string) {
    if (selectedTransactions.has(transactionId)) {
      selectedTransactions.delete(transactionId);
    } else {
      selectedTransactions.add(transactionId);
    }
    selectedTransactions = selectedTransactions;
    
    dispatch('selectionChanged', { 
      selectedIds: Array.from(selectedTransactions) 
    });
  }

  function selectAllInGroup(transactions: Transaction[]) {
    transactions.forEach(t => selectedTransactions.add(t.id));
    selectedTransactions = selectedTransactions;
    
    dispatch('selectionChanged', { 
      selectedIds: Array.from(selectedTransactions) 
    });
  }

  function deselectAllInGroup(transactions: Transaction[]) {
    transactions.forEach(t => selectedTransactions.delete(t.id));
    selectedTransactions = selectedTransactions;
    
    dispatch('selectionChanged', { 
      selectedIds: Array.from(selectedTransactions) 
    });
  }

  // Transaction editing
  function handleTransactionEdit(transaction: Transaction, field: keyof Transaction, value: any) {
    dispatch('transactionEdit', { id: transaction.id, field, value });
  }

  function handleTransactionDelete(transactionId: string) {
    dispatch('transactionDelete', { id: transactionId });
  }

  // Initialize expanded state
  $: if (defaultExpanded && groupedTransactions.length > 0) {
    groupedTransactions.forEach(group => {
      expandedGroups.add(group.key);
    });
    expandedGroups = expandedGroups;
  }
</script>

<div class="hierarchical-transaction-view">
  <!-- Controls -->
  <div class="flex justify-between items-center mb-6">
    <div class="flex items-center gap-4">
      <div class="form-control">
        <label class="label">
          <span class="label-text">Group by:</span>
        </label>
        <select class="select select-bordered select-sm" bind:value={groupBy}>
          <option value="category">Category</option>
          <option value="item">Item</option>
          <option value="sender">Sender</option>
          <option value="date">Date</option>
        </select>
      </div>
      
      <div class="flex gap-2">
        <button class="btn btn-outline btn-sm" on:click={expandAll}>
          Expand All
        </button>
        <button class="btn btn-outline btn-sm" on:click={collapseAll}>
          Collapse All
        </button>
      </div>
    </div>

    {#if selectedTransactions.size > 0}
      <div class="badge badge-primary">
        {selectedTransactions.size} selected
      </div>
    {/if}
  </div>

  <!-- Groups -->
  <div class="space-y-4">
    {#each groupedTransactions as group}
      <div class="card bg-base-100 shadow-lg">
        <!-- Group Header -->
        <div 
          class="card-body cursor-pointer hover:bg-base-200 transition-colors"
          on:click={() => toggleGroup(group.key)}
          on:keydown={(e) => e.key === 'Enter' && toggleGroup(group.key)}
          role="button"
          tabindex="0"
        >
          <div class="flex justify-between items-center">
            <div class="flex items-center gap-3">
              <!-- Expand/Collapse Icon -->
              <svg 
                class="w-5 h-5 transition-transform {expandedGroups.has(group.key) ? 'rotate-90' : ''}"
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
              </svg>
              
              <!-- Group Title -->
              <div>
                <h3 class="text-lg font-semibold">{group.key}</h3>
                <p class="text-sm text-base-content/70">
                  {group.count} transaction{group.count !== 1 ? 's' : ''}
                  {#if group.count > 1}
                    • {formatDate(group.dateRange.start)} to {formatDate(group.dateRange.end)}
                  {:else}
                    • {formatDate(group.dateRange.start)}
                  {/if}
                </p>
              </div>
            </div>

            <!-- Group Summary -->
            <div class="text-right">
              <div class="text-2xl font-bold">{formatCurrency(group.totalAmount)}</div>
              <div class="text-sm text-base-content/70">
                Avg: {formatCurrency(group.totalAmount / group.count)}
              </div>
            </div>
          </div>
        </div>

        <!-- Group Content -->
        {#if expandedGroups.has(group.key)}
          <div class="px-6 pb-6">
            <!-- Group Actions -->
            <div class="flex justify-between items-center mb-4 pt-4 border-t border-base-300">
              <div class="flex gap-2">
                <button 
                  class="btn btn-outline btn-xs"
                  on:click|stopPropagation={() => selectAllInGroup(group.transactions)}
                >
                  Select All
                </button>
                <button 
                  class="btn btn-outline btn-xs"
                  on:click|stopPropagation={() => deselectAllInGroup(group.transactions)}
                >
                  Deselect All
                </button>
              </div>
            </div>

            <!-- Transactions Table -->
            <div class="overflow-x-auto">
              <table class="table table-zebra table-sm w-full">
                <thead>
                  <tr>
                    <th>
                      <input 
                        type="checkbox" 
                        class="checkbox checkbox-sm"
                        checked={group.transactions.every(t => selectedTransactions.has(t.id))}
                        indeterminate={group.transactions.some(t => selectedTransactions.has(t.id)) && !group.transactions.every(t => selectedTransactions.has(t.id))}
                        on:change={(e) => {
                          if (e.currentTarget.checked) {
                            selectAllInGroup(group.transactions);
                          } else {
                            deselectAllInGroup(group.transactions);
                          }
                        }}
                      />
                    </th>
                    <th>Date</th>
                    <th>Sender</th>
                    <th>Item</th>
                    <th>Amount</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {#each group.transactions as transaction}
                    <tr class="hover">
                      <td>
                        <input 
                          type="checkbox" 
                          class="checkbox checkbox-sm"
                          checked={selectedTransactions.has(transaction.id)}
                          on:change={() => toggleTransactionSelection(transaction.id)}
                        />
                      </td>
                      <td class="text-sm">{formatDate(transaction.date)}</td>
                      <td class="text-sm">{transaction.sender}</td>
                      <td class="font-medium">{transaction.item}</td>
                      <td class="font-mono">{formatCurrency(transaction.amount)}</td>
                      <td>
                        <div class="flex gap-1">
                          <button 
                            class="btn btn-ghost btn-xs"
                            on:click={() => handleTransactionDelete(transaction.id)}
                            title="Delete transaction"
                          >
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        {/if}
      </div>
    {/each}

    {#if groupedTransactions.length === 0}
      <div class="text-center py-12">
        <svg class="w-16 h-16 mx-auto mb-4 text-base-content/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
        </svg>
        <h3 class="text-lg font-medium text-base-content/70">No transactions found</h3>
        <p class="text-base-content/50">Try adjusting your filters or upload some transaction data</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .hierarchical-transaction-view {
    @apply w-full;
  }

  /* Smooth transitions for expand/collapse */
  .card-body {
    transition: background-color 0.2s ease;
  }

  /* Indeterminate checkbox styling */
  input[type="checkbox"]:indeterminate {
    @apply bg-primary border-primary;
  }

  input[type="checkbox"]:indeterminate::before {
    content: '';
    @apply block w-2 h-0.5 bg-white absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2;
  }
</style>