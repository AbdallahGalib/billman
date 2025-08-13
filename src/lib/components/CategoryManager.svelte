<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import type { Category, Transaction } from '../types';
  import { CategoryService } from '../services/categoryService';

  // Props
  export let categories: Category[] = [];
  export let selectedTransactions: Transaction[] = [];
  export let mode: 'manage' | 'assign' = 'manage';

  // Services
  let categoryService: CategoryService;

  // State
  let showCreateModal = false;
  let showAssignModal = false;
  let newCategory = {
    name: '',
    color: '#3B82F6',
    description: ''
  };
  let selectedCategoryId = '';
  let isLoading = false;
  let error: string | null = null;

  // Event dispatcher
  const dispatch = createEventDispatcher<{
    categoryCreated: Category;
    categoryUpdated: Category;
    categoryDeleted: string;
    categoriesAssigned: { transactionIds: string[]; categoryId: string };
  }>();

  onMount(() => {
    categoryService = new CategoryService();
  });

  // Category CRUD operations
  async function createCategory() {
    if (!newCategory.name.trim()) return;

    try {
      isLoading = true;
      error = null;
      
      const category = await categoryService.createCategory({
        name: newCategory.name.trim(),
        color: newCategory.color,
        description: newCategory.description.trim() || undefined
      });

      dispatch('categoryCreated', category);
      
      // Reset form
      newCategory = {
        name: '',
        color: '#3B82F6',
        description: ''
      };
      showCreateModal = false;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to create category';
    } finally {
      isLoading = false;
    }
  }

  async function updateCategory(id: string, updates: Partial<Category>) {
    try {
      const updatedCategory = await categoryService.updateCategory(id, updates);
      dispatch('categoryUpdated', updatedCategory);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to update category';
    }
  }

  async function deleteCategory(id: string, categoryName: string) {
    if (confirm(`Are you sure you want to delete the category "${categoryName}"? This action cannot be undone.`)) {
      try {
        await categoryService.deleteCategory(id);
        dispatch('categoryDeleted', id);
      } catch (err) {
        error = err instanceof Error ? err.message : 'Failed to delete category';
      }
    }
  }

  // Bulk assignment
  async function assignCategoryToTransactions() {
    if (!selectedCategoryId || selectedTransactions.length === 0) return;

    try {
      isLoading = true;
      error = null;

      const transactionIds = selectedTransactions.map(t => t.id);
      await categoryService.assignCategoryToTransactions(transactionIds, selectedCategoryId);
      
      dispatch('categoriesAssigned', { transactionIds, categoryId: selectedCategoryId });
      
      showAssignModal = false;
      selectedCategoryId = '';
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to assign categories';
    } finally {
      isLoading = false;
    }
  }

  function clearError() {
    error = null;
  }

  // Color presets
  const colorPresets = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', 
    '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'
  ];
</script>

