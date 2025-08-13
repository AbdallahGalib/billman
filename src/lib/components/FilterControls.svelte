<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import type { FilterState, FilterPreset, Category } from '../types';
  import { FilterService } from '../services/filterService';
  import { CategoryService } from '../services/categoryService';

  // Props
  export let currentFilters: FilterState;
  export let availableCategories: Category[] = [];
  export let availableItems: string[] = [];
  export let availableSenders: string[] = [];
  export let showPresets: boolean = true;

  // Services
  let filterService: FilterService;
  let categoryService: CategoryService;

  // State
  let filterPresets: FilterPreset[] = [];
  let showPresetModal = false;
  let newPresetName = '';
  let isLoading = false;

  // Event dispatcher
  const dispatch = createEventDispatcher<{
    filtersChanged: FilterState;
    presetSaved: { name: string; filters: FilterState };
    presetApplied: FilterPreset;
  }>();

  onMount(async () => {
    filterService = new FilterService();
    categoryService = new CategoryService();
    
    if (showPresets) {
      filterPresets = await filterService.getFilterPresets();
    }
  });

  // Filter change handlers
  function updateFilters(updates: Partial<FilterState>) {
    const newFilters = { ...currentFilters, ...updates };
    dispatch('filtersChanged', newFilters);
  }

  function handleCategoryChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    const selectedOptions = Array.from(target.selectedOptions).map(option => option.value);
    updateFilters({ categories: selectedOptions });
  }

  function handleItemChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    const selectedOptions = Array.from(target.selectedOptions).map(option => option.value);
    updateFilters({ items: selectedOptions });
  }

  function handleSenderChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    const selectedOptions = Array.from(target.selectedOptions).map(option => option.value);
    updateFilters({ senders: selectedOptions });
  }

  function handleDateStartChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const date = target.value ? new Date(target.value) : null;
    updateFilters({ 
      dateRange: { ...currentFilters.dateRange, start: date }
    });
  }

  function handleDateEndChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const date = target.value ? new Date(target.value) : null;
    updateFilters({ 
      dateRange: { ...currentFilters.dateRange, end: date }
    });
  }

  function handleAmountMinChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const value = target.value ? parseFloat(target.value) : null;
    updateFilters({ 
      amountRange: { ...currentFilters.amountRange, min: value }
    });
  }

  function handleAmountMaxChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const value = target.value ? parseFloat(target.value) : null;
    updateFilters({ 
      amountRange: { ...currentFilters.amountRange, max: value }
    });
  }

  // Clear filters
  function clearAllFilters() {
    const emptyFilters: FilterState = {
      categories: [],
      items: [],
      senders: [],
      dateRange: { start: null, end: null },
      amountRange: { min: null, max: null }
    };
    dispatch('filtersChanged', emptyFilters);
  }

  // Preset management
  async function savePreset() {
    if (!newPresetName.trim()) return;
    
    try {
      isLoading = true;
      const preset = await filterService.saveFilterPreset(newPresetName.trim(), currentFilters);
      filterPresets = [...filterPresets, preset];
      dispatch('presetSaved', { name: newPresetName.trim(), filters: currentFilters });
      
      newPresetName = '';
      showPresetModal = false;
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to save preset');
    } finally {
      isLoading = false;
    }
  }

  async function applyPreset(preset: FilterPreset) {
    dispatch('presetApplied', preset);
    dispatch('filtersChanged', preset.filters);
  }

  async function deletePreset(presetId: string) {
    if (confirm('Are you sure you want to delete this filter preset?')) {
      try {
        await filterService.deleteFilterPreset(presetId);
        filterPresets = filterPresets.filter(p => p.id !== presetId);
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Failed to delete preset');
      }
    }
  }

  // Check if filters are active
  $: hasActiveFilters = filterService?.hasActiveFilters(currentFilters) || false;
  $: activeFilterCount = filterService?.getActiveFilterCount(currentFilters) || 0;
</script>

