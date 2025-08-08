<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Chart, registerables } from 'chart.js';
  import type { ChartData, ChartOptions } from '../../types';

  // Register Chart.js components
  Chart.register(...registerables);

  // Props
  export let data: ChartData;
  export let options: ChartOptions = {};
  export let title: string = '';
  export let height: number = 400;

  // State
  let canvas: HTMLCanvasElement;
  let chart: Chart | null = null;

  // Default options
  const defaultOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'bottom'
      },
      tooltip: {
        enabled: true,
        callbacks: {
          label: (context: any) => {
            const label = context.label || '';
            const value = context.parsed || 0;
            const total = context.dataset.data.reduce((sum: number, val: number) => sum + val, 0);
            const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
            return `${label}: ${value} (${percentage}%)`;
          }
        }
      }
    }
  };

  // Merge options
  $: mergedOptions = { ...defaultOptions, ...options };

  // Create or update chart
  function createChart() {
    if (!canvas || !data) return;

    // Destroy existing chart
    if (chart) {
      chart.destroy();
    }

    // Create new chart
    chart = new Chart(canvas, {
      type: 'pie',
      data,
      options: mergedOptions
    });
  }

  // Update chart data
  function updateChart() {
    if (!chart || !data) return;

    chart.data = data;
    chart.options = mergedOptions;
    chart.update('active');
  }

  // Lifecycle
  onMount(() => {
    createChart();
  });

  onDestroy(() => {
    if (chart) {
      chart.destroy();
    }
  });

  // Reactive updates
  $: if (chart && data) {
    updateChart();
  }

  // Handle empty data
  $: hasData = data && data.datasets && data.datasets[0] && data.datasets[0].data.length > 0;
</script>

<div class="pie-chart-container">
  {#if title}
    <h3 class="text-lg font-semibold text-center mb-4">{title}</h3>
  {/if}

  <div class="chart-wrapper" style="height: {height}px;">
    {#if hasData}
      <canvas bind:this={canvas} class="chart-canvas"></canvas>
    {:else}
      <!-- Empty state -->
      <div class="empty-state">
        <svg class="w-16 h-16 text-base-content/30 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
        </svg>
        <p class="text-base-content/50 text-center">No data available</p>
        <p class="text-base-content/30 text-sm text-center mt-1">Upload transactions to see the chart</p>
      </div>
    {/if}
  </div>

  {#if hasData}
    <!-- Chart summary -->
    <div class="chart-summary mt-4 p-4 bg-base-200 rounded-lg">
      <div class="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span class="text-base-content/70">Total Items:</span>
          <span class="font-semibold ml-2">{data.labels?.length || 0}</span>
        </div>
        <div>
          <span class="text-base-content/70">Total Count:</span>
          <span class="font-semibold ml-2">
            {data.datasets?.[0]?.data?.reduce((sum: number, val: number) => sum + val, 0) || 0}
          </span>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .pie-chart-container {
    @apply w-full;
  }

  .chart-wrapper {
    @apply relative w-full bg-base-100 rounded-lg shadow-sm border border-base-300;
  }

  .chart-canvas {
    @apply w-full h-full;
  }

  .empty-state {
    @apply flex flex-col items-center justify-center h-full;
  }

  .chart-summary {
    @apply text-sm;
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .chart-wrapper {
      height: 300px !important;
    }
    
    .chart-summary {
      @apply grid-cols-1 gap-2;
    }
  }
</style>