<div class="category-manager">
  {#if error}
    <div class="alert alert-error mb-4">
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
      <span>{error}</span>
      <button class="btn btn-sm btn-ghost" on:click={clearError}>✕</button>
    </div>
  {/if}

  {#if mode === 'manage'}
    <!-- Category Management Mode -->
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-2xl font-bold">Category Management</h2>
      <button class="btn btn-primary" on:click={() => showCreateModal = true}>
        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
        </svg>
        New Category
      </button>
    </div>

    <!-- Categories Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {#each categories as category}
        <div class="card bg-base-100 shadow-xl">
          <div class="card-body">
            <div class="flex items-center gap-3">
              <div 
                class="w-4 h-4 rounded-full"
                style="background-color: {category.color || '#3B82F6'}"
              ></div>
              <h3 class="card-title text-lg">{category.name}</h3>
            </div>
            
            {#if category.description}
              <p class="text-sm text-base-content/70">{category.description}</p>
            {/if}
            
            <div class="text-xs text-base-content/50">
              Created: {category.createdAt.toLocaleDateString()}
            </div>
            
            <div class="card-actions justify-end mt-4">
              <button 
                class="btn btn-ghost btn-sm"
                on:click={() => updateCategory(category.id, { name: prompt('New name:', category.name) || category.name })}
              >
                Edit
              </button>
              <button 
                class="btn btn-error btn-sm"
                on:click={() => deleteCategory(category.id, category.name)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      {/each}

      {#if categories.length === 0}
        <div class="col-span-full text-center py-12">
          <svg class="w-16 h-16 mx-auto mb-4 text-base-content/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a1.994 1.994 0 01-1.414.586H7a4 4 0 01-4-4V7a4 4 0 014-4z"/>
          </svg>
          <h3 class="text-lg font-medium text-base-content/70">No categories yet</h3>
          <p class="text-base-content/50">Create your first category to start organizing transactions</p>
        </div>
      {/if}
    </div>

  {:else if mode === 'assign'}
    <!-- Assignment Mode -->
    <div class="flex justify-between items-center mb-6">
      <div>
        <h2 class="text-2xl font-bold">Assign Categories</h2>
        <p class="text-base-content/70">{selectedTransactions.length} transactions selected</p>
      </div>
      <button 
        class="btn btn-primary"
        disabled={selectedTransactions.length === 0}
        on:click={() => showAssignModal = true}
      >
        Assign Category
      </button>
    </div>

    <!-- Selected Transactions Preview -->
    {#if selectedTransactions.length > 0}
      <div class="bg-base-100 rounded-lg p-4 mb-6">
        <h3 class="font-semibold mb-3">Selected Transactions</h3>
        <div class="max-h-60 overflow-y-auto space-y-2">
          {#each selectedTransactions.slice(0, 10) as transaction}
            <div class="flex justify-between items-center p-2 bg-base-200 rounded">
              <span class="font-medium">{transaction.item}</span>
              <span class="text-sm text-base-content/70">৳{transaction.amount}</span>
            </div>
          {/each}
          {#if selectedTransactions.length > 10}
            <div class="text-center text-sm text-base-content/50">
              ... and {selectedTransactions.length - 10} more
            </div>
          {/if}
        </div>
      </div>
    {/if}
  {/if}
</div>

<!-- Create Category Modal -->
{#if showCreateModal}
  <div class="modal modal-open">
    <div class="modal-box">
      <h3 class="font-bold text-lg">Create New Category</h3>
      
      <div class="py-4 space-y-4">
        <!-- Category Name -->
        <div class="form-control">
          <label class="label">
            <span class="label-text">Category Name *</span>
          </label>
          <input 
            type="text" 
            class="input input-bordered w-full"
            placeholder="Enter category name"
            bind:value={newCategory.name}
            on:keydown={(e) => e.key === 'Enter' && createCategory()}
          />
        </div>

        <!-- Category Color -->
        <div class="form-control">
          <label class="label">
            <span class="label-text">Color</span>
          </label>
          <div class="flex gap-2 mb-2">
            {#each colorPresets as color}
              <button
                class="w-8 h-8 rounded-full border-2 {newCategory.color === color ? 'border-base-content' : 'border-base-300'}"
                style="background-color: {color}"
                on:click={() => newCategory.color = color}
              ></button>
            {/each}
          </div>
          <input 
            type="color" 
            class="input input-bordered w-full h-12"
            bind:value={newCategory.color}
          />
        </div>

        <!-- Category Description -->
        <div class="form-control">
          <label class="label">
            <span class="label-text">Description (optional)</span>
          </label>
          <textarea 
            class="textarea textarea-bordered"
            placeholder="Enter category description"
            bind:value={newCategory.description}
          ></textarea>
        </div>
      </div>

      <div class="modal-action">
        <button class="btn" on:click={() => showCreateModal = false}>Cancel</button>
        <button 
          class="btn btn-primary" 
          on:click={createCategory}
          disabled={!newCategory.name.trim() || isLoading}
        >
          {isLoading ? 'Creating...' : 'Create Category'}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Assign Category Modal -->
{#if showAssignModal}
  <div class="modal modal-open">
    <div class="modal-box">
      <h3 class="font-bold text-lg">Assign Category</h3>
      
      <div class="py-4">
        <p class="mb-4">Assign a category to {selectedTransactions.length} selected transactions:</p>
        
        <div class="form-control">
          <label class="label">
            <span class="label-text">Select Category</span>
          </label>
          <select 
            class="select select-bordered w-full"
            bind:value={selectedCategoryId}
          >
            <option value="">Choose a category...</option>
            {#each categories as category}
              <option value={category.id}>
                {category.name}
              </option>
            {/each}
          </select>
        </div>
      </div>

      <div class="modal-action">
        <button class="btn" on:click={() => showAssignModal = false}>Cancel</button>
        <button 
          class="btn btn-primary" 
          on:click={assignCategoryToTransactions}
          disabled={!selectedCategoryId || isLoading}
        >
          {isLoading ? 'Assigning...' : 'Assign Category'}
        </button>
      </div>
    </div>
  </div>
{/if}