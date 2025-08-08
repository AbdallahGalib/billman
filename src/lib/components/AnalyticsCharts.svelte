<script lang="ts">
  import { onMount } from 'svelte';
  import type { Transaction, AnalyticsData, FilterConfig } from '../types';
  import { AnalyticsEngine } from '../services/analyticsEngine';
  import { TransactionManager } from '../services/transactionManager';
  import PieChart from './charts/PieChart.svelte';
  import BarChart from './charts/BarChart.svelte';
  import { formatCurrency, formatNumber } from '../utils/helpers';

  // Props
  export let transactions: Transaction[] = [];
  export let filters: FilterConfig = {};
  export let loading: boolean = false;

  // State
  let analyticsEngine: AnalyticsEngine;
  let transactionManager: TransactionManager;
  let analyticsData: AnalyticsData | null = null;
  let selectedView: 'overview' | 'trends' | 'insights' = 'overview';
  let frequencyAnalysis: any = null;

  // Initialize analytics engine
  onMount(() => {
    transactionManager = new TransactionManager();
    analyticsEngine = new AnalyticsEngine(transactions);
    updateAnalytics();
  });

  // Update analytics when transactions or filters change
  $: if (analyticsEngine && transactions) {
    // Use grouped transactions for better analytics
    const groupedTransactions = getGroupedTransactions(transactions);
    analyticsEngine.updateTransactions(groupedTransactions);
    updateAnalytics();
  }

  function getGroupedTransactions(transactions: Transaction[]): Transaction[] {
    // Create a temporary transaction manager to use grouping logic
    const tempManager = new TransactionManager();
    tempManager['transactions'] = transactions; // Direct assignment for grouping
    return tempManager.getGroupedTransactions();
  }

  function updateAnalytics() {
    if (!analyticsEngine) return;
    const groupedTransactions = getGroupedTransactions(transactions);
    analyticsData = analyticsEngine.generateAnalytics(filters);
    
    // Get frequency analysis
    const tempManager = new TransactionManager();
    tempManager['transactions'] = groupedTransactions;
    frequencyAnalysis = tempManager.getItemFrequencyAnalysis();
  }

  // Chart data generation
  $: frequentItemsChartData = frequencyAnalysis ? 
    analyticsEngine.generateFrequentItemsChartData(frequencyAnalysis.frequent) : 
    { labels: [], datasets: [] };

  $: nonFrequentItemsChartData = frequencyAnalysis ? 
    analyticsEngine.generateNonFrequentItemsChartData(frequencyAnalysis.nonFrequent) : 
    { labels: [], datasets: [] };

  $: barChartData = analyticsData ? 
    analyticsEngine.generateBarChartData(analyticsData.monthlySpending) : 
    { labels: [], datasets: [] };

  $: pieChartOptions = analyticsEngine?.getPieChartOptions() || {};
  $: barChartOptions = analyticsEngine?.getBarChartOptions() || {};

  // Advanced analytics
  $: topSpenders = analyticsEngine?.getTopSpenders(5) || [];
  $: spendingTrends = analyticsEngine?.getSpendingTrends() || null;
  $: itemInsights = analyticsEngine?.getItemInsights() || null;

  function exportAnalytics(format: 'json' | 'csv') {
    if (!analyticsEngine) return;
    
    const data = analyticsEngine.exportAnalyticsData(format);
    const filename = `analytics-${new Date().toISOString().split('T')[0]}.${format}`;
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
  }
</script>

