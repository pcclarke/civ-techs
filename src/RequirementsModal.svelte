<script>
  import Button, { Label } from '@smui/button';
  import Dialog, { Header, Title, Content, Actions } from '@smui/dialog';

  export let display;
  export let info;

  $: ({
    imagePath,
    leadsRequirements,
    leadsOptionals,
    optionals,
    requirements,
    name
  } = info);
</script>

<Button on:click={() => (display = true)}>
  <Label>Open Dialog</Label>
</Button>

<Dialog
  bind:open={display}
  aria-labelledby="simple-title"
  aria-describedby="simple-content"
>
  <Title style="margin-top: 16px">
    <img alt={`${name}`} src={`/${imagePath}`} />
    {name}
  </Title>
  <Content id="simple-content">
    {#if requirements || optionals}
      <h6>Requirements</h6>
    {/if}
    {#if requirements}
      <p>You must have: {requirements}</p>
    {/if}
    {#if optionals}
      <div>
        {#if requirements}
          <p id='tipPlusLine'>plus</p>
        {/if}
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
  </Content>
  <Actions>
    <Button>
      <Label>Close</Label>
    </Button>
  </Actions>
</Dialog>

<style>
  h6 {
    margin-bottom: 2px;
  }

  img {
    vertical-align: middle;
  }

  p {
    margin: 0;
  }
</style>