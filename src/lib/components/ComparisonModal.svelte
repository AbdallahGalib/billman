<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Transaction } from '../types';
  import { formatCurrency } from '../utils/helpers';

  export let transactions: Transaction[] = [];
  export let isOpen = false;

  const dispatch = createEventDispatcher();

  let selectedMonths: string[] = [];
  let comparisonData: any = null;

  // Get available months from transactions
  $: availableMonths = (() => {
    const months = new Set<string>();
    transactions.forEach(t => {
      const monthKey = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, '0')}`;
      months.add(monthKey);
    });
    return Array.from(months).sort().reverse();
  })();

  // Generate comparison data when months are selected
  $: if (selectedMonths.length >= 2) {
    generateComparison();
  }

  function generateComparison() {
    const monthData: Record<string, Record<string, { count: number; total: number }>> = {};
    
    // Initialize month data
    selectedMonths.forEach(month => {
      monthData[month] = {};
    });

    // Process transactions for selected months
    transactions.forEach(t => {
      const monthKey = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, '0')}`;
      if (selectedMonths.includes(monthKey)) {
        if (!monthData[monthKey][t.item]) {
          monthData[monthKey][t.item] = { count: 0, total: 0 };
        }
        monthData[monthKey][t.item].count++;
        monthData[monthKey][t.item].total += t.amount;
      }
    });

    // Get all unique items across selected months
    const allItems = new Set<string>();
    Object.values(monthData).forEach(month => {
      Object.keys(month).forEach(item => allItems.add(item));
    });

    // Build comparison table
    const comparison = Array.from(allItems).map(item => {
      const itemData: any = { item };
      selectedMonths.forEach(month => {
        const data = monthData[month][item] || { count: 0, total: 0 };
        itemData[month] = data;
      });
      return itemData;
    }).sort((a, b) => {
      // Sort by total spending across all months
      const totalA = selectedMonths.reduce((sum, month) => sum + a[month].total, 0);
      const totalB = selectedMonths.reduce((sum, month) => sum + b[month].total, 0);
      return totalB - totalA;
    });

    comparisonData = {
      months: selectedMonths,
      items: comparison,
      monthTotals: selectedMonths.reduce((acc, month) => {
        acc[month] = Object.values(monthData[month]).reduce((sum: number, data: any) => sum + data.total, 0);
        return acc;
      }, {} as Record<string, number>)
    };
  }

  function toggleMonth(month: string) {
    if (selectedMonths.includes(month)) {
      selectedMonths = selectedMonths.filter(m => m !== month);
    } else {
      selectedMonths = [...selectedMonths, month];
    }
  }

  function formatMonth(monthKey: string) {
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  }

  function closeModal() {
    isOpen = false;
    selectedMonths = [];
    comparisonData = null;
    dispatch('close');
  }
</script>

{#if isOpen}
  <div class="modal modal-open">
    <div class="modal-box w-11/12 max-w-6xl">
      <h3 class="font-bold text-lg mb-4">Monthly Item Comparison</h3>
      
      <!-- Month Selection -->
      <div class="mb-6">
        <h4 class="font-semibold mb-2">Select months to compare (minimum 2):</h4>
        <div class="flex flex-wrap gap-2">
          {#each availableMonths as month}
            <button
              class="btn btn-sm {selectedMonths.includes(month) ? 'btn-primary' : 'btn-outline'}"
              on:click={() => toggleMonth(month)}
            >
              {formatMonth(month)}
            </button>
          {/each}
        </div>
      </div>

      {#if selectedMonths.length < 2}
        <div class="text-center py-8 text-base-content/60">
          Select at least 2 months to see comparison
        </div>
      {:else if comparisonData}
        <!-- Month Totals -->
        <div class="mb-6">
          <h4 class="font-semibold mb-2">Monthly Totals:</h4>
          <div class="flex gap-4 flex-wrap">
            {#each selectedMonths as month}
              <div class="stat bg-base-200 rounded-lg min-w-0 flex-1">
                <div class="stat-title text-xs">{formatMonth(month)}</div>
                <div class="stat-value text-lg">{formatCurrency(comparisonData.monthTotals[month])}</div>
              </div>
            {/each}
          </div>
        </div>

        <!-- Comparison Table -->
        <div class="overflow-x-auto">
          <table class="table table-zebra w-full">
            <thead>
              <tr>
                <th class="sticky left-0 bg-base-100">Item</th>
                {#each selectedMonths as month}
                  <th class="text-center">{formatMonth(month)}</th>
                {/each}
              </tr>
            </thead>
            <tbody>
              {#each comparisonData.items as item}
                <tr>
                  <td class="sticky left-0 bg-base-100 font-medium">{item.item}</td>
                  {#each selectedMonths as month}
                    <td class="text-center">
                      {#if item[month].count > 0}
                        <div class="text-sm">
                          <div class="font-semibold">{formatCurrency(item[month].total)}</div>
                          <div class="text-xs text-base-content/60">{item[month].count}x</div>
                        </div>
                      {:else}
                        <span class="text-base-content/40">-</span>
                      {/if}
                    </td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}

      <div class="modal-action">
        <button class="btn" on:click={closeModal}>Close</button>
      </div>
    </div>
  </div>
{/if}