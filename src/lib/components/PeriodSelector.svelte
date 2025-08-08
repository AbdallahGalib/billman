<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let startMonth: string = '';
  export let endMonth: string = '';
  
  const dispatch = createEventDispatcher<{
    periodChange: { startMonth: string; endMonth: string };
  }>();
  
  // Generate month options for the last 2 years and next year
  const generateMonthOptions = () => {
    const options: { value: string; label: string }[] = [];
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    
    // Generate options from 2 years ago to 1 year in the future
    for (let year = currentYear - 2; year <= currentYear + 1; year++) {
      for (let month = 0; month < 12; month++) {
        const date = new Date(year, month, 1);
        const value = `${year}-${String(month + 1).padStart(2, '0')}`;
        const label = date.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long' 
        });
        options.push({ value, label });
      }
    }
    
    return options;
  };
  
  const monthOptions = generateMonthOptions();
  
  const handlePeriodChange = () => {
    dispatch('periodChange', { startMonth, endMonth });
  };
  
  const clearPeriod = () => {
    startMonth = '';
    endMonth = '';
    handlePeriodChange();
  };
</script>

<div class="card bg-base-100 shadow-sm border border-base-300 mb-4">
  <div class="card-body p-4">
    <h3 class="card-title text-lg mb-3">Period Filter</h3>
    
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
      <div class="form-control">
        <label class="label" for="start-month">
          <span class="label-text font-medium">Start Month</span>
        </label>
        <select 
          id="start-month"
          class="select select-bordered w-full"
          bind:value={startMonth}
          on:change={handlePeriodChange}
        >
          <option value="">All time</option>
          {#each monthOptions as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </div>     
 
      <div class="form-control">
        <label class="label" for="end-month">
          <span class="label-text font-medium">End Month</span>
        </label>
        <select 
          id="end-month"
          class="select select-bordered w-full"
          bind:value={endMonth}
          on:change={handlePeriodChange}
        >
          <option value="">All time</option>
          {#each monthOptions as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </div>
      
      <div class="form-control">
        <button 
          class="btn btn-outline btn-sm"
          on:click={clearPeriod}
          disabled={!startMonth && !endMonth}
        >
          Clear Filter
        </button>
      </div>
    </div>
    
    {#if startMonth || endMonth}
      <div class="mt-3 text-sm text-base-content/70">
        {#if startMonth && endMonth}
          Showing data from {monthOptions.find(o => o.value === startMonth)?.label} to {monthOptions.find(o => o.value === endMonth)?.label}
        {:else if startMonth}
          Showing data from {monthOptions.find(o => o.value === startMonth)?.label} onwards
        {:else if endMonth}
          Showing data up to {monthOptions.find(o => o.value === endMonth)?.label}
        {/if}
      </div>
    {/if}
  </div>
</div>