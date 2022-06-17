<script>
  export let display;
  export let imagePath;
  export let leadsRequirements;
  export let leadsOptionals;
  export let optionals;
  export let requirements;
  export let title;
</script>

{#if display}
  <div class="modal" id="modal">
    <img alt={`${title}`} src={`/${imagePath}`} />
    <h5>{title}</h5>
    {#if requirements}
      <div>
        <h6>Requirements</h6>
        <p>You must have: {requirements}</p>
      </div>
    {/if}
    {#if optionals}
      <div>
        <p id='tipPlusLine'>plus</p>
        <p>You need one of: {optionals}</p>
      </div>
    {/if}
    {#if (leadsRequirements || leadsOptionals)}
      <h6>Leads to</h6>
    {/if}
    {#if leadsRequirements}
      <p>Must have for: {leadsRequirements}</p>
    {/if}
    {#if leadsOptionals}
      <p>Optional for: {leadsOptionals}</p>
    {/if}
    <button on:click={() => display = false}>Close</button>
  </div>
  <div
    class="modal-overlay"
    id="modal-overlay"
    on:click={() => display = false}
  >
  </div>
{/if}

<style>
  .modal {
    background-color: #fff;
    border: 1px solid #808080;
    padding: 16px;
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 400px;
    max-width: 100%;
    max-height: 100%;
    z-index: 1010;
  }

  .modal-overlay {
    background-color: rgba(0, 0, 0, .5);
    position: fixed;
    top: 0;
    left: 0;
    z-index: 1000;
    width: 100%;
    height: 100%;
  }
</style>