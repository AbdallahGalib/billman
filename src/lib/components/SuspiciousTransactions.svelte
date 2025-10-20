<script lang="ts">
  import type { SuspiciousTransaction } from '../types';
  import { formatCurrency } from '../utils/helpers';

  export let suspiciousTransactions: SuspiciousTransaction[] = [];

  function getReasonText(reason: string): string {
    switch (reason) {
      case 'total_mismatch': return 'Total Mismatch';
      case 'missing_items': return 'Items Without Amounts';
      case 'no_amount': return 'No Amount Found';
      default: return 'Unknown';
    }
  }

  function getReasonColor(reason: string): string {
    switch (reason) {
      case 'total_mismatch': return 'badge-error';
      case 'missing_items': return 'badge-warning';
      case 'no_amount': return 'badge-info';
      default: return 'badge-ghost';
    }
  }
</script>

<div class="space-y-6">
  <div class="flex justify-between items-center">
    <h1 class="text-3xl font-bold">Suspicious Purchases</h1>
    <div class="badge badge-error">{suspiciousTransactions.length} Issues</div>
  </div>

  {#if suspiciousTransactions.length === 0}
    <div class="hero bg-base-100 rounded-lg shadow-xl">
      <div class="hero-content text-center">
        <div class="max-w-md">
          <h1 class="text-5xl font-bold">✅</h1>
          <h2 class="text-3xl font-bold py-6">All Good!</h2>
          <p class="py-6">No suspicious transactions found. All purchases have been validated successfully.</p>
        </div>
      </div>
    </div>
  {:else}
    <div class="grid gap-4">
      {#each suspiciousTransactions as transaction}
        <div class="card bg-base-100 shadow-xl">
          <div class="card-body">
            <div class="flex justify-between items-start">
              <div>
                <h3 class="card-title">
                  {transaction.sender} - {transaction.date.toLocaleDateString()}
                </h3>
                <div class="badge {getReasonColor(transaction.reason)} badge-sm">
                  {getReasonText(transaction.reason)}
                </div>
              </div>
              
              {#if transaction.reason === 'total_mismatch'}
                <div class="text-right">
                  <div class="text-sm text-base-content/70">Expected: {formatCurrency(transaction.expectedTotal || 0)}</div>
                  <div class="text-sm text-base-content/70">Actual: {formatCurrency(transaction.actualTotal || 0)}</div>
                  <div class="text-sm font-semibold text-error">
                    Difference: {formatCurrency(Math.abs((transaction.expectedTotal || 0) - (transaction.actualTotal || 0)))}
                  </div>
                </div>
              {/if}
            </div>

            <div class="mt-4">
              <h4 class="font-semibold mb-2">Original Message:</h4>
              <div class="bg-base-200 p-3 rounded text-sm font-mono">
                {transaction.originalMessage}
              </div>
            </div>

            <div class="mt-4">
              <h4 class="font-semibold mb-2">Extracted Items:</h4>
              <div class="overflow-x-auto">
                <table class="table table-zebra table-sm">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each transaction.extractedItems as item}
                      <tr>
                        <td>{item.item}</td>
                        <td>
                          {#if item.amount}
                            {formatCurrency(item.amount)}
                          {:else}
                            <span class="text-warning">No amount</span>
                          {/if}
                        </td>
                        <td>
                          {#if item.amount}
                            <div class="badge badge-success badge-xs">Valid</div>
                          {:else}
                            <div class="badge badge-warning badge-xs">Missing Price</div>
                          {/if}
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>