<script lang="ts">
  import { onMount } from 'svelte';
  import type { Transaction, BillingSummary, BillingPeriod, MonthBill, DayBill } from '../types';
  import { BillingService } from '../services/billingService';
  import { formatCurrency, formatDate } from '../utils/helpers';

  // Props
  export let transactions: Transaction[] = [];

  // State
  let billingService: BillingService;
  let billingSummary: BillingSummary | null = null;
  let availableMonths: { month: string; year: number; startDate: Date; endDate: Date }[] = [];
  let selectedPeriodType: 'month' | 'custom' = 'month';
  let selectedMonth = '';
  let customStartDate = '';
  let customEndDate = '';
  let loading = false;
  let currentView: 'monthly' | 'daily' = 'monthly';

  // Initialize
  onMount(() => {
    billingService = new BillingService();
    loadAvailableMonths();
  });

  // Reactive updates
  $: if (billingService && transactions.length > 0) {
    loadAvailableMonths();
  }

  function loadAvailableMonths() {
    if (!billingService || transactions.length === 0) return;
    
    availableMonths = billingService.getAvailableMonths(transactions);
    if (availableMonths.length > 0 && !selectedMonth) {
      // Select the latest month by default
      const latest = availableMonths[availableMonths.length - 1];
      selectedMonth = `${latest.year}-${latest.month}`;
    }
  }

  function generateBill() {
    if (!billingService || transactions.length === 0) return;

    loading = true;
    
    try {
      let period: BillingPeriod;

      if (selectedPeriodType === 'month' && selectedMonth) {
        const [year, month] = selectedMonth.split('-');
        const monthIndex = availableMonths.findIndex(m => 
          m.year.toString() === year && m.month === month
        );
        
        if (monthIndex >= 0) {
          const monthData = availableMonths[monthIndex];
          // The availableMonths already contains correct 15th-to-14th periods
          period = billingService.createCustomPeriod(monthData.startDate, monthData.endDate);
        } else {
          throw new Error('Invalid month selection');
        }
      } else if (selectedPeriodType === 'custom' && customStartDate && customEndDate) {
        period = billingService.createCustomPeriod(
          new Date(customStartDate),
          new Date(customEndDate)
        );
      } else {
        throw new Error('Please select a valid period');
      }

      billingSummary = billingService.generateBillingSummary(transactions, period);
    } catch (error) {
      console.error('Error generating bill:', error);
      alert('Error generating bill: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      loading = false;
    }
  }

  function exportBill() {
    if (!billingSummary) return;

    let content = `Billing Summary\n`;
    content += `Period: ${formatDate(billingSummary.period.startDate)} - ${formatDate(billingSummary.period.endDate)}\n`;
    content += `Grand Total: ${formatCurrency(billingSummary.grandTotal)}\n\n`;

    if (currentView === 'monthly') {
      content += `MONTHLY BILLS\n${'='.repeat(50)}\n\n`;
      billingSummary.monthlyBills.forEach(monthBill => {
        content += billingService.formatBillForDisplay(monthBill) + '\n';
      });
    } else {
      content += `DAILY BILLS\n${'='.repeat(50)}\n\n`;
      billingSummary.dailyBills.forEach(dayBill => {
        content += billingService.formatBillForDisplay(dayBill) + '\n';
      });
    }

    // Download as text file
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `billing-summary-${formatDate(billingSummary.period.startDate)}-${formatDate(billingSummary.period.endDate)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
</script>

<div class="billing-view p-6">
  <div class="mb-8">
    <h2 class="text-3xl font-bold text-base-content mb-4">Billing Summary</h2>
    <p class="text-base-content/70">Generate organized bills with combined items and quantities. Month starts from 15th.</p>
  </div>

  <!-- Period Selection -->
  <div class="card bg-base-100 shadow-xl mb-8">
    <div class="card-body">
      <h3 class="card-title">Select Billing Period</h3>
      
      <!-- Period Type Selection -->
      <div class="form-control mb-4">
        <div class="flex gap-4">
          <label class="label cursor-pointer">
            <input 
              type="radio" 
              name="periodType" 
              class="radio radio-primary" 
              bind:group={selectedPeriodType} 
              value="month"
            />
            <span class="label-text ml-2">Monthly (15th to 14th)</span>
          </label>
          <label class="label cursor-pointer">
            <input 
              type="radio" 
              name="periodType" 
              class="radio radio-primary" 
              bind:group={selectedPeriodType} 
              value="custom"
            />
            <span class="label-text ml-2">Custom Period</span>
          </label>
        </div>
      </div>

      {#if selectedPeriodType === 'month'}
        <!-- Month Selection -->
        <div class="form-control mb-4">
          <label class="label">
            <span class="label-text">Select Month</span>
          </label>
          <select class="select select-bordered" bind:value={selectedMonth}>
            <option value="">Choose a month...</option>
            {#each availableMonths as month}
              <option value="{month.year}-{month.month}">
                {month.month} {month.year} ({formatDate(month.startDate)} - {formatDate(month.endDate)})
              </option>
            {/each}
          </select>
        </div>
      {:else}
        <!-- Custom Date Range -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div class="form-control">
            <label class="label">
              <span class="label-text">Start Date</span>
            </label>
            <input 
              type="date" 
              class="input input-bordered" 
              bind:value={customStartDate}
            />
          </div>
          <div class="form-control">
            <label class="label">
              <span class="label-text">End Date</span>
            </label>
            <input 
              type="date" 
              class="input input-bordered" 
              bind:value={customEndDate}
            />
          </div>
        </div>
      {/if}

      <div class="card-actions">
        <button 
          class="btn btn-primary" 
          class:loading={loading}
          on:click={generateBill}
          disabled={loading || transactions.length === 0}
        >
          {loading ? 'Generating...' : 'Generate Bill'}
        </button>
      </div>
    </div>
  </div>

  {#if billingSummary}
    <!-- Bill Summary -->
    <div class="card bg-base-100 shadow-xl mb-8">
      <div class="card-body">
        <div class="flex justify-between items-center mb-4">
          <h3 class="card-title">Bill Summary</h3>
          <div class="flex gap-2">
            <div class="tabs tabs-boxed">
              <button 
                class="tab {currentView === 'monthly' ? 'tab-active' : ''}"
                on:click={() => currentView = 'monthly'}
              >
                Monthly View
              </button>
              <button 
                class="tab {currentView === 'daily' ? 'tab-active' : ''}"
                on:click={() => currentView = 'daily'}
              >
                Daily View
              </button>
            </div>
            <button class="btn btn-outline btn-sm" on:click={exportBill}>
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
              Export
            </button>
          </div>
        </div>

        <!-- Period Info -->
        <div class="alert alert-info mb-6">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <div>
            <h4 class="font-bold">Period: {formatDate(billingSummary.period.startDate)} - {formatDate(billingSummary.period.endDate)}</h4>
            <p>Grand Total: {formatCurrency(billingSummary.grandTotal)}</p>
          </div>
        </div>

        {#if currentView === 'monthly'}
          <!-- Monthly Bills -->
          <div class="space-y-6">
            {#each billingSummary.monthlyBills as monthBill}
              <div class="card bg-base-200">
                <div class="card-body">
                  <div class="flex justify-between items-center mb-4">
                    <h4 class="text-xl font-semibold">{monthBill.month} {monthBill.year}</h4>
                    <div class="text-right">
                      <div class="text-2xl font-bold text-primary">{formatCurrency(monthBill.totalAmount)}</div>
                      <div class="text-sm text-base-content/70">
                        {formatDate(monthBill.startDate)} - {formatDate(monthBill.endDate)}
                      </div>
                    </div>
                  </div>

                  <!-- Items Summary -->
                  <div class="overflow-x-auto">
                    <table class="table table-zebra">
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Quantity</th>
                          <th>Unit Price</th>
                          <th>Total Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {#each monthBill.itemSummary as item}
                          <tr>
                            <td class="font-medium">{item.item}</td>
                            <td>{item.quantity}</td>
                            <td>{formatCurrency(item.unitPrice)}</td>
                            <td class="font-semibold">{formatCurrency(item.totalPrice)}</td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <!-- Daily Bills -->
          <div class="space-y-4">
            {#each billingSummary.dailyBills as dayBill}
              <div class="card bg-base-200">
                <div class="card-body">
                  <div class="flex justify-between items-center mb-4">
                    <h4 class="text-lg font-semibold">{formatDate(dayBill.date)}</h4>
                    <div class="text-xl font-bold text-primary">{formatCurrency(dayBill.totalAmount)}</div>
                  </div>

                  <!-- Items -->
                  <div class="overflow-x-auto">
                    <table class="table table-sm">
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Qty</th>
                          <th>Unit Price</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {#each dayBill.items as item}
                          <tr>
                            <td>{item.item}</td>
                            <td>{item.quantity}</td>
                            <td>{formatCurrency(item.unitPrice)}</td>
                            <td class="font-semibold">{formatCurrency(item.totalPrice)}</td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {:else if transactions.length === 0}
    <!-- Empty State -->
    <div class="card bg-base-100 shadow-xl">
      <div class="card-body text-center py-16">
        <svg class="w-24 h-24 text-base-content/20 mx-auto mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
        </svg>
        <h3 class="text-xl font-semibold text-base-content/60 mb-2">No Transactions Available</h3>
        <p class="text-base-content/40">Upload your WhatsApp chat file to generate billing summaries</p>
      </div>
    </div>
  {/if}
</div>

<style>
  .billing-view {
    @apply max-w-6xl mx-auto;
  }

  /* Mobile responsiveness */
  @media (max-width: 768px) {
    .table {
      @apply text-xs;
    }
    
    .table th,
    .table td {
      @apply px-2 py-1;
    }
  }
</style>