<div class="filter-controls bg-base-100 p-4 rounded-lg shadow-lg">
  <div class="flex flex-wrap items-center gap-4 mb-4">
    <h3 class="text-lg font-semibold">Filters</h3>
    
    {#if hasActiveFilters}
      <div class="badge badge-primary">{activeFilterCount} active</div>
      <button class="btn btn-ghost btn-sm" on:click={clearAllFilters}>
        Clear All
      </button>
    {/if}

    {#if showPresets}
      <div class="ml-auto flex gap-2">
        <button class="btn btn-outline btn-sm" on:click={() => showPresetModal = true}>
          Save Preset
        </button>
      </div>
    {/if}
  </div>

  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
    <!-- Category Filter -->
    <div class="form-control">
      <label class="label">
        <span class="label-text">Categories</span>
      </label>
      <select 
        class="select select-bordered select-sm" 
        multiple 
        size="3"
        on:change={handleCategoryChange}
      >
        {#each availableCategories as category}
          <option 
            value={category.id}
            selected={currentFilters.categories.includes(category.id)}
          >
            {category.name}
          </option>
        {/each}
      </select>
    </div>

    <!-- Item Filter -->
    <div class="form-control">
      <label class="label">
        <span class="label-text">Items</span>
      </label>
      <select 
        class="select select-bordered select-sm" 
        multiple 
        size="3"
        on:change={handleItemChange}
      >
        {#each availableItems as item}
          <option 
            value={item}
            selected={currentFilters.items.includes(item)}
          >
            {item}
          </option>
        {/each}
      </select>
    </div>

    <!-- Sender Filter -->
    <div class="form-control">
      <label class="label">
        <span class="label-text">Senders</span>
      </label>
      <select 
        class="select select-bordered select-sm" 
        multiple 
        size="3"
        on:change={handleSenderChange}
      >
        {#each availableSenders as sender}
          <option 
            value={sender}
            selected={currentFilters.senders.includes(sender)}
          >
            {sender}
          </option>
        {/each}
      </select>
    </div>

    <!-- Date Range Filter -->
    <div class="form-control">
      <label class="label">
        <span class="label-text">Date Range</span>
      </label>
      <div class="space-y-2">
        <input 
          type="date" 
          class="input input-bordered input-sm w-full"
          placeholder="Start date"
          value={currentFilters.dateRange.start?.toISOString().split('T')[0] || ''}
          on:change={handleDateStartChange}
        />
        <input 
          type="date" 
          class="input input-bordered input-sm w-full"
          placeholder="End date"
          value={currentFilters.dateRange.end?.toISOString().split('T')[0] || ''}
          on:change={handleDateEndChange}
        />
      </div>
    </div>

    <!-- Amount Range Filter -->
    <div class="form-control">
      <label class="label">
        <span class="label-text">Amount Range</span>
      </label>
      <div class="space-y-2">
        <input 
          type="number" 
          class="input input-bordered input-sm w-full"
          placeholder="Min amount"
          min="0"
          step="0.01"
          value={currentFilters.amountRange.min || ''}
          on:change={handleAmountMinChange}
        />
        <input 
          type="number" 
          class="input input-bordered input-sm w-full"
          placeholder="Max amount"
          min="0"
          step="0.01"
          value={currentFilters.amountRange.max || ''}
          on:change={handleAmountMaxChange}
        />
      </div>
    </div>
  </div>

  <!-- Filter Presets -->
  {#if showPresets && filterPresets.length > 0}
    <div class="mt-4">
      <label class="label">
        <span class="label-text">Saved Presets</span>
      </label>
      <div class="flex flex-wrap gap-2">
        {#each filterPresets as preset}
          <div class="flex items-center gap-1 bg-base-200 rounded-lg p-2">
            <button 
              class="btn btn-ghost btn-xs"
              on:click={() => applyPreset(preset)}
            >
              {preset.name}
            </button>
            <button 
              class="btn btn-ghost btn-xs text-error"
              on:click={() => deletePreset(preset.id)}
            >
              ×
            </button>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<!-- Save Preset Modal -->
{#if showPresetModal}
  <div class="modal modal-open">
    <div class="modal-box">
      <h3 class="font-bold text-lg">Save Filter Preset</h3>
      <div class="py-4">
        <div class="form-control">
          <label class="label">
            <span class="label-text">Preset Name</span>
          </label>
          <input 
            type="text" 
            class="input input-bordered w-full"
            placeholder="Enter preset name"
            bind:value={newPresetName}
            on:keydown={(e) => e.key === 'Enter' && savePreset()}
          />
        </div>
      </div>
      <div class="modal-action">
        <button class="btn" on:click={() => showPresetModal = false}>Cancel</button>
        <button 
          class="btn btn-primary" 
          on:click={savePreset}
          disabled={!newPresetName.trim() || isLoading}
        >
          {isLoading ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  </div>
{/if}