<div class="analytics-container">
  <!-- Header -->
  <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
    <h2 class="text-2xl font-bold text-base-content mb-4 sm:mb-0">Analytics Dashboard</h2>
    
    <!-- View selector -->
    <div class="tabs tabs-boxed">
      <button 
        class="tab {selectedView === 'overview' ? 'tab-active' : ''}"
        on:click={() => selectedView = 'overview'}
      >
        Overview
      </button>
      <button 
        class="tab {selectedView === 'trends' ? 'tab-active' : ''}"
        on:click={() => selectedView = 'trends'}
      >
        Trends
      </button>
      <button 
        class="tab {selectedView === 'insights' ? 'tab-active' : ''}"
        on:click={() => selectedView = 'insights'}
      >
        Insights
      </button>
    </div>
  </div>

  {#if loading}
    <!-- Loading state -->
    <div class="flex justify-center items-center h-64">
      <div class="loading loading-spinner loading-lg"></div>
      <span class="ml-4 text-lg">Generating analytics...</span>
    </div>
  {:else if !analyticsData || analyticsData.totalTransactions === 0}
    <!-- Empty state -->
    <div class="empty-state text-center py-16">
      <svg class="w-24 h-24 text-base-content/20 mx-auto mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
      </svg>
      <h3 class="text-xl font-semibold text-base-content/60 mb-2">No Data Available</h3>
      <p class="text-base-content/40">Upload your WhatsApp chat file to see analytics</p>
    </div>
  {:else}
    <!-- Analytics content -->
    {#if selectedView === 'overview'}
      <!-- Overview stats -->
      <div class="stats stats-vertical lg:stats-horizontal shadow mb-8 w-full">
        <div class="stat">
          <div class="stat-title">Total Transactions</div>
          <div class="stat-value text-primary">{formatNumber(analyticsData.totalTransactions)}</div>
          <div class="stat-desc">All time</div>
        </div>
        
        <div class="stat">
          <div class="stat-title">Total Amount</div>
          <div class="stat-value text-secondary">{formatCurrency(analyticsData.totalAmount)}</div>
          <div class="stat-desc">All purchases</div>
        </div>
        
        <div class="stat">
          <div class="stat-title">Average Transaction</div>
          <div class="stat-value text-accent">{formatCurrency(analyticsData.averageTransaction)}</div>
          <div class="stat-desc">Per purchase</div>
        </div>
        
        <div class="stat">
          <div class="stat-title">Unique Items</div>
          <div class="stat-value">{analyticsData.itemDistribution.length}</div>
          <div class="stat-desc">Different products</div>
        </div>
      </div>

      <!-- Charts -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <!-- Frequent Items Chart -->
        <div class="card bg-base-100 shadow-xl">
          <div class="card-body">
            <PieChart 
              data={frequentItemsChartData}
              options={pieChartOptions}
              title="Frequently Bought Items (>3 purchases)"
              height={400}
            />
            {#if frequencyAnalysis && frequencyAnalysis.frequent.length === 0}
              <div class="text-center text-base-content/50 py-8">
                <p>No frequently bought items yet</p>
                <p class="text-sm">Items with more than {frequencyAnalysis.threshold} purchases will appear here</p>
              </div>
            {/if}
          </div>
        </div>

        <!-- Non-Frequent Items Chart -->
        <div class="card bg-base-100 shadow-xl">
          <div class="card-body">
            <PieChart 
              data={nonFrequentItemsChartData}
              options={pieChartOptions}
              title="Occasionally Bought Items (≤3 purchases)"
              height={400}
            />
          </div>
        </div>
      </div>

      <!-- Monthly Spending Chart -->
      <div class="card bg-base-100 shadow-xl">
        <div class="card-body">
          <BarChart 
            data={barChartData}
            options={barChartOptions}
            title="Monthly Spending"
            height={400}
          />
        </div>
      </div>

    {:else if selectedView === 'trends'}
      <!-- Spending trends -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {#if spendingTrends}
          <div class="card bg-base-100 shadow-xl">
            <div class="card-body text-center">
              <h3 class="card-title justify-center">This Month</h3>
              <div class="stat-value text-primary">{formatCurrency(spendingTrends.currentMonth)}</div>
              <div class="flex items-center justify-center mt-2">
                {#if spendingTrends.trend === 'up'}
                  <svg class="w-4 h-4 text-error mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 17l9.2-9.2M17 17V7H7"/>
                  </svg>
                  <span class="text-error text-sm">+{spendingTrends.percentageChange.toFixed(1)}%</span>
                {:else if spendingTrends.trend === 'down'}
                  <svg class="w-4 h-4 text-success mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 7l-9.2 9.2M7 7v10h10"/>
                  </svg>
                  <span class="text-success text-sm">-{spendingTrends.percentageChange.toFixed(1)}%</span>
                {:else}
                  <span class="text-base-content/60 text-sm">No change</span>
                {/if}
              </div>
            </div>
          </div>

          <div class="card bg-base-100 shadow-xl">
            <div class="card-body text-center">
              <h3 class="card-title justify-center">Last Month</h3>
              <div class="stat-value text-base-content/70">{formatCurrency(spendingTrends.previousMonth)}</div>
              <div class="text-sm text-base-content/50 mt-2">Previous period</div>
            </div>
          </div>

          <div class="card bg-base-100 shadow-xl">
            <div class="card-body text-center">
              <h3 class="card-title justify-center">Trend</h3>
              <div class="stat-value">
                {#if spendingTrends.trend === 'up'}
                  <span class="text-error">↗️ Rising</span>
                {:else if spendingTrends.trend === 'down'}
                  <span class="text-success">↘️ Falling</span>
                {:else}
                  <span class="text-base-content/70">→ Stable</span>
                {/if}
              </div>
              <div class="text-sm text-base-content/50 mt-2">Spending pattern</div>
            </div>
          </div>
        {/if}
      </div>

      <!-- Monthly spending chart -->
      <div class="card bg-base-100 shadow-xl">
        <div class="card-body">
          <BarChart 
            data={barChartData}
            options={barChartOptions}
            title="Monthly Spending Trends"
            height={500}
          />
        </div>
      </div>

    {:else if selectedView === 'insights'}
      <!-- Item insights -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <!-- Top spenders -->
        <div class="card bg-base-100 shadow-xl">
          <div class="card-body">
            <h3 class="card-title">Top Spenders</h3>
            <div class="space-y-3">
              {#each topSpenders as spender, index}
                <div class="flex items-center justify-between p-3 bg-base-200 rounded-lg">
                  <div class="flex items-center">
                    <div class="badge badge-primary badge-sm mr-3">{index + 1}</div>
                    <span class="font-medium">{spender.sender}</span>
                  </div>
                  <div class="text-right">
                    <div class="font-semibold">{formatCurrency(spender.total)}</div>
                    <div class="text-xs text-base-content/60">{spender.count} transactions</div>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        </div>

        <!-- Item insights -->
        {#if itemInsights}
          <div class="card bg-base-100 shadow-xl">
            <div class="card-body">
              <h3 class="card-title">Item Insights</h3>
              <div class="space-y-4">
                <div class="p-3 bg-base-200 rounded-lg">
                  <div class="text-sm text-base-content/70">Most Frequent Item</div>
                  <div class="font-semibold text-lg">{itemInsights.mostFrequent}</div>
                </div>
                
                <div class="p-3 bg-base-200 rounded-lg">
                  <div class="text-sm text-base-content/70">Highest Total Spending</div>
                  <div class="font-semibold text-lg">{itemInsights.mostExpensive}</div>
                </div>
                
                <div class="p-3 bg-base-200 rounded-lg">
                  <div class="text-sm text-base-content/70 mb-2">Top Items by Average Price</div>
                  <div class="space-y-1">
                    {#each itemInsights.averagePriceByItem.slice(0, 5) as item}
                      <div class="flex justify-between text-sm">
                        <span>{item.item}</span>
                        <span class="font-medium">{formatCurrency(item.averagePrice)}</span>
                      </div>
                    {/each}
                  </div>
                </div>
              </div>
            </div>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Export options -->
    <div class="flex justify-center mt-8">
      <div class="dropdown dropdown-top">
        <label tabindex="0" class="btn btn-outline">
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          Export Analytics
        </label>
        <ul tabindex="0" class="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-52">
          <li><button on:click={() => exportAnalytics('json')}>Export as JSON</button></li>
          <li><button on:click={() => exportAnalytics('csv')}>Export as CSV</button></li>
        </ul>
      </div>
    </div>
  {/if}
</div>

<style>
  .analytics-container {
    @apply w-full max-w-7xl mx-auto p-4;
  }

  .empty-state {
    @apply bg-base-100 rounded-lg shadow-sm border border-base-300;
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .stats {
      @apply stats-vertical;
    }
    
    .grid {
      @apply grid-cols-1;
    }
  }
</style>